/**
 * Usage Monitoring Workflow
 *
 * A Cloudflare Workflow that periodically checks usage against contract limits
 * and sends Discord notifications when thresholds are exceeded.
 *
 * Features:
 * - Parallel product queries in batches for performance
 * - NonRetryableError for permanent failures (missing config)
 * - Durable state persistence across retries
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { queryAllProductUsage, categorizeUsage, QueryFilterOptions } from './graphql';
import { sendDiscordNotification } from './notifications';
import { discoverZones } from './cloudflare-api';
import { CONTRACT_CONFIG, getEnabledProducts } from './config';
import type { UsageSummary } from './products/types';

/**
 * Default filter options for workflow usage queries.
 * Uses eyeball + excludeBlocked filters to approximate billable traffic.
 *
 * From Cloudflare docs: "Billable traffic excludes things like DDoS traffic"
 * - eyeballOnly: Excludes internal Cloudflare traffic (Workers subrequests, etc.)
 * - excludeBlocked: Excludes 403 responses (blocked by WAF/DDoS protection)
 */
const DEFAULT_WORKFLOW_FILTERS: QueryFilterOptions = {
	eyeballOnly: true, // Only count visitor traffic for more accurate billing approximation
	excludeEdgeWorkers: false, // Edge workers traffic is still billable
	excludeBlocked: true, // Exclude blocked requests (403) - typically not billed
};

export interface WorkflowEnv {
	USAGE_MONITOR_WORKFLOW: Workflow;
	CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY: string;
	CLOUDFLARE_ACCOUNT_ID: string;
	CLOUDFLARE_ZONE_TAGS?: string; // Comma-separated list of zone tags (optional)
	CLOUDFLARE_ZONE_ID?: string; // Single zone ID (alternative to ZONE_TAGS)
	DISCORD_WEBHOOK_URL: string;
}

export interface WorkflowParams {
	/** Force notification even if no alerts/warnings */
	forceNotify?: boolean;
	/** Include a specific set of products only */
	products?: string[];
	/** Manual trigger source for logging */
	triggeredBy?: string;
}

export interface WorkflowResult {
	summary: UsageSummary;
	notificationSent: boolean;
	notificationError?: string;
}

/**
 * Usage Monitor Workflow
 *
 * Steps:
 * 1. Validate configuration (NonRetryableError if missing)
 * 2. Fetch usage data from GraphQL Analytics API (parallel batches)
 * 3. Compare usage against contract limits
 * 4. Categorize results (alerts, warnings, healthy)
 * 5. Send Discord notification if thresholds exceeded
 */
