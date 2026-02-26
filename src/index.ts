/**
 * Cloudflare Billing & Usage Analytics
 *
 * A Cloudflare Worker + Workflow that monitors your usage against
 * Enterprise contract limits and sends Discord notifications when
 * usage approaches the caps.
 *
 * Features:
 * - Periodic usage checks via Workflow (scheduled cron)
 * - GraphQL Analytics API integration for usage data
 * - Discord webhook notifications for alerts
 * - HTTP API for manual triggers and status checks
 * - Frontend dashboard for visualization
 *
 * SECURITY FEATURES:
 * - Optional API key authentication for sensitive endpoints
 * - Configurable CORS with origin restrictions
 * - Timing-safe token comparison using Web Crypto API
 * - Structured security event logging
 * - Input validation and sanitization
 *
 * DISCLAIMER: This is an educational/demo project, not affiliated with Cloudflare.
 * GraphQL Analytics data is observational and may differ from actual billing.
 */

import { UsageMonitorWorkflow, WorkflowEnv, WorkflowParams } from './workflow';
import { queryAllProductUsage, queryAllConfiguredProductUsage, categorizeUsage, discoverDatasets, QueryFilterOptions } from './graphql';
import { sendTestNotificationAuto, sendDiscordNotification } from './notifications';
import { discoverZones } from './cloudflare-api';
import { getZeroTrustSeats } from './products';
import {
	CONTRACT_CONFIG,
	getCurrentBillingPeriod,
	formatValue,
	getEnabledProducts,
	getConfiguredProducts,
	getAllProducts,
	getProductById,
	CATEGORY_NAMES,
} from './config';
import {
	verifyApiKey,
	isProtectedEndpoint,
	parseAllowedOrigins,
	isOriginAllowed,
	getCorsHeaders,
	validateZoneId,
	validateInstanceId,
	logSecurityEvent,
	extractRequestContext,
	createUnauthorizedResponse,
	createCorsBlockedResponse,
	REDACTED_CONFIG_ENDPOINTS,
} from './security';

// Re-export the Workflow class for wrangler
export { UsageMonitorWorkflow };

// Environment type extending WorkflowEnv
interface Env extends WorkflowEnv {
	USAGE_MONITOR_WORKFLOW: Workflow;
	/** Optional: API access key for protecting sensitive endpoints */
	API_ACCESS_KEY?: string;
	/** Optional: Comma-separated allowed CORS origins (default: "*" for development) */
	ALLOWED_ORIGINS?: string;
}

/**
 * Main Worker handler
 */
export default {
	/**
	 * HTTP request handler with enterprise security features
	 */
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
		const requestOrigin = request.headers.get('Origin');

		// SECURITY: Check CORS origin before processing
		if (requestOrigin && !isOriginAllowed(requestOrigin, allowedOrigins)) {
			logSecurityEvent({
				type: 'cors_blocked',
				timestamp: new Date().toISOString(),
				...extractRequestContext(request),
				details: { requestOrigin, allowedOrigins },
			});
			return createCorsBlockedResponse();
		}

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return handleCors(allowedOrigins, requestOrigin);
		}

		try {
			// API routes
			if (url.pathname.startsWith('/api/')) {
				// SECURITY: Check authentication for protected endpoints
				if (env.API_ACCESS_KEY && isProtectedEndpoint(url.pathname)) {
					const isAuthenticated = await verifyApiKey(request, env.API_ACCESS_KEY);
					if (!isAuthenticated) {
						logSecurityEvent({
							type: 'auth_failure',
							timestamp: new Date().toISOString(),
							...extractRequestContext(request),
							details: { endpoint: url.pathname },
						});
						return createUnauthorizedResponse(allowedOrigins, requestOrigin);
					}

					logSecurityEvent({
						type: 'auth_success',
						timestamp: new Date().toISOString(),
						...extractRequestContext(request),
						details: { endpoint: url.pathname },
					});
				}

				// Log access to sensitive endpoints (even if auth not required)
				if (REDACTED_CONFIG_ENDPOINTS.includes(url.pathname)) {
					logSecurityEvent({
						type: 'sensitive_endpoint_access',
						timestamp: new Date().toISOString(),
						...extractRequestContext(request),
					});
				}

				const response = await handleApiRoute(url.pathname, request, env, ctx);
				return addCorsHeaders(response, allowedOrigins, requestOrigin);
			}

			// Health check - always public, no auth needed
			if (url.pathname === '/health') {
				return new Response('OK', { status: 200 });
			}

			// Let static assets handle everything else (including /)
			return new Response('Not Found', { status: 404 });
		} catch (error) {
			console.error(JSON.stringify({
				message: 'Request handler error',
				error: error instanceof Error ? error.message : String(error),
				path: url.pathname,
			}));
			return addCorsHeaders(
				Response.json(
					{ error: error instanceof Error ? error.message : 'Internal server error' },
					{ status: 500 }
				),
				allowedOrigins,
				requestOrigin
			);
		}
	},

	/**
	 * Scheduled cron handler - triggers the workflow
	 */
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(
			JSON.stringify({
				message: 'Scheduled trigger',
				cron: controller.cron,
				scheduledTime: new Date(controller.scheduledTime).toISOString(),
			})
		);

		try {
			const instance = await env.USAGE_MONITOR_WORKFLOW.create({
				params: {
					triggeredBy: `cron:${controller.cron}`,
				} as WorkflowParams,
			});

			console.log(
				JSON.stringify({
					message: 'Workflow instance created',
					instanceId: instance.id,
				})
			);
		} catch (error) {
			console.error('Failed to create workflow instance:', error);
		}
	},
} satisfies ExportedHandler<Env>;

