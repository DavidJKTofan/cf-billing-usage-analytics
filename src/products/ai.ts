/**
 * AI Products
 *
 * Workers AI, AI Gateway, Vectorize
 */

import type { ProductDefinition } from './types';

export const AI_PRODUCTS: ProductDefinition[] = [
	{
		id: 'workers_ai_requests',
		name: 'Workers AI Requests',
		category: 'ai',
		description: 'Inference requests to Workers AI',
		defaultLimit: 10_000,
		unit: 'requests',
		dataset: 'aiInferenceAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/workers-ai/',
		note: 'See developers.cloudflare.com/workers-ai/platform/pricing.',
	},
	{
		id: 'workers_ai_neurons',
		name: 'Workers AI Neurons',
		category: 'ai',
		description: 'Neurons used by Workers AI',
		defaultLimit: 300_000,
		unit: 'neurons',
		dataset: 'aiInferenceAdaptiveGroups',
		field: 'neurons',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Field not available - use requests count instead
		docsUrl: 'https://developers.cloudflare.com/workers-ai/',
		note: 'See developers.cloudflare.com/workers-ai/platform/pricing.',
	},
	{
		id: 'ai_gateway_requests',
		name: 'AI Gateway Requests',
		category: 'ai',
		description: 'Requests routed through AI Gateway (caching, rate limiting, logging)',
		defaultLimit: 1_000_000,
		unit: 'requests',
		dataset: 'aiGatewayRequestsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		filterField: 'date', // AI Gateway uses date filter
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/ai-gateway/',
		note: 'Route requests to any AI provider. Caching reduces costs.',
	},
	{
		id: 'vectorize_queries',
		name: 'Vectorize Queries',
		category: 'ai',
		description: 'Vector queries to Vectorize indexes',
		defaultLimit: 1_000_000,
		unit: 'queries',
		dataset: 'vectorizeQueriesAdaptiveGroups',
		field: 'queries',
		aggregation: 'sum',
		scope: 'account',
		filterField: 'date', // This dataset uses date filter, not datetime
		enabledByDefault: false, // Enable if you use Vectorize
		docsUrl: 'https://developers.cloudflare.com/vectorize/',
		note: 'Enable if you use Vectorize. Dataset may not be available on all accounts.',
	},
	{
		id: 'vectorize_storage',
		name: 'Vectorize Storage',
		category: 'ai',
		description: 'Vector dimensions stored in Vectorize',
		defaultLimit: 5_000_000,
		unit: 'dimensions',
		dataset: 'vectorizeStorageAdaptiveGroups',
		field: 'dimensions',
		aggregation: 'sum',
		scope: 'account',
		filterField: 'date', // This dataset uses date filter, not datetime
		enabledByDefault: false, // Enable if you use Vectorize
		docsUrl: 'https://developers.cloudflare.com/vectorize/',
		note: 'Enable if you use Vectorize. Dataset may not be available on all accounts.',
	},
];
