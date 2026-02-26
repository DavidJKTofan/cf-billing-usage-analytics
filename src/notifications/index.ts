/**
 * Notification System
 *
 * Modular notification system supporting multiple providers (Discord, Slack, etc.)
 * This is the main entry point for sending notifications.
 */

import type { UsageSummary } from '../products/types';
import type { NotificationProvider, NotificationResult, NotificationOptions } from './types';
import { discordProvider } from './discord';

// Re-export types and utilities
export * from './types';
export { discordProvider } from './discord';

/**
 * Registry of available notification providers
 */
export const providers: Record<string, NotificationProvider> = {
	discord: discordProvider,
	// Future providers:
	// slack: slackProvider,
	// teams: teamsProvider,
	// email: emailProvider,
	// pagerduty: pagerdutyProvider,
};

/**
 * Get a provider by name
 */
export function getProvider(name: string): NotificationProvider | undefined {
	return providers[name.toLowerCase()];
}

/**
 * Get list of available provider names
 */
export function getAvailableProviders(): string[] {
	return Object.keys(providers);
}

/**
 * Detect provider from webhook URL
 */
export function detectProviderFromUrl(webhookUrl: string): NotificationProvider | undefined {
	for (const provider of Object.values(providers)) {
		if (provider.validateWebhookUrl(webhookUrl)) {
			return provider;
		}
	}
	return undefined;
}

/**
 * Send notification using a specific provider
 */
export async function sendNotification(
	providerName: string,
	webhookUrl: string,
	summary: UsageSummary,
	options?: NotificationOptions
): Promise<NotificationResult> {
	const provider = getProvider(providerName);

	if (!provider) {
		return {
			success: false,
			provider: providerName,
			error: `Unknown provider: ${providerName}. Available providers: ${getAvailableProviders().join(', ')}`,
		};
	}

	if (!provider.validateWebhookUrl(webhookUrl)) {
		return {
			success: false,
			provider: providerName,
			error: `Invalid webhook URL for ${provider.displayName}`,
		};
	}

	return provider.sendNotification(webhookUrl, summary, options);
}

/**
 * Send notification with auto-detected provider
 */
export async function sendNotificationAuto(
	webhookUrl: string,
	summary: UsageSummary,
	options?: NotificationOptions
): Promise<NotificationResult> {
	const provider = detectProviderFromUrl(webhookUrl);

	if (!provider) {
		return {
			success: false,
			provider: 'unknown',
			error: `Could not detect provider from webhook URL. Supported providers: ${getAvailableProviders().join(', ')}`,
		};
	}

	return provider.sendNotification(webhookUrl, summary, options);
}

/**
 * Send test notification using a specific provider
 */
export async function sendTestNotification(providerName: string, webhookUrl: string): Promise<NotificationResult> {
	const provider = getProvider(providerName);

	if (!provider) {
		return {
			success: false,
			provider: providerName,
			error: `Unknown provider: ${providerName}. Available providers: ${getAvailableProviders().join(', ')}`,
		};
	}

	if (!provider.validateWebhookUrl(webhookUrl)) {
		return {
			success: false,
			provider: providerName,
			error: `Invalid webhook URL for ${provider.displayName}`,
		};
	}

	return provider.sendTestNotification(webhookUrl);
}

/**
 * Send test notification with auto-detected provider
 */
export async function sendTestNotificationAuto(webhookUrl: string): Promise<NotificationResult> {
	const provider = detectProviderFromUrl(webhookUrl);

	if (!provider) {
		return {
			success: false,
			provider: 'unknown',
			error: `Could not detect provider from webhook URL. Supported providers: ${getAvailableProviders().join(', ')}`,
		};
	}

	return provider.sendTestNotification(webhookUrl);
}

/**
 * Backwards compatibility exports
 * These match the old discord.ts API for easy migration
 */
export async function sendDiscordNotification(
	webhookUrl: string,
	summary: UsageSummary,
	options?: NotificationOptions
): Promise<{ success: boolean; error?: string }> {
	const result = await discordProvider.sendNotification(webhookUrl, summary, options);
	return { success: result.success, error: result.error };
}