/**
 * Handle CORS preflight with configurable origins
 */
function handleCors(allowedOrigins: string[], requestOrigin: string | null): Response {
	const corsHeaders = getCorsHeaders(requestOrigin, allowedOrigins);
	return new Response(null, {
		status: 204,
		headers: corsHeaders,
	});
}

/**
 * Add CORS headers to response with configurable origins
 */
function addCorsHeaders(
	response: Response,
	allowedOrigins: string[],
	requestOrigin: string | null
): Response {
	const corsHeaders = getCorsHeaders(requestOrigin, allowedOrigins);
	const newHeaders = new Headers(response.headers);

	for (const [key, value] of Object.entries(corsHeaders)) {
		newHeaders.set(key, value);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders,
	});
}

/**
 * Route API requests
 */
async function handleApiRoute(
	pathname: string,
	request: Request,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	switch (pathname) {
		case '/api/trigger':
			return handleTrigger(request, env);

		case '/api/status':
			return handleStatus(request, env);

		case '/api/check':
			return handleCheck(request, env, ctx);

		case '/api/test-discord':
			return handleTestDiscord(request, env);

		case '/api/discover':
			return handleDiscover(env);

		case '/api/config':
			return handleConfig(env);

		case '/api/products':
			return handleProducts(env);

		case '/api/dashboard':
			return handleDashboard(env, request);

		case '/api/zones':
			return handleZones(env);

		default:
			return Response.json({ error: 'Not found' }, { status: 404 });
	}
}

/**
 * Manually trigger the workflow
 */
async function handleTrigger(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return Response.json({ error: 'Method not allowed' }, { status: 405 });
	}

	let params: WorkflowParams = { triggeredBy: 'api' };

	// Parse optional params from request body
	if (request.headers.get('content-type')?.includes('application/json')) {
		try {
			const body = await request.json();
			params = { ...params, ...(body as WorkflowParams) };
		} catch {
			// Ignore JSON parse errors
		}
	}

	const instance = await env.USAGE_MONITOR_WORKFLOW.create({ params });

	return Response.json({
		message: 'Workflow triggered',
		instanceId: instance.id,
		status: await instance.status(),
	});
}

/**
 * Get workflow instance status
 */
async function handleStatus(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const rawInstanceId = url.searchParams.get('instanceId');

	// SECURITY: Validate and sanitize instance ID
	const instanceId = validateInstanceId(rawInstanceId);
	if (!instanceId) {
		logSecurityEvent({
			type: 'input_validation_failure',
			timestamp: new Date().toISOString(),
			...extractRequestContext(request),
			details: { field: 'instanceId', value: rawInstanceId?.substring(0, 50) },
		});
		return Response.json({ error: 'Invalid or missing instanceId parameter' }, { status: 400 });
	}

	try {
		const instance = await env.USAGE_MONITOR_WORKFLOW.get(instanceId);
		const status = await instance.status();

		return Response.json({
			instanceId,
			status,
		});
	} catch (error) {
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Instance not found' },
			{ status: 404 }
		);
	}
}

/**
 * Parse filter options from URL search params with validation
 */
