# Cloudflare Billing & Usage Analytics

> **Disclaimer**: Educational/demo project only. Not affiliated with Cloudflare. Use at your own risk.

Monitor Cloudflare usage against contract limits with Webhook (Discord) alerts. Built with [Workers](https://developers.cloudflare.com/workers/) and [Workflows](https://developers.cloudflare.com/workflows/).

### Important: GraphQL Analytics vs Billing

This tool uses the [GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/) which provides **observational metrics**, not billing data. From Cloudflare docs:

> "These [sampled](https://developers.cloudflare.com/analytics/graphql-api/sampling/) datasets should **NOT be used as a measure for usage that Cloudflare uses for billing purposes**."

Key differences:
- **DDoS traffic** is included in GraphQL but normally excluded from billing
- **Internal Cloudflare traffic** may be counted unless filtered
- Use `eyeballOnly=true` filter to approximate billable traffic (shows only real visitor requests)
- Actual billing excludes attack traffic and uses different data sources

### Confidence Intervals

The dashboard displays [confidence intervals](https://developers.cloudflare.com/analytics/graphql-api/features/confidence-intervals/) for sampled data, showing how accurate each estimate is:

| Badge | Accuracy | Meaning |
|-------|----------|---------|
| 🟢 97-99% | High | Tight confidence interval, reliable estimate |
| 🟡 90-96% | Medium | Moderate sampling variance |
| 🔴 <90% | Low | Wide interval, interpret with caution |

**Note:** Maximum displayed accuracy is 99% because 100% confidence is mathematically impossible for sampled data. Hover over the badge to see the full confidence interval (estimate, lower/upper bounds, sample size).

Use this tool for **monitoring and early warnings**, not as authoritative billing data. For raw logs, take advantage of [Logpush](https://developers.cloudflare.com/logs/logpush/) or [Log Explorer](https://blog.cloudflare.com/logexplorer-ga/). 

## Quick Start

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/DavidJKTofan/cf-billing-usage-analytics)

```bash
# 1. Clone and install
git clone https://github.com/DavidJKTofan/cf-billing-usage-analytics
cd cf-billing-usage-analytics
npm install

# 2. Create .dev.vars with your credentials
cat > .dev.vars << EOF
CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...  # Optional
EOF

# 3. Run locally
npm run dev
# Open http://localhost:8787

# 4. Deploy
npx wrangler secret put CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npm run deploy
```

**Only 2 environment variables required.** Zones are auto-discovered.

## Project Structure

```
src/
├── index.ts              # HTTP request handlers
├── workflow.ts           # Scheduled workflow (cron)
├── config.ts             # Contract limits & thresholds
├── graphql.ts            # GraphQL Analytics API client
├── cloudflare-api.ts     # REST API (zone discovery)
├── security.ts           # Input validation, CORS, logging
├── notifications/        # Discord (extensible for Slack, etc.)
│   ├── types.ts
│   ├── discord.ts
│   └── index.ts
└── products/             # Product definitions by category
    ├── types.ts          # ProductDefinition interface
    ├── index.ts          # Aggregates all products
    ├── compute.ts        # Workers, Pages, Durable Objects, Queues
    ├── storage.ts        # R2, KV, D1
    ├── network.ts        # HTTP, Bandwidth, DNS, Load Balancing, Cache
    ├── security.ts       # WAF, Bot Management, Turnstile, API Shield
    ├── media.ts          # Stream, Images
    ├── ai.ts             # Workers AI, AI Gateway, Vectorize
    ├── connectivity.ts   # Tunnels, Gateway, Access, WARP
    └── platform.ts       # Email Routing, Zaraz, Logpush

public/
├── index.html            # Dashboard UI
└── robots.txt
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY` | **Yes** | [Cloudflare API Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) - see [API Token Permissions](#api-token-permissions) below |
| `CLOUDFLARE_ACCOUNT_ID` | **Yes** | Your account ID |
| `DISCORD_WEBHOOK_URL` | No | For notifications |
| `CLOUDFLARE_ZONE_TAGS` | No | Comma-separated zone IDs to restrict monitoring |
| `API_ACCESS_KEY` | No | Protect sensitive endpoints (`/api/trigger`, `/api/test-discord`) |
| `ALLOWED_ORIGINS` | No | CORS restriction (default: `*`) |

### API Token Permissions

Create an [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with the following permissions:

| Permission | Scope | Required | Purpose |
|------------|-------|----------|---------|
| **Account Analytics** `Analytics:Read` | Read | **Yes** | Query GraphQL Analytics API for usage data |
| **Zone** `Zone:Read` | Read | **Yes** | Auto-discover zones in your account |
| **Access: Users** `Access:Users:Read` | Read | No | Fetch Zero Trust seat counts (Access + Gateway seats) |

#### Zero Trust Seats

The dashboard displays Zero Trust seat usage (Active Seats, Access Seats, Gateway Seats) in the "Zero Trust & Connectivity" category. This feature requires the **Access: Users Read** permission.

Without this permission, the Zero Trust Seats card will show a helpful message explaining how to enable it. The rest of the dashboard will continue to work normally.

The Zero Trust Users API endpoint (`/accounts/{account_id}/access/users`) returns user data including `access_seat` and `gateway_seat` boolean fields, which are used to calculate:
- **Active Seats**: Users with either Access or Gateway seat (billed seats)
- **Access Seats**: Users who have authenticated with Cloudflare Access
- **Gateway Seats**: Users who have logged into the WARP client
- **Total Users**: All users in the Zero Trust organization

For more details, see [Cloudflare Zero Trust Seat Management](https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/).

### Contract Limits (`src/config.ts`)

```typescript
export const CONTRACT_CONFIG: ContractConfig = {
  alertThresholdPercent: 90,    // Alert at 90%
  warningThresholdPercent: 75,  // Warn at 75%
  
  productOverrides: {
    workers_requests: { limit: 50_000_000, enabled: true },
    stream_minutes_viewed: { enabled: false },  // Disable product
  },
  
  billingPeriod: {
    startDay: 1,
    timezone: 'UTC',
  },
};
```

### Cron Schedule (`wrangler.jsonc`)

```jsonc
{
  "triggers": {
    "crons": ["0 9 * * 1"]  // Weekly on Monday at 9 AM UTC
  }
}
```

Common cron patterns:
- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight UTC
- `0 9 * * 1` - Weekly on Monday at 9 AM UTC

> **Note:** The cron schedule is also hardcoded in `src/index.ts` for display in the UI, so update both files when changing the schedule.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dashboard UI |
| `GET /api/dashboard` | Usage data with optional filters (see below) |
| `GET /api/check` | Run usage check (`?notify=true` to send Discord alert) |
| `GET /api/config` | Current configuration |
| `GET /api/products` | All available products |
| `GET /api/zones` | Discovered zones |
| `GET /api/discover` | Available GraphQL datasets |
| `POST /api/trigger` | Trigger workflow manually (protected by `API_ACCESS_KEY`) |
| `GET /api/status?instanceId=xxx` | Workflow status |
| `POST /api/test-discord` | Test Discord notification (protected by `API_ACCESS_KEY`) |
| `GET /health` | Health check |

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `zoneId=<id>` | Filter to specific zone (only zone-scoped products shown) |
| `eyeballOnly=true` | **Recommended.** Only real visitor requests, excludes internal Cloudflare traffic |
| `excludeEdgeWorkers=true` | Exclude requests from Workers `fetch()` calls |
| `excludeBlocked=true` | Exclude blocked requests (403 status) |

These filters apply to HTTP Requests, Bandwidth, and WAF Events datasets.

## Notifications

Currently supports **Discord** webhooks. The system auto-detects the provider from the webhook URL.

Example notification screenshot from Discord:
![Discord Notification Example](public/discord-notification-example.png)

### When Do Notifications Trigger?

Notifications are sent **automatically** by the cron job (default: every 6 hours) when:
- **Alerts**: Any product usage exceeds the alert threshold (default: 90%)
- **Warnings**: Any product usage exceeds the warning threshold (default: 75%)

**No notification is sent if all products are healthy** (below warning threshold).

| Trigger | Condition | Notification Sent? |
|---------|-----------|-------------------|
| Cron job | All products < 75% | No |
| Cron job | Any product 75-89% | Yes (warning) |
| Cron job | Any product >= 90% | Yes (alert) |
| Manual trigger | `forceNotify=true` | Yes (always) |
| Test button | N/A | Yes (test message) |

The workflow uses filters (`eyeballOnly=true` + `excludeBlocked=true`) by default to approximate billable traffic more accurately. Discord notifications now display which filters were applied.

### Setup Discord

1. In Discord, go to **Server Settings > Integrations > Webhooks**
2. Click **New Webhook**, copy the URL
3. Set the `DISCORD_WEBHOOK_URL` environment variable

```bash
# Local development
echo "DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/..." >> .dev.vars

# Production
npx wrangler secret put DISCORD_WEBHOOK_URL
```

4. Test with `POST /api/test-discord`

### Adding a New Provider (Slack, Teams, etc.)

1. Create `src/notifications/slack.ts` implementing `NotificationProvider`:

```typescript
import type { NotificationProvider } from './types';

export const slackProvider: NotificationProvider = {
  name: 'slack',
  displayName: 'Slack',
  
  validateWebhookUrl(url: string): boolean {
    return url.startsWith('https://hooks.slack.com/');
  },
  
  async sendNotification(webhookUrl, summary, options) {
    // Format and send to Slack
  },
  
  async sendTestNotification(webhookUrl) {
    // Send test message
  },
};
```

2. Register in `src/notifications/index.ts`:

```typescript
import { slackProvider } from './slack';

export const providers: Record<string, NotificationProvider> = {
  discord: discordProvider,
  slack: slackProvider,  // Add here
};
```

The provider is auto-detected from webhook URLs via `validateWebhookUrl()`.

## Adding/Editing Products

Products are defined in `src/products/*.ts`. To add a new product:

```typescript
// In the appropriate category file (e.g., src/products/compute.ts)
{
  id: 'my_product',
  name: 'My Product',
  category: 'compute',
  description: 'What this measures',
  defaultLimit: 1_000_000,
  unit: 'requests',
  dataset: 'myProductAdaptiveGroups',  // GraphQL dataset
  field: 'requests',                    // Field to aggregate
  aggregation: 'sum',                   // 'sum', 'count', 'avg', or 'max'
  scope: 'account',                     // 'account' or 'zone'
  filterField: 'datetime',              // 'datetime', 'date', or 'datetimeHour' (depends on dataset)
  enabledByDefault: true,               // Set false if dataset not available on most accounts
  unlimited: false,                     // Set true for free/included products (no alerts)
  docsUrl: 'https://developers.cloudflare.com/...',
  note: 'Optional tooltip text',
  dimensionFilters: { actionType_in: ['PutObject'] },  // Optional: filter by dimension values
}

// Notes on filterField:
// - Most datasets use 'datetime' (default)
// - D1, DNS, AI Gateway, Cached Bandwidth use 'date'
// - Durable Objects Storage, Vectorize use 'date'
// Use GraphQL introspection or /api/discover to check available filter fields.
```

Use `GET /api/discover` to find available GraphQL datasets for your account.

### Product Availability

Not all products are available on all accounts. Some products are **disabled by default** because:

1. **Enterprise features**: Spectrum, Magic Transit, Magic WAN require Enterprise plans
2. **Not enabled on account**: KV, Queues, Pages Functions, Tunnels, etc. may not be provisioned
3. **Limited data retention**: Turnstile, Access Login have ~7 day retention (can't query full billing period)
4. **Dataset format differences**: Some datasets use different filter fields or aggregation types

To enable a disabled product, add it to `CONTRACT_CONFIG.productOverrides`:

```typescript
productOverrides: {
  kv_reads: { enabled: true, limit: 10_000_000 },
  spectrum_bytes: { enabled: true },
}
```

## Development

```bash
npm run dev          # Local development
npm run cf-typegen   # Generate types after config changes
npm test             # Run tests
npm run deploy       # Deploy to Cloudflare
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Products showing 0 | Feature may not be enabled on zone, or no usage this period |
| GraphQL "unknown field" | Dataset not available for your account. The product is auto-disabled. Enable manually in config if you use the feature. |
| "time range is too large" | Some datasets (Turnstile, Access Login) have ~7 day retention limits. These are disabled by default. |
| No zone data | Check `/api/zones`; ensure token has `Zone:Read` permission |
| Discord not working | Test with `POST /api/test-discord`; check webhook URL |
| Many products disabled | Products are disabled if their GraphQL dataset isn't available on your account. Enable in `CONTRACT_CONFIG.productOverrides` if you use them. |

### Additional Hardening (Optional)

For additional security, consider:

1. **Cloudflare Access**: Add Zero Trust protection to your Worker URL
2. **Custom Domain**: Use a custom domain with additional security headers
3. **Rate Limiting**: Configure Cloudflare Rate Limiting rules

## Disclaimer

This project is provided **"as is"** for **educational and demonstration purposes only**. Do not use in production, adapt to your own needs. There are likely non-accurate or missing products and details.

- **Not affiliated with Cloudflare**: This tool is not officially associated with, endorsed by, or supported by Cloudflare.
- **No warranty**: The authors make no guarantees about accuracy, reliability, or fitness for any particular purpose.
- **Use at your own risk**: You are responsible for how you use this tool and any consequences that may arise.
- **Not for billing**: GraphQL Analytics data should not be used as a measure for actual billing. See [Cloudflare's documentation](https://developers.cloudflare.com/analytics/graphql-api/) for details.

This tool was built vibe coding, using AI LLMs.
