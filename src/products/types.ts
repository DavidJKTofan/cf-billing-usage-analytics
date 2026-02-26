/**
 * Product Types
 *
 * Type definitions for monitored Cloudflare products.
 * This module provides the foundation for the modular product registry.
 */

/**
 * Product category for grouping in the UI
 */
export type ProductCategory =
	| 'compute' // Workers, Pages, Durable Objects
	| 'storage' // R2, KV, D1
	| 'network' // CDN, DNS, Load Balancing
	| 'security' // WAF, Bot Management, DDoS
	| 'media' // Stream, Images
	| 'ai' // Workers AI, AI Gateway, Vectorize
	| 'connectivity' // Tunnels, WARP, Gateway
	| 'platform'; // Email Routing, Zaraz, Logpush, Web Analytics

/**
 * Scope of the metric - determines which GraphQL query to use
 */
export type ProductScope = 'zone' | 'account';

/**
 * Aggregation type for the metric
 * - 'sum': The field is nested under `sum { field }` (e.g., sum.edgeResponseBytes)
 * - 'count': The field is at the top level as `count` (e.g., httpRequestsAdaptiveGroups.count)
 * - 'avg': The field is nested under `avg { field }`
 * - 'max': The field is nested under `max { field }` (e.g., R2 storage uses max.payloadSize)
 */
export type AggregationType = 'sum' | 'count' | 'avg' | 'max';

/**
 * Product definition for monitoring
 */
export interface ProductDefinition {
	/** Unique identifier for the product */
	id: string;

	/** Human-readable name for display */
	name: string;

	/** Product category for grouping */
	category: ProductCategory;

	/** Brief description of what this metric measures */
	description: string;

	/** Default monthly limit (can be overridden by user config) */
	defaultLimit: number;

	/** Unit of measurement */
	unit: string;

	/** GraphQL dataset name */
	dataset: string;

	/** Field to sum/aggregate from the dataset */
	field: string;

	/** Whether this is zone-scoped or account-scoped */
	scope: ProductScope;

	/** How to aggregate the field (default: 'sum') */
	aggregation?: AggregationType;

	/** Filter field for datetime queries (most use 'datetime', some use 'date', some use 'datetimeHour') */
	filterField?: 'datetime' | 'date' | 'datetimeHour';

	/** Whether this product is enabled by default */
	enabledByDefault: boolean;

	/** Cloudflare documentation URL for this product */
	docsUrl?: string;

	/** Transformation to apply to the raw value (e.g., microseconds to milliseconds) */
	transform?: (value: number) => number;

	/** Whether this product has unlimited usage (free/included, no caps) */
	unlimited?: boolean;

	/** Note/caveat to display in the dashboard (explains differences or caveats) */
	note?: string;

	/**
	 * Additional dimension filters for the GraphQL query.
	 * Used to filter by specific dimension values (e.g., R2 actionType for Class A vs Class B operations).
	 * Format: { dimensionName: value[] } where value can be string or string[]
	 * Example: { actionType_in: ['PutObject', 'DeleteObject'] }
	 */
	dimensionFilters?: Record<string, string | string[]>;
}

/**
 * User-configurable product settings
 */
export interface ProductConfig {
	/** Override the default limit */
	limit?: number;

	/** Enable or disable monitoring for this product */
	enabled?: boolean;

	/** Specific zone tags for zone-scoped products */
	zoneTags?: string[];
}

/**
 * Runtime product configuration (merged definition + user config)
 */
export interface ProductRuntime extends ProductDefinition {
	/** Final limit to use (user override or default) */
	limit: number;

	/** Whether monitoring is enabled */
	enabled: boolean;

	/** Zone tags for zone-scoped products */
	zoneTags?: string[];
}

/**
 * Confidence interval data from GraphQL adaptive sampling
 * @see https://developers.cloudflare.com/analytics/graphql-api/features/confidence-intervals/
 */
export interface ConfidenceInterval {
	/** Estimated value of this metric */
	estimate: number;
	/** Lower bound of the confidence interval */
	lower: number;
	/** Upper bound of the confidence interval */
	upper: number;
	/** Number of samples that contributed to the estimate */
	sampleSize: number;
	/** Whether the confidence interval is valid (enough samples at low enough sample interval) */
	isValid: boolean;
	/** Confidence level used (e.g., 0.95 for 95%) */
	level: number;
	/**
	 * Confidence percentage (0-100) indicating how tight the estimate is.
	 * Higher values (closer to 100) indicate more accurate estimates.
	 * Calculated as: 100 - ((upper - lower) / estimate * 100 / 2)
	 */
	confidencePercent?: number;
}

/**
 * Result of querying a product's usage
 */
export interface ProductUsageResult {
	productId: string;
	productName: string;
	category: ProductCategory;
	currentUsage: number;
	limit: number;
	unit: string;
	percentUsed: number;
	billingPeriodStart: string;
	billingPeriodEnd: string;
	scope: ProductScope;
	error?: string;
	queryDurationMs?: number;
	/** Note/caveat about this product metric */
	note?: string;
	/** Whether the product is enabled for monitoring (used for dashboard display) */
	enabled?: boolean;
	/** Whether the product has unlimited usage (free/included, no caps) */
	unlimited?: boolean;
	/**
	 * Confidence interval data for sampled metrics.
	 * Only available for adaptive (sampled) datasets.
	 * @see https://developers.cloudflare.com/analytics/graphql-api/features/confidence-intervals/
	 */
	confidence?: ConfidenceInterval;
}

/**
 * Summary of all product usage
 */
export interface UsageSummary {
	alerts: ProductUsageResult[];
	warnings: ProductUsageResult[];
	healthy: ProductUsageResult[];
	errors: ProductUsageResult[];
	timestamp: string;
	totalQueryDurationMs: number;
}
