/**
 * Notification Types
 *
 * Common types for all notification providers (Discord, Slack, etc.)
 */

import type { ProductUsageResult, UsageSummary } from '../products/types';

/**
 * Result of sending a notification
 */
export interface NotificationResult {
	success: boolean;
	provider: string;
	error?: string;
	/** Response status code if applicable */
	statusCode?: number;
	/** Time taken to send notification in ms */
	durationMs?: number;
}

/**
 * Filter information to display in notifications
 */
export interface NotificationFilterInfo {
	/** Whether eyeball-only filter was applied */
	eyeballOnly?: boolean;
	/** Whether edge workers were excluded */
	excludeEdgeWorkers?: boolean;
	/** Whether blocked requests were excluded */
	excludeBlocked?: boolean;
}

/**
 * Options for sending notifications
 */
export interface NotificationOptions {
	/** Send notification even if there are no alerts or warnings */
	alwaysNotify?: boolean;
	/** Include healthy products in the notification */
	includeHealthy?: boolean;
	/** Add @here or equivalent mention for critical alerts */
	mentionOnCritical?: boolean;
	/** Filter information to display in notifications */
	filters?: NotificationFilterInfo;
}

/**
 * Notification provider interface
 * All notification providers must implement this interface
 */
export interface NotificationProvider {
	/** Unique identifier for this provider */
	readonly name: string;

	/** Human-readable display name */
	readonly displayName: string;

	/**
	 * Send a usage notification
	 */
	sendNotification(
		webhookUrl: string,
		summary: UsageSummary,
		options?: NotificationOptions
	): Promise<NotificationResult>;

	/**
	 * Send a test notification to verify configuration
	 */
	sendTestNotification(webhookUrl: string): Promise<NotificationResult>;

	/**
	 * Validate webhook URL format
	 */
	validateWebhookUrl(url: string): boolean;
}

/**
 * Color codes for notification severity
 */
export const NOTIFICATION_COLORS = {
	ALERT: 0xff0000, // Red
	WARNING: 0xffa500, // Orange
	HEALTHY: 0x00ff00, // Green
	INFO: 0x0099ff, // Blue
	ERROR: 0x808080, // Gray
} as const;


