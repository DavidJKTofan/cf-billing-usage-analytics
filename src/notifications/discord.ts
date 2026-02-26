/**
 * Discord Notification Provider
 *
 * Sends formatted notifications to Discord webhooks.
 */

import type { ProductUsageResult, UsageSummary } from '../products/types';
import { formatValue, CONTRACT_CONFIG, getEnabledProducts } from '../config';
import type { NotificationProvider, NotificationResult, NotificationOptions } from './types';
import { NOTIFICATION_COLORS } from './types';

/**
 * Discord embed structure
 */
export interface DiscordEmbed {
	title: string;
	description?: string;
	color: number;
	fields: Array<{
		name: string;
		value: string;
		inline?: boolean;
	}>;
	footer?: {
		text: string;
	};
	timestamp?: string;
}

/**
 * Discord webhook payload structure
 */
export interface DiscordWebhookPayload {
	content?: string;
	username?: string;
	avatar_url?: string;
	embeds?: DiscordEmbed[];
}

/**
 * Create a visual progress bar using Discord emoji
 */
function createProgressBar(percent: number): string {
	const filled = Math.min(Math.round(percent / 10), 10);
	const empty = 10 - filled;

	let bar = '';
	for (let i = 0; i < filled; i++) {
		if (percent >= 90) {
			bar += ':red_square:';
		} else if (percent >= 75) {
			bar += ':orange_square:';
		} else {
			bar += ':green_square:';
		}
	}
	for (let i = 0; i < empty; i++) {
		bar += ':white_large_square:';
	}

	return bar;
}

/**
 * Format a usage result into a Discord embed field
 */
function formatUsageField(result: ProductUsageResult): { name: string; value: string; inline: boolean } {
	const progressBar = createProgressBar(result.percentUsed);
	const currentFormatted = formatValue(result.currentUsage, result.unit);
	const limitFormatted = formatValue(result.limit, result.unit);

	return {
		name: result.productName,
		value: `${progressBar} **${result.percentUsed.toFixed(1)}%**\n${currentFormatted} / ${limitFormatted}`,
		inline: true,
	};
}

/**
 * Build an alert embed for critical usage
 */
function buildAlertEmbed(alerts: ProductUsageResult[]): DiscordEmbed {
	return {
		title: ':rotating_light: ALERT: Usage Approaching Contract Limits',
		description: `**${alerts.length} product(s)** have exceeded **${CONTRACT_CONFIG.alertThresholdPercent}%** of their contract limits!`,
		color: NOTIFICATION_COLORS.ALERT,
		fields: alerts.map(formatUsageField),
		footer: {
			text: 'Cloudflare Usage Monitor',
		},
		timestamp: new Date().toISOString(),
	};
}

/**
 * Build a warning embed for elevated usage
 */
function buildWarningEmbed(warnings: ProductUsageResult[]): DiscordEmbed {
	return {
		title: ':warning: Warning: Elevated Usage Detected',
		description: `**${warnings.length} product(s)** have exceeded **${CONTRACT_CONFIG.warningThresholdPercent}%** of their contract limits.`,
		color: NOTIFICATION_COLORS.WARNING,
		fields: warnings.map(formatUsageField),
		footer: {
			text: 'Cloudflare Usage Monitor',
		},
		timestamp: new Date().toISOString(),
	};
}

/**
 * Build an error embed for failed queries
 */
function buildErrorEmbed(errors: ProductUsageResult[]): DiscordEmbed {
	return {
		title: ':x: Query Errors',
		description: `Failed to fetch usage data for **${errors.length} product(s)**.`,
		color: NOTIFICATION_COLORS.ERROR,
		fields: errors.map((e) => ({
			name: e.productName,
			value: `Error: ${e.error || 'Unknown error'}`,
			inline: false,
		})),
		footer: {
			text: 'Cloudflare Usage Monitor',
		},
		timestamp: new Date().toISOString(),
	};
}

/**
 * Build a summary embed with optional filter info
 */
function buildSummaryEmbed(summary: UsageSummary, options: NotificationOptions = {}): DiscordEmbed {
	const totalProducts = summary.alerts.length + summary.warnings.length + summary.healthy.length;

	// Build filter description if filters are applied
	let filterDescription = '';
	if (options.filters) {
		const activeFilters: string[] = [];
		if (options.filters.eyeballOnly) {
			activeFilters.push('eyeball traffic only');
		}
		if (options.filters.excludeBlocked) {
			activeFilters.push('blocked requests excluded');
		}
		if (options.filters.excludeEdgeWorkers) {
			activeFilters.push('edge workers excluded');
		}
		if (activeFilters.length > 0) {
			filterDescription = `\n*Filters: ${activeFilters.join(', ')}*`;
		}
	}

	const embed: DiscordEmbed = {
		title: ':white_check_mark: Usage Summary',
		description: `Checked **${totalProducts} products** for usage against contract limits.${filterDescription}`,
		color:
			summary.alerts.length > 0
				? NOTIFICATION_COLORS.ALERT
				: summary.warnings.length > 0
					? NOTIFICATION_COLORS.WARNING
					: NOTIFICATION_COLORS.HEALTHY,
		fields: [
			{
				name: ':rotating_light: Alerts',
				value: `${summary.alerts.length} products`,
				inline: true,
			},
			{
				name: ':warning: Warnings',
				value: `${summary.warnings.length} products`,
				inline: true,
			},
			{
				name: ':white_check_mark: Healthy',
				value: `${summary.healthy.length} products`,
				inline: true,
			},
		],
		footer: {
			text: `Billing Period: ${new Date(summary.alerts[0]?.billingPeriodStart || summary.healthy[0]?.billingPeriodStart || Date.now()).toLocaleDateString()} - ${new Date(summary.alerts[0]?.billingPeriodEnd || summary.healthy[0]?.billingPeriodEnd || Date.now()).toLocaleDateString()}`,
		},
		timestamp: summary.timestamp,
	};

	// Add top usage products if there are any warnings or alerts
	const topProducts = [...summary.alerts, ...summary.warnings].slice(0, 3);
	if (topProducts.length > 0) {
		embed.fields.push({
			name: '\u200B', // Zero-width space for separator
			value: '**Top Products by Usage:**',
			inline: false,
		});
		topProducts.forEach((p) => {
			embed.fields.push(formatUsageField(p));
		});
	}

	return embed;
}

