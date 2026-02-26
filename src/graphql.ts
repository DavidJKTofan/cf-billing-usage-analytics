/**
 * GraphQL Analytics API Client
 *
 * Queries Cloudflare's GraphQL Analytics API to fetch usage metrics
 * for various products.
 *
 * IMPORTANT: GraphQL Analytics data is observational/sampled and should NOT
 * be used as a measure for actual billing. Billable traffic excludes things
 * like DDoS traffic. Use these as approximations for monitoring purposes.
 */

import type { ProductRuntime, ProductUsageResult, UsageSummary, AggregationType, ConfidenceInterval } from './products/types';
import { getCurrentBillingPeriod, getEnabledProducts, getConfiguredProducts, CONTRACT_CONFIG } from './config';

const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

/**
 * Filter options for queries
 *
 * These filters help approximate billable traffic by excluding:
 * - Non-eyeball traffic (internal Cloudflare requests, Workers subrequests)
 * - Edge Workers traffic (requests from Cloudflare Workers at the edge)
 * - Blocked requests (403 status codes from security systems)
 *
 * Note: This is an approximation - actual billing uses different data sources.
 */
export interface QueryFilterOptions {
	/**
	 * Filter to only include "eyeball" (real visitor) requests.
	 * Excludes internal Cloudflare traffic and Workers subrequests.
	 * Only applies to httpRequestsAdaptiveGroups and firewallEventsAdaptiveGroups datasets.
	 */
	eyeballOnly?: boolean;

	/**
	 * Exclude requests originating from Cloudflare Workers at the edge.
	 * Workers can make fetch() calls that appear as "edgeworker" request source.
	 * Only applies to httpRequestsAdaptiveGroups and firewallEventsAdaptiveGroups datasets.
	 */
	excludeEdgeWorkers?: boolean;

	/**
	 * Exclude requests blocked by Cloudflare security (403 status).
	 * Helps approximate billable traffic by excluding blocked attacks/bots.
	 * Only applies to datasets with edgeResponseStatus field.
	 */
	excludeBlocked?: boolean;

	/**
	 * Filter to a specific zone ID. When set:
	 * - Only zone-scoped products are queried for this specific zone
	 * - Account-scoped products are hidden from results
	 * When not set (default), all zones are included (account-wide view).
	 */
	zoneId?: string;
}

export interface GraphQLResponse<T> {
	data: T;
	errors?: Array<{
		message: string;
		path?: string[];
		extensions?: Record<string, unknown>;
	}>;
}

// Re-export types for backwards compatibility
export type { ProductUsageResult as UsageResult, UsageSummary };

/**
 * Execute a GraphQL query against Cloudflare's API
 */