function parseFilterOptions(url: URL, request?: Request): QueryFilterOptions {
	const rawZoneId = url.searchParams.get('zoneId');

	// SECURITY: Validate zone ID format
	const zoneId = validateZoneId(rawZoneId);
	if (rawZoneId && !zoneId && request) {
		logSecurityEvent({
			type: 'input_validation_failure',
			timestamp: new Date().toISOString(),
			...extractRequestContext(request),
			details: { field: 'zoneId', value: rawZoneId.substring(0, 50) },
		});
	}

	return {
		eyeballOnly: url.searchParams.get('eyeballOnly') === 'true',
		excludeEdgeWorkers: url.searchParams.get('excludeEdgeWorkers') === 'true',
		excludeBlocked: url.searchParams.get('excludeBlocked') === 'true',
		zoneId: zoneId || undefined,
	};
}

/**
 * Run an immediate usage check (bypasses workflow for testing)
 */
async function handleCheck(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const apiToken = env.CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY;
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;

	if (!apiToken || !accountId) {
		return Response.json(
			{ error: 'Missing CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY or CLOUDFLARE_ACCOUNT_ID' },
			{ status: 500 }
		);
	}

	// Get zone tags from environment or auto-discover
	let zoneTags =
		env.CLOUDFLARE_ZONE_TAGS?.split(',').map((z: string) => z.trim()).filter(Boolean) ||
		(env.CLOUDFLARE_ZONE_ID ? [env.CLOUDFLARE_ZONE_ID] : []);

	let zonesAutoDiscovered = false;

	// Auto-discover zones if not configured
	if (zoneTags.length === 0) {
		const zoneDiscovery = await discoverZones(apiToken, accountId);
		if (!zoneDiscovery.error) {
			zoneTags = zoneDiscovery.zoneIds;
			zonesAutoDiscovered = true;
		}
	}

	const url = new URL(request.url);
	const notify = url.searchParams.get('notify') === 'true';
	const filters = parseFilterOptions(url, request);

	// Fetch usage data with optional filters
	const results = await queryAllProductUsage(apiToken, accountId, zoneTags, filters);

	// Categorize results
	const summary = categorizeUsage(
		results,
		CONTRACT_CONFIG.alertThresholdPercent,
		CONTRACT_CONFIG.warningThresholdPercent
	);

	// Optionally send notification
	let notificationResult = { sent: false, error: undefined as string | undefined };
	if (notify && env.DISCORD_WEBHOOK_URL) {
		const result = await sendDiscordNotification(env.DISCORD_WEBHOOK_URL, summary, {
			alwaysNotify: true,
		});
		notificationResult = { sent: result.success, error: result.error };
	}

	// Format results for response
	const formattedResults = results.map((r) => ({
		...r,
		currentUsageFormatted: formatValue(r.currentUsage, r.unit),
		limitFormatted: formatValue(r.limit, r.unit),
		percentUsed: Math.round(r.percentUsed * 100) / 100,
	}));

	return Response.json({
		timestamp: new Date().toISOString(),
		billingPeriod: getCurrentBillingPeriod(CONTRACT_CONFIG),
		zones: {
			count: zoneTags.length,
			autoDiscovered: zonesAutoDiscovered,
		},
		filters: {
			eyeballOnly: filters.eyeballOnly,
			excludeEdgeWorkers: filters.excludeEdgeWorkers,
			excludeBlocked: filters.excludeBlocked,
		},
		summary: {
			alerts: summary.alerts.length,
			warnings: summary.warnings.length,
			healthy: summary.healthy.length,
			errors: summary.errors.length,
		},
		notification: notificationResult,
		results: formattedResults,
	});
}

/**
 * Test Discord webhook
 */
async function handleTestDiscord(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST') {
		return Response.json({ error: 'Method not allowed' }, { status: 405 });
	}

	const webhookUrl = env.DISCORD_WEBHOOK_URL;

	if (!webhookUrl) {
		return Response.json({ error: 'DISCORD_WEBHOOK_URL not configured' }, { status: 500 });
	}

	const result = await sendTestNotificationAuto(webhookUrl);

	return Response.json({
		success: result.success,
		error: result.error,
		message: result.success
			? 'Test notification sent successfully'
			: 'Failed to send test notification',
	});
}

/**
 * Discover available GraphQL datasets
 */
