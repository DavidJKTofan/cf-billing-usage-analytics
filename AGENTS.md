# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## MCP Servers

The following MCP servers are available for Cloudflare API and documentation access:

### Cloudflare Docs MCP (`cloudflare-docs`)
Search the Cloudflare documentation for any product or feature.

| Tool | Description |
|------|-------------|
| `cloudflare-docs_search_cloudflare_documentation` | Search docs for Workers, Pages, R2, D1, Zero Trust, CDN, etc. |
| `cloudflare-docs_migrate_pages_to_workers_guide` | Get the Pages to Workers migration guide |

### Cloudflare API MCP (`cloudflare-api`)
Execute Cloudflare REST API requests and search OpenAPI specs.

| Tool | Description |
|------|-------------|
| `cloudflare-api_search` | Search the OpenAPI spec for endpoints (returns paths, methods, parameters) |
| `cloudflare-api_execute` | Execute API requests using `cloudflare.request()` with auto-auth |

**Example - Search for Workers endpoints:**
```javascript
async () => {
  const results = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (op.tags?.some(t => t.toLowerCase() === 'workers')) {
        results.push({ method: method.toUpperCase(), path, summary: op.summary });
      }
    }
  }
  return results;
}
```

**Example - List R2 buckets:**
```javascript
async () => {
  return cloudflare.request({
    method: "GET",
    path: `/accounts/${accountId}/r2/buckets`
  });
}
```

### GraphQL Analytics

For GraphQL Analytics queries, use the REST API to POST to `/client/v4/graphql`:

```javascript
async () => {
  const query = `
    query AccountUsage($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            filter: { datetime_geq: $start, datetime_lt: $end }
            limit: 10000
          ) {
            sum { requests }
          }
        }
      }
    }
  `;
  return cloudflare.request({
    method: "POST",
    path: "/graphql",
    body: { query, variables: { accountTag: accountId, start: "2024-01-01T00:00:00Z", end: "2024-01-31T23:59:59Z" } }
  });
}
```

**Note:** GraphQL Analytics data is sampled and should NOT be used for billing. See https://developers.cloudflare.com/analytics/graphql-api/sampling/
