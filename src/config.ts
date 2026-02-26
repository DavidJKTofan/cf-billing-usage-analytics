/**
 * Contract Caps Configuration
 *
 * This file provides the configuration layer that bridges the product registry
 * with user-configurable settings (limits, thresholds, billing periods).
 *
 * IMPORTANT: GraphQL Analytics provides observational metrics, not exact billing data.
 * Billable traffic may differ (e.g., DDoS traffic is excluded from billing).
 * Use these as approximations for alerting purposes.
 */

import {
	ProductDefinition,
	ProductConfig,
	ProductRuntime,
	ProductCategory,
} from './products/types';
import {
	getAllProducts,
	getProductById,
	getDefaultEnabledProducts,
	CATEGORY_NAMES,
} from './products/registry';

/**
 * Global configuration for monitoring
 */
export interface ContractConfig {
	/** Alert threshold percentage (0-100). Default: 90 means alert at 90% usage */
	alertThresholdPercent: number;

	/** Warning threshold percentage (0-100). Default: 75 means warn at 75% usage */
	warningThresholdPercent: number;

	/** Per-product overrides (limits, enabled state) */
	productOverrides: Record<string, ProductConfig>;

	/** Billing period configuration */
	billingPeriod: {
		/** Day of month when billing period starts (1-28) */
		startDay: number;
		/** Timezone for billing calculations */
		timezone: string;
	};
}

/**
 * Default contract configuration
 *
 * CUSTOMIZE THIS for your Enterprise contract!
 * Products use default limits from the registry unless overridden here.
 */
export const CONTRACT_CONFIG: ContractConfig = {
	alertThresholdPercent: 90,
	warningThresholdPercent: 75,

	billingPeriod: {
		startDay: 1, // First of the month
		timezone: 'UTC',
	},

	// Override default limits or enable/disable specific products
	// CUSTOMIZE THESE VALUES based on your Enterprise contract!
	productOverrides: {
		// HTTP Requests: 3 million per billing period
		http_requests: { limit: 3_000_000, enabled: true },

		// Bandwidth: 20 GB per billing period
		bandwidth: { limit: 20 * 1024 * 1024 * 1024, enabled: true }, // 20 GB in bytes

		// Workers AI Requests: 35,000 per billing period
		workers_ai_requests: { limit: 35_000, enabled: true },

		// Example: Override Workers request limit
		// workers_requests: { limit: 50_000_000, enabled: true },

		// Example: Enable D1 monitoring with custom limit
		// d1_rows_read: { limit: 10_000_000_000, enabled: true },

		// Example: Disable a product
		// stream_minutes_viewed: { enabled: false },
	},
};

/**
 * Merge a product definition with user overrides to create runtime config
 */
export function mergeProductConfig(
	definition: ProductDefinition,
	override?: ProductConfig,
	defaultZoneTags?: string[]
): ProductRuntime {
	return {
		...definition,
		limit: override?.limit ?? definition.defaultLimit,
		enabled: override?.enabled ?? definition.enabledByDefault,
		zoneTags: override?.zoneTags ?? (definition.scope === 'zone' ? defaultZoneTags : undefined),
	};
}

/**
 * Get all products with their runtime configuration
 */
export function getConfiguredProducts(
	config: ContractConfig,
	defaultZoneTags: string[] = []
): ProductRuntime[] {
	return getAllProducts().map((product) =>
		mergeProductConfig(product, config.productOverrides[product.id], defaultZoneTags)
	);
}

/**
 * Get only enabled products with runtime configuration
 */
export function getEnabledProducts(
	config: ContractConfig,
	defaultZoneTags: string[] = []
): ProductRuntime[] {
	return getConfiguredProducts(config, defaultZoneTags).filter((p) => p.enabled);
}

/**
 * Get products grouped by category
 */
export function getProductsByCategory(
	config: ContractConfig,
	defaultZoneTags: string[] = []
): Record<ProductCategory, ProductRuntime[]> {
	const products = getEnabledProducts(config, defaultZoneTags);
	const grouped = {} as Record<ProductCategory, ProductRuntime[]>;

	for (const product of products) {
		if (!grouped[product.category]) {
			grouped[product.category] = [];
		}
		grouped[product.category].push(product);
	}

	return grouped;
}

/**
 * Get the current billing period start and end dates
 */
export function getCurrentBillingPeriod(config: ContractConfig): {
	start: Date;
	end: Date;
} {
	const now = new Date();
	const startDay = config.billingPeriod.startDay;

	// Calculate start of current billing period
	let start = new Date(now.getFullYear(), now.getMonth(), startDay, 0, 0, 0, 0);

	// If we're before the start day, go back to previous month
	if (now.getDate() < startDay) {
		start = new Date(now.getFullYear(), now.getMonth() - 1, startDay, 0, 0, 0, 0);
	}

	// End is start + 1 month
	const end = new Date(start);
	end.setMonth(end.getMonth() + 1);

	return { start, end };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
	return num.toLocaleString('en-US');
}

/**
 * Format value based on unit type
 * @param value - The numeric value to format
 * @param unit - The unit type (e.g., 'bytes', 'requests')
 * @param unlimited - If true, returns "Unlimited" regardless of value
 */
export function formatValue(value: number, unit: string, unlimited?: boolean): string {
	if (unlimited) {
		return 'Unlimited';
	}
	if (unit === 'bytes') {
		return formatBytes(value);
	}
	return `${formatNumber(Math.round(value))} ${unit}`;
}

// Re-export useful registry functions and types
export {
	getAllProducts,
	getProductById,
	getDefaultEnabledProducts,
	CATEGORY_NAMES,
};
export type {
	ProductDefinition,
	ProductConfig,
	ProductRuntime,
	ProductCategory,
};