export class UsageMonitorWorkflow extends WorkflowEntrypoint<WorkflowEnv, WorkflowParams> {
	async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep): Promise<WorkflowResult> {
		const params = event.payload;

		console.log(
			JSON.stringify({
				message: 'Starting usage monitor workflow',
				instanceId: event.instanceId,
				triggeredBy: params.triggeredBy || 'scheduled',
				timestamp: event.timestamp.toISOString(),
			})
		);

		// Step 1: Validate configuration (fail immediately if missing required config)
		const config = await step.do('validate-config', async () => {
			const apiToken = this.env.CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY;
			const accountId = this.env.CLOUDFLARE_ACCOUNT_ID;

			if (!apiToken) {
				throw new NonRetryableError(
					'Missing required environment variable: CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY'
				);
			}

			if (!accountId) {
				throw new NonRetryableError(
					'Missing required environment variable: CLOUDFLARE_ACCOUNT_ID'
				);
			}

			// Support both CLOUDFLARE_ZONE_TAGS (comma-separated) and CLOUDFLARE_ZONE_ID (single)
			let zoneTags =
				this.env.CLOUDFLARE_ZONE_TAGS?.split(',').map((z: string) => z.trim()).filter(Boolean) ||
				(this.env.CLOUDFLARE_ZONE_ID ? [this.env.CLOUDFLARE_ZONE_ID] : []);

			let zonesAutoDiscovered = false;

			// Auto-discover zones if not configured
			if (zoneTags.length === 0) {
				console.log(
					JSON.stringify({
						message: 'No zone tags configured, auto-discovering zones...',
					})
				);

				const zoneDiscovery = await discoverZones(apiToken, accountId);

				if (zoneDiscovery.error) {
					console.warn(
						JSON.stringify({
							message: 'Zone discovery failed',
							error: zoneDiscovery.error,
						})
					);
					// Continue without zones - only account-scoped products will work
				} else {
					zoneTags = zoneDiscovery.zoneIds;
					zonesAutoDiscovered = true;
					console.log(
						JSON.stringify({
							message: 'Zones auto-discovered',
							zoneCount: zoneTags.length,
						})
					);
				}
			}

			const enabledProducts = getEnabledProducts(CONTRACT_CONFIG, zoneTags);

			if (enabledProducts.length === 0) {
				throw new NonRetryableError('No products are enabled for monitoring');
			}

			return {
				apiToken,
				accountId,
				zoneTags,
				zonesAutoDiscovered,
				productCount: enabledProducts.length,
			};
		});

		console.log(
			JSON.stringify({
				message: 'Configuration validated',
				accountId: config.accountId,
				zoneCount: config.zoneTags.length,
				productsCount: config.productCount,
			})
		);

		// Step 2: Fetch usage data from GraphQL Analytics API
		const usageResults = await step.do(
			'fetch-usage-data',
			{
				retries: {
					limit: 3,
					delay: '10 seconds',
					backoff: 'exponential',
				},
				timeout: '3 minutes',
			},
			async () => {
				console.log(
					JSON.stringify({
						message: 'Fetching usage data',
						accountId: config.accountId,
						zoneCount: config.zoneTags.length,
						productsCount: config.productCount,
					})
				);

				// Use eyeball filter by default for more accurate billing approximation
				const results = await queryAllProductUsage(
					config.apiToken,
					config.accountId,
					config.zoneTags,
					DEFAULT_WORKFLOW_FILTERS
				);

				console.log(
					JSON.stringify({
						message: 'Usage data fetched',
						resultCount: results.length,
						errorsCount: results.filter((r) => r.error).length,
						totalQueryDurationMs: results.reduce((sum, r) => sum + (r.queryDurationMs || 0), 0),
					})
				);

				return results;
			}
		);

		// Step 3: Categorize usage results
		const summary = await step.do('categorize-usage', async () => {
			const categorized = categorizeUsage(
				usageResults,
				CONTRACT_CONFIG.alertThresholdPercent,
				CONTRACT_CONFIG.warningThresholdPercent
			);

			console.log(
				JSON.stringify({
					message: 'Usage categorized',
					alerts: categorized.alerts.length,
					warnings: categorized.warnings.length,
					healthy: categorized.healthy.length,
					errors: categorized.errors.length,
				})
			);

			return categorized;
		});

		// Step 4: Send Discord notification if needed
		const notificationResult = await step.do(
			'send-notification',
			{
				retries: {
					limit: 3,
					delay: '5 seconds',
					backoff: 'exponential',
				},
				timeout: '30 seconds',
			},
			async () => {
				const webhookUrl = this.env.DISCORD_WEBHOOK_URL;

				if (!webhookUrl) {
					console.log('No Discord webhook URL configured - skipping notification');
					return { sent: false, error: 'No webhook URL configured' };
				}

				const shouldNotify =
					summary.alerts.length > 0 || summary.warnings.length > 0 || params.forceNotify;

				if (!shouldNotify) {
					console.log('No alerts or warnings - skipping notification');
					return { sent: false };
				}

				console.log(
					JSON.stringify({
						message: 'Sending Discord notification',
						alertCount: summary.alerts.length,
						warningCount: summary.warnings.length,
						forceNotify: params.forceNotify,
						filters: DEFAULT_WORKFLOW_FILTERS,
					})
				);

				const result = await sendDiscordNotification(webhookUrl, summary, {
					alwaysNotify: params.forceNotify,
					filters: DEFAULT_WORKFLOW_FILTERS,
				});

				return { sent: result.success, error: result.error };
			}
		);

		// Log final result
		console.log(
			JSON.stringify({
				message: 'Workflow completed',
				instanceId: event.instanceId,
				alertCount: summary.alerts.length,
				warningCount: summary.warnings.length,
				notificationSent: notificationResult.sent,
			})
		);

		return {
			summary,
			notificationSent: notificationResult.sent,
			notificationError: notificationResult.error,
		};
	}
}