async function handleDiscover(env: Env): Promise<Response> {
	const apiToken = env.CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY;

	if (!apiToken) {
		return Response.json(
			{ error: 'CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY not configured' },
			{ status: 500 }
		);
	}

	const datasets = await discoverDatasets(apiToken);

	// Get all configured datasets from the product registry
	const allProducts = getAllProducts();
	const configuredDatasets = new Set(allProducts.map((p) => p.dataset));

	return Response.json({
		availableDatasets: datasets,
		configuredDatasets: Array.from(configuredDatasets),
		unconfiguredDatasets: datasets.filter((d) => !configuredDatasets.has(d)),
	});
}

/**
 * Discover all zones for the account
 * This enables automatic zone discovery instead of manual configuration
 */
async function handleZones(env: Env): Promise<Response> {
	const apiToken = env.CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY;
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;

	if (!apiToken || !accountId) {
		return Response.json(
			{ error: 'Missing CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY or CLOUDFLARE_ACCOUNT_ID' },
			{ status: 500 }
		);
	}

	const result = await discoverZones(apiToken, accountId);

	if (result.error) {
		return Response.json(
			{
				error: result.error,
				zones: [],
				total: 0,
			},
			{ status: 500 }
		);
	}

	return Response.json({
		zones: result.zones.map((z) => ({
			id: z.id,
			name: z.name,
			status: z.status,
			type: z.type,
			paused: z.paused,
		})),
		zoneIds: result.zoneIds,
		total: result.total,
		durationMs: result.durationMs,
	});
}

/**
 * View current configuration
 *
 * SECURITY: This endpoint exposes configuration status but not actual secret values.
 * When API_ACCESS_KEY is set, consider adding authentication to this endpoint as well.
 */
function handleConfig(env: Env): Response {
	const zoneTags =
		env.CLOUDFLARE_ZONE_TAGS?.split(',').map((z: string) => z.trim()) ||
		(env.CLOUDFLARE_ZONE_ID ? [env.CLOUDFLARE_ZONE_ID] : []);

	const enabledProducts = getEnabledProducts(CONTRACT_CONFIG, zoneTags);

	// Build contract caps from product overrides for display
	const contractCaps = Object.entries(CONTRACT_CONFIG.productOverrides)
		.filter(([_, config]) => config.limit !== undefined && config.enabled !== false)
		.map(([productId, config]) => {
			const product = getProductById(productId);
			return {
				productId,
				productName: product?.name || productId,
				limit: config.limit!,
				limitFormatted: product ? formatValue(config.limit!, product.unit, product.unlimited) : String(config.limit),
				unit: product?.unit || 'units',
			};
		});

	// Return config with environment status - redact sensitive details
	// SECURITY: Only expose boolean status flags, not actual values
	const config = {
		alertThresholdPercent: CONTRACT_CONFIG.alertThresholdPercent,
		warningThresholdPercent: CONTRACT_CONFIG.warningThresholdPercent,
		billingPeriod: CONTRACT_CONFIG.billingPeriod,
		currentBillingPeriod: getCurrentBillingPeriod(CONTRACT_CONFIG),
		// Contract caps (explicit overrides from config.ts)
		contractCaps,
		// Cron schedule from wrangler.jsonc (hardcoded since we can't read the file at runtime)
		cronSchedule: '0 9 * * 1', // Weekly on Monday at 9 AM UTC - update if you change wrangler.jsonc
		cronDescription: 'Weekly on Monday at 9 AM UTC',
		environment: {
			// SECURITY: Only indicate if configured, never expose actual values
			// Frontend expects these specific field names
			hasApiToken: !!env.CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY,
			hasAccountId: !!env.CLOUDFLARE_ACCOUNT_ID,
			hasDiscordWebhook: !!env.DISCORD_WEBHOOK_URL,
			hasZoneTags: zoneTags.length > 0,
			zoneTagsConfigured: zoneTags.length, // Explicitly configured zones
			zonesAutoDiscovered: !env.CLOUDFLARE_ZONE_TAGS && !env.CLOUDFLARE_ZONE_ID,
			authenticationEnabled: !!env.API_ACCESS_KEY,
			// Legacy fields for backwards compatibility
			configured: !!(env.CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY && env.CLOUDFLARE_ACCOUNT_ID),
			notificationsConfigured: !!env.DISCORD_WEBHOOK_URL,
			zonesConfigured: zoneTags.length > 0,
			zoneCount: zoneTags.length, // Keep for backwards compat
		},
		products: enabledProducts.map((product) => ({
			id: product.id,
			name: product.name,
			category: product.category,
			description: product.description,
			limit: product.limit,
			limitFormatted: formatValue(product.limit, product.unit, product.unlimited),
			unlimited: product.unlimited || false,
			unit: product.unit,
			scope: product.scope,
			dataset: product.dataset,
			enabled: product.enabled,
		})),
		totalProductsAvailable: getAllProducts().length,
		// Category names for frontend display
		categoryNames: CATEGORY_NAMES,
		// Category order for consistent display
		categoryOrder: ['network', 'security', 'compute', 'storage', 'ai', 'connectivity', 'media', 'platform'],
	};

	return Response.json(config);
}