async function executeGraphQL<T>(
	apiToken: string,
	query: string,
	variables: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
	const response = await fetch(GRAPHQL_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiToken}`,
		},
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

/**
 * Confidence level for interval calculations (95% confidence)
 * @see https://developers.cloudflare.com/analytics/graphql-api/features/confidence-intervals/
 */
const CONFIDENCE_LEVEL = 0.95;

/**
 * Datasets that do NOT support confidence intervals.
 * These datasets don't have the confidence() field in their schema.
 */
const NO_CONFIDENCE_DATASETS = [
	'cacheReserveStorageAdaptiveGroups', // Only has avg, dimensions, max - no confidence
	'durableObjectsStorageGroups', // Only has max, dimensions - no confidence
];

/**
 * Build the aggregation fields part of the query based on aggregation type.
 * Includes confidence interval fields for sampled datasets that support it.
 *
 * @see https://developers.cloudflare.com/analytics/graphql-api/features/confidence-intervals/
 */
function buildAggregationFields(field: string, aggregation: AggregationType, includeConfidence: boolean = true): string {
	// Build confidence block only if supported
	const buildConfidenceBlock = (aggType: string, fieldName: string) => {
		if (!includeConfidence) return '';
		const isCount = aggType === 'count';
		return `
				confidence(level: ${CONFIDENCE_LEVEL}) {
					level
					${aggType} {
						${!isCount ? `${fieldName} {` : ''}
						estimate
						lower
						upper
						sampleSize
						isValid
						${!isCount ? '}' : ''}
					}
				}`;
	};

	switch (aggregation) {
		case 'count':
			// Count is a top-level field, field name is ignored (always 'count')
			return `count${buildConfidenceBlock('count', '')}`;
		case 'avg':
			return `avg { ${field} }${buildConfidenceBlock('avg', field)}`;
		case 'max':
			return `max { ${field} }${buildConfidenceBlock('max', field)}`;
		case 'sum':
		default:
			return `sum { ${field} }${buildConfidenceBlock('sum', field)}`;
	}
}

/**
 * Datasets that support the requestSource filter (eyeball/edgeworker traffic)
 * Note: This filter is specific to httpRequestsAdaptiveGroups.
 * firewallEventsAdaptiveGroups does NOT support requestSource filter.
 */
const REQUEST_SOURCE_SUPPORTED_DATASETS = [
	'httpRequestsAdaptiveGroups',
];

/**
 * Datasets that support the edgeResponseStatus filter
 * Note: This filter is specific to httpRequestsAdaptiveGroups.
 * firewallEventsAdaptiveGroups does NOT have edgeResponseStatus field.
 */
const STATUS_FILTER_SUPPORTED_DATASETS = [
	'httpRequestsAdaptiveGroups',
];

/**
 * Build additional filter conditions based on filter options
 */
function buildAdditionalFilters(dataset: string, filters?: QueryFilterOptions): string {
	if (!filters) return '';

	const conditions: string[] = [];

	// Only add eyeball filter for supported datasets
	if (filters.eyeballOnly && REQUEST_SOURCE_SUPPORTED_DATASETS.includes(dataset)) {
		conditions.push('requestSource: "eyeball"');
	}

	// Exclude edge workers (Workers fetch() calls) for supported datasets
	// Note: This is separate from eyeballOnly - you might want eyeball traffic
	// but still exclude Workers-originated requests
	if (filters.excludeEdgeWorkers && REQUEST_SOURCE_SUPPORTED_DATASETS.includes(dataset)) {
		conditions.push('requestSource_neq: "edgeworker"');
	}

	// Only add status filter for supported datasets
	if (filters.excludeBlocked && STATUS_FILTER_SUPPORTED_DATASETS.includes(dataset)) {
		conditions.push('edgeResponseStatus_neq: 403');
	}

	return conditions.length > 0 ? `, ${conditions.join(', ')}` : '';
}

/**
 * Build dimension filter conditions for the GraphQL query
 * Used for filtering by specific dimension values (e.g., R2 actionType)
 *
 * @param dimensionFilters - Record of dimension filter conditions
 * @returns GraphQL filter string (e.g., ', actionType_in: ["PutObject", "GetObject"]')
 */
function buildDimensionFilters(dimensionFilters?: Record<string, string | string[]>): string {
	if (!dimensionFilters || Object.keys(dimensionFilters).length === 0) {
		return '';
	}

	const conditions: string[] = [];

	for (const [key, value] of Object.entries(dimensionFilters)) {
		if (Array.isArray(value)) {
			// Array values: actionType_in: ["PutObject", "DeleteObject"]
			const quotedValues = value.map((v) => `"${v}"`).join(', ');
			conditions.push(`${key}: [${quotedValues}]`);
		} else {
			// Single value: actionType: "PutObject"
			conditions.push(`${key}: "${value}"`);
		}
	}

	return conditions.length > 0 ? `, ${conditions.join(', ')}` : '';
}

/**
 * Get the GraphQL filter field names and types based on the filterField
 */
function getFilterConfig(filterField: string): {
	filterStart: string;
	filterEnd: string;
	graphqlType: string;
} {
	switch (filterField) {
		case 'date':
			return { filterStart: 'date_geq', filterEnd: 'date_lt', graphqlType: 'Date' };
		case 'datetimeHour':
			return { filterStart: 'datetimeHour_geq', filterEnd: 'datetimeHour_lt', graphqlType: 'Time' };
		case 'datetime':
		default:
			return { filterStart: 'datetime_geq', filterEnd: 'datetime_lt', graphqlType: 'Time' };
	}
}

/**
 * Build a zone-scoped GraphQL query for aggregated data
 */
function buildZoneQuery(
	dataset: string,
	field: string,
	aggregation: AggregationType = 'sum',
	filterField: string = 'datetime',
	filters?: QueryFilterOptions,
	dimensionFilters?: Record<string, string | string[]>
): string {
	const { filterStart, filterEnd, graphqlType } = getFilterConfig(filterField);
	const includeConfidence = !NO_CONFIDENCE_DATASETS.includes(dataset);
	const aggregationFields = buildAggregationFields(field, aggregation, includeConfidence);
	const additionalFilters = buildAdditionalFilters(dataset, filters);
	const dimensionFilterStr = buildDimensionFilters(dimensionFilters);

	return `
    query ZoneUsage($zoneTag: String!, $start: ${graphqlType}!, $end: ${graphqlType}!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          ${dataset}(
            filter: { ${filterStart}: $start, ${filterEnd}: $end${additionalFilters}${dimensionFilterStr} }
            limit: 10000
          ) {
            ${aggregationFields}
          }
        }
      }
    }
  `;
}

/**
 * Build an account-scoped GraphQL query for aggregated data
 */
function buildAccountQuery(
	dataset: string,
	field: string,
	aggregation: AggregationType = 'sum',
	filterField: string = 'datetime',
	filters?: QueryFilterOptions,
	dimensionFilters?: Record<string, string | string[]>
): string {
	const { filterStart, filterEnd, graphqlType } = getFilterConfig(filterField);
	const includeConfidence = !NO_CONFIDENCE_DATASETS.includes(dataset);
	const aggregationFields = buildAggregationFields(field, aggregation, includeConfidence);
	const additionalFilters = buildAdditionalFilters(dataset, filters);
	const dimensionFilterStr = buildDimensionFilters(dimensionFilters);

	return `
    query AccountUsage($accountTag: String!, $start: ${graphqlType}!, $end: ${graphqlType}!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          ${dataset}(
            filter: { ${filterStart}: $start, ${filterEnd}: $end${additionalFilters}${dimensionFilterStr} }
            limit: 10000
          ) {
            ${aggregationFields}
          }
        }
      }
    }
  `;
}

/**
 * Result of extracting value and confidence from GraphQL response
 */
interface ExtractedResult {
	value: number;
	confidence?: ConfidenceInterval;
}

/**
 * Calculate the confidence percentage (how tight the estimate is).
 * Higher values (closer to 99) indicate more accurate estimates.
 *
 * Formula: 100 - ((upper - lower) / estimate * 100 / 2)
 * This gives a percentage where:
 * - Higher % = tighter interval relative to estimate (more accurate)
 * - Lower % = wider interval relative to estimate (less accurate)
 *
 * NOTE: We cap at 99% because:
 * 1. 100% confidence is mathematically impossible for sampled data
 * 2. GraphQL Analytics always uses some form of sampling
 * 3. Displaying 100% would be misleading about data accuracy
 *
 * @see https://developers.cloudflare.com/analytics/graphql-api/features/confidence-intervals/
 */
function calculateConfidencePercent(estimate: number, lower: number, upper: number): number {
	if (estimate === 0 || !isFinite(estimate)) return 99; // No data defaults to max
	const range = upper - lower;
	const relativeRange = (range / estimate) * 100;
	const confidencePercent = 100 - (relativeRange / 2);
	// Cap between 0 and 99 - never show 100% as that implies no sampling uncertainty
	return Math.max(0, Math.min(99, confidencePercent));
}

/**
 * Extract the aggregated value and confidence interval from a GraphQL response
 */
function extractValue(
	data: unknown,
	dataset: string,
	field: string,
	aggregation: AggregationType,
	scope: 'zone' | 'account'
): ExtractedResult {
	try {
		const viewer = (data as Record<string, unknown>).viewer as Record<string, unknown>;
		const scopeKey = scope === 'zone' ? 'zones' : 'accounts';
		const scopeData = viewer[scopeKey] as unknown[];

		if (!scopeData || scopeData.length === 0) {
			return { value: 0 };
		}

		const firstScope = scopeData[0] as Record<string, unknown>;
		const datasetResults = firstScope[dataset] as Array<Record<string, unknown>>;

		if (!datasetResults || datasetResults.length === 0) {
			return { value: 0 };
		}

		// Aggregate values and confidence intervals across all results
		let totalValue = 0;
		let totalEstimate = 0;
		let totalLower = 0;
		let totalUpper = 0;
		let totalSampleSize = 0;
		let hasConfidence = false;
		let confidenceLevel = CONFIDENCE_LEVEL;
		let allValid = true;

		for (const item of datasetResults) {
			let value = 0;

			switch (aggregation) {
				case 'count':
					value = (item.count as number) ?? 0;
					break;
				case 'avg':
					value = (item.avg as Record<string, number>)?.[field] ?? 0;
					break;
				case 'max':
					value = (item.max as Record<string, number>)?.[field] ?? 0;
					break;
				case 'sum':
				default:
					value = (item.sum as Record<string, number>)?.[field] ?? 0;
					break;
			}

			totalValue += value;

			// Extract confidence interval data
			const confidenceData = item.confidence as Record<string, unknown> | undefined;
			if (confidenceData) {
				hasConfidence = true;
				confidenceLevel = (confidenceData.level as number) ?? CONFIDENCE_LEVEL;

				// Get the nested confidence data based on aggregation type
				let nestedConfidence: Record<string, unknown> | undefined;
				switch (aggregation) {
					case 'count':
						nestedConfidence = confidenceData.count as Record<string, unknown>;
						break;
					case 'avg':
						nestedConfidence = (confidenceData.avg as Record<string, Record<string, unknown>>)?.[field];
						break;
					case 'max':
						nestedConfidence = (confidenceData.max as Record<string, Record<string, unknown>>)?.[field];
						break;
					case 'sum':
					default:
						nestedConfidence = (confidenceData.sum as Record<string, Record<string, unknown>>)?.[field];
						break;
				}

				if (nestedConfidence) {
					totalEstimate += (nestedConfidence.estimate as number) ?? 0;
					totalLower += (nestedConfidence.lower as number) ?? 0;
					totalUpper += (nestedConfidence.upper as number) ?? 0;
					totalSampleSize += (nestedConfidence.sampleSize as number) ?? 0;
					if (!(nestedConfidence.isValid as boolean)) {
						allValid = false;
					}
				}
			}
		}

		const result: ExtractedResult = { value: totalValue };

		// Build confidence interval if we have confidence data
		if (hasConfidence && totalEstimate > 0) {
			result.confidence = {
				estimate: totalEstimate,
				lower: totalLower,
				upper: totalUpper,
				sampleSize: totalSampleSize,
				isValid: allValid,
				level: confidenceLevel,
				confidencePercent: calculateConfidencePercent(totalEstimate, totalLower, totalUpper),
			};
		}

		return result;
	} catch (error) {
		console.error(`Failed to extract value for ${dataset}.${field} (${aggregation}):`, error);
		return { value: 0 };
	}
}

/**
 * Format date for GraphQL query based on filter field type
 */
function formatDateForQuery(date: Date, filterField: string = 'datetime'): string {
	if (filterField === 'date') {
		return date.toISOString().split('T')[0]; // YYYY-MM-DD
	}
	return date.toISOString();
}

/**
 * Query usage for a specific product
 */
export async function queryProductUsage(
	apiToken: string,
	accountId: string,
	product: ProductRuntime,
	billingStart: Date,
	billingEnd: Date,
	filters?: QueryFilterOptions
): Promise<ProductUsageResult> {
	const startTime = Date.now();

	const result: ProductUsageResult = {
		productId: product.id,
		productName: product.name,
		category: product.category,
		currentUsage: 0,
		limit: product.limit,
		unit: product.unit,
		percentUsed: 0,
		billingPeriodStart: billingStart.toISOString(),
		billingPeriodEnd: billingEnd.toISOString(),
		scope: product.scope,
		note: product.note,
		unlimited: product.unlimited,
	};

	try {
		const filterField = product.filterField || 'datetime';
		const aggregation = product.aggregation || 'sum';
		const dimensionFilters = product.dimensionFilters;
		const start = formatDateForQuery(billingStart, filterField);
		const end = formatDateForQuery(billingEnd, filterField);

		if (product.scope === 'account') {
			// Account-scoped query
			const query = buildAccountQuery(product.dataset, product.field, aggregation, filterField, filters, dimensionFilters);
			const response = await executeGraphQL<unknown>(apiToken, query, {
				accountTag: accountId,
				start,
				end,
			});

			if (response.errors && response.errors.length > 0) {
				result.error = response.errors.map((e) => e.message).join(', ');
				console.error(`GraphQL errors for ${product.id}:`, response.errors);
			} else {
				const extracted = extractValue(response.data, product.dataset, product.field, aggregation, 'account');
				result.currentUsage = extracted.value;
				result.confidence = extracted.confidence;
			}
		} else {
			// Zone-scoped query - aggregate across all zones
			const zoneTags = product.zoneTags || [];

			if (zoneTags.length === 0) {
				result.error = 'No zone tags configured';
			} else {
				// Aggregate confidence data across zones
				let totalEstimate = 0;
				let totalLower = 0;
				let totalUpper = 0;
				let totalSampleSize = 0;
				let hasConfidence = false;
				let allValid = true;
				let confidenceLevel = CONFIDENCE_LEVEL;

				for (const zoneTag of zoneTags) {
					const query = buildZoneQuery(product.dataset, product.field, aggregation, filterField, filters, dimensionFilters);
					const response = await executeGraphQL<unknown>(apiToken, query, {
						zoneTag,
						start,
						end,
					});

					if (response.errors && response.errors.length > 0) {
						console.warn(`GraphQL errors for ${product.id} (zone ${zoneTag}):`, response.errors);
					} else {
						const extracted = extractValue(response.data, product.dataset, product.field, aggregation, 'zone');
						result.currentUsage += extracted.value;

						// Aggregate confidence intervals across zones
						if (extracted.confidence) {
							hasConfidence = true;
							totalEstimate += extracted.confidence.estimate;
							totalLower += extracted.confidence.lower;
							totalUpper += extracted.confidence.upper;
							totalSampleSize += extracted.confidence.sampleSize;
							confidenceLevel = extracted.confidence.level;
							if (!extracted.confidence.isValid) {
								allValid = false;
							}
						}
					}
				}

				// Build aggregated confidence interval for multi-zone queries
				if (hasConfidence && totalEstimate > 0) {
					result.confidence = {
						estimate: totalEstimate,
						lower: totalLower,
						upper: totalUpper,
						sampleSize: totalSampleSize,
						isValid: allValid,
						level: confidenceLevel,
						confidencePercent: calculateConfidencePercent(totalEstimate, totalLower, totalUpper),
					};
				}
			}
		}

		// Apply transformation if defined (e.g., microseconds to milliseconds)
		if (product.transform && result.currentUsage > 0) {
			result.currentUsage = product.transform(result.currentUsage);
		}

		// Calculate percentage
		result.percentUsed = product.limit > 0 ? (result.currentUsage / product.limit) * 100 : 0;
	} catch (error) {
		result.error = error instanceof Error ? error.message : String(error);
		console.error(`Error querying ${product.id}:`, error);
	}

	result.queryDurationMs = Date.now() - startTime;
	return result;
}

/**
 * Query all enabled products in parallel batches
 */
export async function queryAllProductUsage(
	apiToken: string,
	accountId: string,
	zoneTags: string[],
	filters?: QueryFilterOptions
): Promise<ProductUsageResult[]> {
	const { start, end } = getCurrentBillingPeriod(CONTRACT_CONFIG);
	const enabledProducts = getEnabledProducts(CONTRACT_CONFIG, zoneTags);

	// Query products in parallel batches to avoid rate limiting
	const BATCH_SIZE = 5;
	const results: ProductUsageResult[] = [];

	for (let i = 0; i < enabledProducts.length; i += BATCH_SIZE) {
		const batch = enabledProducts.slice(i, i + BATCH_SIZE);
		const batchResults = await Promise.all(
			batch.map((product) => queryProductUsage(apiToken, accountId, product, start, end, filters))
		);
		results.push(...batchResults);

		// Small delay between batches to avoid rate limiting
		if (i + BATCH_SIZE < enabledProducts.length) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	return results;
}

/**
 * CDN products that have both account and zone variants.
 * When filtering by zone, we show the zone variant and hide the account variant.
 */
const CDN_ACCOUNT_PRODUCTS = ['http_requests', 'bandwidth', 'cached_bandwidth'];
const CDN_ZONE_PRODUCTS = ['http_requests_zone', 'bandwidth_zone', 'cached_bandwidth_zone'];

/**
 * Query ALL configured products (enabled and disabled) in parallel batches.
 * Disabled products are returned with placeholder data (not queried).
 * Used by the dashboard to show all available products.
 *
 * When filters.zoneId is set:
 * - Only zone-scoped products are queried for that specific zone
 * - Account-scoped products are excluded from results (except CDN metrics which
 *   have zone-specific variants that are shown instead)
 */
export async function queryAllConfiguredProductUsage(
	apiToken: string,
	accountId: string,
	zoneTags: string[],
	filters?: QueryFilterOptions
): Promise<ProductUsageResult[]> {
	const { start, end } = getCurrentBillingPeriod(CONTRACT_CONFIG);

	// When filtering by specific zone, only use that zone
	const effectiveZoneTags = filters?.zoneId ? [filters.zoneId] : zoneTags;
	const allProducts = getConfiguredProducts(CONTRACT_CONFIG, effectiveZoneTags);

	// When filtering by zone:
	// - Exclude account-scoped products (they show aggregate data, not zone-specific)
	// - Exclude zone CDN products when NOT filtering by zone (avoid duplicates)
	const isZoneFiltered = !!filters?.zoneId;
	const filteredProducts = isZoneFiltered
		? allProducts.filter((p) =>
				p.scope === 'zone' && !CDN_ACCOUNT_PRODUCTS.includes(p.id)
			)
		: allProducts.filter((p) =>
				// When showing account-wide, hide the zone-specific CDN variants to avoid duplicates
				!CDN_ZONE_PRODUCTS.includes(p.id)
			);

	// Separate enabled and disabled products
	const enabledProducts = filteredProducts.filter((p) => p.enabled);
	const disabledProducts = filteredProducts.filter((p) => !p.enabled);

	// Query enabled products in parallel batches
	const BATCH_SIZE = 5;
	const results: ProductUsageResult[] = [];

	for (let i = 0; i < enabledProducts.length; i += BATCH_SIZE) {
		const batch = enabledProducts.slice(i, i + BATCH_SIZE);
		const batchResults = await Promise.all(
			batch.map((product) => queryProductUsage(apiToken, accountId, product, start, end, filters))
		);
		results.push(...batchResults);

		// Small delay between batches to avoid rate limiting
		if (i + BATCH_SIZE < enabledProducts.length) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	// Add disabled products with placeholder data (not queried)
	for (const product of disabledProducts) {
		results.push({
			productId: product.id,
			productName: product.name,
			category: product.category,
			currentUsage: 0,
			limit: product.limit,
			percentUsed: 0,
			unit: product.unit,
			billingPeriodStart: start.toISOString(),
			billingPeriodEnd: end.toISOString(),
			scope: product.scope,
			queryDurationMs: 0,
			enabled: false,
			note: 'Product not enabled. Enable in CONTRACT_CONFIG.productOverrides to monitor.',
		});
	}

	return results;
}

/**
 * Introspect the GraphQL schema to discover available datasets
 * Useful for finding products not in our config
 */
export async function discoverDatasets(apiToken: string): Promise<string[]> {
	const introspectionQuery = `
    {
      __schema {
        types {
          name
          kind
          description
        }
      }
    }
  `;

	const response = await executeGraphQL<{
		__schema: {
			types: Array<{
				name: string;
				kind: string;
				description?: string;
			}>;
		};
	}>(apiToken, introspectionQuery, {});

	if (response.errors) {
		console.error('Introspection failed:', response.errors);
		return [];
	}

	// Filter for dataset types (typically end with Groups or Adaptive)
	const datasets = response.data.__schema.types
		.filter(
			(t) =>
				t.kind === 'OBJECT' &&
				(t.name.endsWith('Groups') || t.name.endsWith('Adaptive')) &&
				!t.name.startsWith('__')
		)
		.map((t) => t.name);

	return datasets;
}

/**
 * Categorize usage results by severity
 */
export function categorizeUsage(
	results: ProductUsageResult[],
	alertThreshold: number,
	warningThreshold: number
): UsageSummary {
	const summary: UsageSummary = {
		alerts: [],
		warnings: [],
		healthy: [],
		errors: [],
		timestamp: new Date().toISOString(),
		totalQueryDurationMs: results.reduce((sum, r) => sum + (r.queryDurationMs || 0), 0),
	};

	for (const result of results) {
		if (result.error) {
			summary.errors.push(result);
		} else if (result.percentUsed >= alertThreshold) {
			summary.alerts.push(result);
		} else if (result.percentUsed >= warningThreshold) {
			summary.warnings.push(result);
		} else {
			summary.healthy.push(result);
		}
	}

	// Sort by percentage used (descending)
	summary.alerts.sort((a, b) => b.percentUsed - a.percentUsed);
	summary.warnings.sort((a, b) => b.percentUsed - a.percentUsed);

	return summary;
}
