/**
 * Discord Webhook Notifications
 *
 * DEPRECATED: This file is maintained for backwards compatibility.
 * Please use the modular notification system from './notifications' instead.
 *
 * @deprecated Use `import { discordProvider, sendDiscordNotification } from './notifications'` instead
 */

// Re-export everything from the new modular notification system
export {
	// Provider
	discordProvider,
	// Backwards compatible functions
	sendDiscordNotification,
	// New modular functions (for gradual migration)
	sendNotification,
	sendTestNotification,
	sendTestNotificationAuto,
	// Types
	type NotificationResult,
	type NotificationOptions,
	type NotificationProvider,
	NOTIFICATION_COLORS,
} from './notifications';

// Re-export the old types for backwards compatibility
export type { DiscordEmbed, DiscordWebhookPayload } from './notifications/discord';

// Legacy export - sendTestNotification from old API
// Note: The new API uses sendTestNotification(providerName, webhookUrl)
// This wrapper maintains the old signature
import { discordProvider } from './notifications';

/**
 * Send a test notification to verify webhook configuration
 * @deprecated Use `sendTestNotificationAuto(webhookUrl)` or `discordProvider.sendTestNotification(webhookUrl)` instead
 */
export async function sendTestNotificationLegacy(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
	const result = await discordProvider.sendTestNotification(webhookUrl);
	return { success: result.success, error: result.error };
}