/**
 * Get all available products (for configuration UI)
 */
function handleProducts(env: Env): Response {
	const zoneTags =
		env.CLOUDFLARE_ZONE_TAGS?.split(',').map((z: string) => z.trim()) ||
		(env.CLOUDFLARE_ZONE_ID ? [env.CLOUDFLARE_ZONE_ID] : []);

	const allProducts = getConfiguredProducts(CONTRACT_CONFIG, zoneTags);

	// Group products by category
	const byCategory: Record<string, typeof allProducts> = {};
	for (const product of allProducts) {
		const categoryName = CATEGORY_NAMES[product.category];
		if (!byCategory[categoryName]) {
			byCategory[categoryName] = [];
		}
		byCategory[categoryName].push(product);
	}

	return Response.json({
		products: allProducts.map((p) => ({
			id: p.id,
			name: p.name,
			category: p.category,
			categoryName: CATEGORY_NAMES[p.category],
			description: p.description,
			defaultLimit: p.defaultLimit,
			limit: p.limit,
			limitFormatted: formatValue(p.limit, p.unit),
			unit: p.unit,
			scope: p.scope,
			dataset: p.dataset,
			enabled: p.enabled,
			enabledByDefault: p.enabledByDefault,
			docsUrl: p.docsUrl,
		})),
		byCategory,
		categories: Object.entries(CATEGORY_NAMES).map(([key, name]) => ({
			id: key,
			name,
			count: allProducts.filter((p) => p.category === key).length,
			enabledCount: allProducts.filter((p) => p.category === key && p.enabled).length,
		})),
	});
}

/**
 * Dashboard data endpoint - combines config and current usage
 *
 * SECURITY: This endpoint is read-only and exposes only aggregated usage data.
 * No secrets or sensitive configuration values are exposed.
 */