/**
 * Discord notification provider implementation
 */
export const discordProvider: NotificationProvider = {
	name: 'discord',
	displayName: 'Discord',

	validateWebhookUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			return (
				parsed.hostname === 'discord.com' ||
				parsed.hostname === 'discordapp.com' ||
				parsed.hostname.endsWith('.discord.com')
			);
		} catch {
			return false;
		}
	},

	async sendNotification(
		webhookUrl: string,
		summary: UsageSummary,
		options: NotificationOptions = {}
	): Promise<NotificationResult> {
		const startTime = Date.now();

		try {
			const embeds: DiscordEmbed[] = [];

			// Add alert embed if there are critical issues
			if (summary.alerts.length > 0) {
				embeds.push(buildAlertEmbed(summary.alerts));
			}

			// Add warning embed if there are warnings
			if (summary.warnings.length > 0) {
				embeds.push(buildWarningEmbed(summary.warnings));
			}

			// Filter out known/expected errors (datasets not available for disabled products)
			// Only show errors that are unexpected (e.g., API failures, rate limits)
			const significantErrors = summary.errors.filter((e) => {
				const error = e.error || '';
				// Filter out "unknown field" errors - these are expected for disabled products
				if (error.includes('unknown field')) return false;
				// Filter out "time range is too large" errors - expected for products with limited retention
				if (error.includes('time range is too large')) return false;
				// Filter out "unknown arg" errors - expected for datasets with different filter fields
				if (error.includes('unknown arg')) return false;
				return true;
			});

			// Add error embed if there were significant query failures
			if (significantErrors.length > 0) {
				embeds.push(buildErrorEmbed(significantErrors));
			}

			// Skip notification if no alerts/warnings and not always notifying
			if (embeds.length === 0 && !options.alwaysNotify) {
				console.log('[Discord] No alerts or warnings - skipping notification');
				return {
					success: true,
					provider: 'discord',
					durationMs: Date.now() - startTime,
				};
			}

			// Add summary embed with filter info
			embeds.push(buildSummaryEmbed(summary, options));

			// Discord allows max 10 embeds per message
			if (embeds.length > 10) {
				embeds.splice(10);
			}

			const payload: DiscordWebhookPayload = {
				username: 'Cloudflare Usage Monitor',
				avatar_url: 'https://www.cloudflare.com/favicon.ico',
				embeds,
			};

			// Add @here mention for critical alerts
			if (summary.alerts.length > 0 && options.mentionOnCritical !== false) {
				payload.content = '@here :rotating_light: **Critical usage alert!**';
			}

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
			}

			console.log('[Discord] Notification sent successfully');
			return {
				success: true,
				provider: 'discord',
				statusCode: response.status,
				durationMs: Date.now() - startTime,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error('[Discord] Failed to send notification:', errorMessage);
			return {
				success: false,
				provider: 'discord',
				error: errorMessage,
				durationMs: Date.now() - startTime,
			};
		}
	},

	async sendTestNotification(webhookUrl: string): Promise<NotificationResult> {
		const startTime = Date.now();

		try {
			const enabledProducts = getEnabledProducts(CONTRACT_CONFIG);

			const payload: DiscordWebhookPayload = {
				username: 'Cloudflare Usage Monitor',
				avatar_url: 'https://www.cloudflare.com/favicon.ico',
				embeds: [
					{
						title: ':test_tube: Test Notification',
						description:
							'This is a test notification from the Cloudflare Usage Monitor. If you see this, your Discord webhook is configured correctly!',
						color: NOTIFICATION_COLORS.INFO,
						fields: [
							{
								name: 'Alert Threshold',
								value: `${CONTRACT_CONFIG.alertThresholdPercent}%`,
								inline: true,
							},
							{
								name: 'Warning Threshold',
								value: `${CONTRACT_CONFIG.warningThresholdPercent}%`,
								inline: true,
							},
							{
								name: 'Products Monitored',
								value: `${enabledProducts.length}`,
								inline: true,
							},
						],
						footer: {
							text: 'Cloudflare Usage Monitor - Test',
						},
						timestamp: new Date().toISOString(),
					},
				],
			};

			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
			}

			return {
				success: true,
				provider: 'discord',
				statusCode: response.status,
				durationMs: Date.now() - startTime,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				provider: 'discord',
				error: errorMessage,
				durationMs: Date.now() - startTime,
			};
		}
	},
};