async function handleDashboard(env: Env, request?: Request): Promise<Response> {
	const apiToken = env.CLOUDFLARE_API_TOKEN_ANALYTICS_READ_ONLY;
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;

	// Parse filter options from URL if request is provided
	const url = request ? new URL(request.url) : null;
	const filters: QueryFilterOptions = url ? parseFilterOptions(url, request) : {};

	// Get zone tags from environment or auto-discover
	let zoneTags =
		env.CLOUDFLARE_ZONE_TAGS?.split(',').map((z: string) => z.trim()).filter(Boolean) ||
		(env.CLOUDFLARE_ZONE_ID ? [env.CLOUDFLARE_ZONE_ID] : []);

	let zonesAutoDiscovered = false;
	let zonesDiscoveryError: string | undefined;
	let availableZones: Array<{ id: string; name: string }> = [];

	// Discover zones once and reuse the result for both auto-discovery and dropdown
	if (apiToken && accountId) {
		const zoneDiscovery = await discoverZones(apiToken, accountId);
		if (zoneDiscovery.error) {
			zonesDiscoveryError = zoneDiscovery.error;
		} else {
			// Populate available zones for dropdown
			availableZones = zoneDiscovery.zones.map((z) => ({ id: z.id, name: z.name }));

			// Auto-discover zone IDs if not configured
			if (zoneTags.length === 0) {
				zoneTags = zoneDiscovery.zoneIds;
				zonesAutoDiscovered = true;
			}
		}
	}

	const billingPeriod = getCurrentBillingPeriod(CONTRACT_CONFIG);
	const enabledProducts = getEnabledProducts(CONTRACT_CONFIG, zoneTags);

	// Basic dashboard data
	const dashboard: Record<string, unknown> = {
		timestamp: new Date().toISOString(),
		config: {
			alertThresholdPercent: CONTRACT_CONFIG.alertThresholdPercent,
			warningThresholdPercent: CONTRACT_CONFIG.warningThresholdPercent,
			billingPeriod: CONTRACT_CONFIG.billingPeriod,
			timezone: CONTRACT_CONFIG.billingPeriod.timezone,
		},
		currentBillingPeriod: billingPeriod,
		filters: {
			eyeballOnly: filters.eyeballOnly || false,
			excludeEdgeWorkers: filters.excludeEdgeWorkers || false,
			excludeBlocked: filters.excludeBlocked || false,
			zoneId: filters.zoneId || null,
		},
		zones: {
			available: availableZones,
			selected: filters.zoneId || null,
			autoDiscovered: zonesAutoDiscovered,
			// Total should reflect all discovered zones, not just configured ones
			total: availableZones.length || zoneTags.length,
		},
		environment: {
			// SECURITY: Only expose configuration status, not secrets
			configured: !!(apiToken && accountId),
			zonesConfigured: zoneTags.length > 0,
			notificationsConfigured: !!env.DISCORD_WEBHOOK_URL,
			authenticationEnabled: !!env.API_ACCESS_KEY,
			zonesAutoDiscovered,
			zonesDiscoveryError,
			zoneCount: zoneTags.length,
		},
		productsCount: enabledProducts.length,
		totalProductsAvailable: getAllProducts().length,
		// Category names for frontend display
		categoryNames: CATEGORY_NAMES,
		// Category order for consistent display (most important first)
		categoryOrder: ['network', 'security', 'compute', 'storage', 'ai', 'connectivity', 'media', 'platform'],
	};

	// If configured, fetch usage data and Zero Trust seats in parallel
	if (apiToken && accountId) {
		// Fetch usage data and Zero Trust seats in parallel
		const [usageResult, zeroTrustSeatsResult] = await Promise.allSettled([
			queryAllConfiguredProductUsage(apiToken, accountId, zoneTags, filters),
			getZeroTrustSeats(apiToken, accountId),
		]);

		// Process usage data
		if (usageResult.status === 'fulfilled') {
			const results = usageResult.value;
			const summary = categorizeUsage(
				results,
				CONTRACT_CONFIG.alertThresholdPercent,
				CONTRACT_CONFIG.warningThresholdPercent
			);

			// Count only enabled products for summary stats
			const enabledResults = results.filter((r) => r.enabled !== false);
			const disabledCount = results.filter((r) => r.enabled === false).length;

			dashboard.usage = {
				summary: {
					alerts: summary.alerts.length,
					warnings: summary.warnings.length,
					healthy: summary.healthy.length,
					errors: summary.errors.length,
					total: results.length,
					enabled: enabledResults.length,
					disabled: disabledCount,
				},
				totalQueryDurationMs: summary.totalQueryDurationMs,
				results: results.map((r) => ({
					...r,
					currentUsageFormatted: formatValue(r.currentUsage, r.unit),
					limitFormatted: formatValue(r.limit, r.unit, r.unlimited),
					percentUsed: r.unlimited ? 0 : Math.round(r.percentUsed * 100) / 100,
					status:
						r.enabled === false
							? 'disabled'
							: r.error
								? 'error'
								: r.unlimited
									? 'healthy' // Unlimited products are always healthy
									: r.percentUsed >= 100
										? 'critical'
										: r.percentUsed >= CONTRACT_CONFIG.alertThresholdPercent
											? 'alert'
											: r.percentUsed >= CONTRACT_CONFIG.warningThresholdPercent
												? 'warning'
												: 'healthy',
				})),
			};
		} else {
			dashboard.usage = {
				error: usageResult.reason instanceof Error ? usageResult.reason.message : 'Failed to fetch usage data',
			};
		}

		// Process Zero Trust seats data
		if (zeroTrustSeatsResult.status === 'fulfilled') {
			const seats = zeroTrustSeatsResult.value;
			dashboard.zeroTrustSeats = {
				totalUsers: seats.totalUsers,
				accessSeats: seats.accessSeats,
				gatewaySeats: seats.gatewaySeats,
				activeSeats: seats.activeSeats,
				error: seats.error,
				durationMs: seats.durationMs,
			};
		} else {
			dashboard.zeroTrustSeats = {
				error: zeroTrustSeatsResult.reason instanceof Error
					? zeroTrustSeatsResult.reason.message
					: 'Failed to fetch Zero Trust seats',
			};
		}
	}

	return Response.json(dashboard);
}
