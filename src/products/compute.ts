/**
 * Compute Products
 *
 * Workers, Pages, Pages Functions, Queues
 */

import type { ProductDefinition } from './types';

export const COMPUTE_PRODUCTS: ProductDefinition[] = [
	{
		id: 'workers_requests',
		name: 'Workers Requests',
		category: 'compute',
		description: 'Total number of requests handled by Workers',
		defaultLimit: 10_000_000,
		unit: 'requests',
		dataset: 'workersInvocationsAdaptive',
		field: 'requests',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/workers/',
		note: 'See developers.cloudflare.com/workers/platform/pricing for overage rates.',
	},
	{
		id: 'workers_cpu_time',
		name: 'Workers CPU Time',
		category: 'compute',
		description: 'Total CPU time consumed by Workers',
		defaultLimit: 30_000_000,
		unit: 'ms',
		dataset: 'workersInvocationsAdaptive',
		field: 'cpuTimeUs',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/workers/platform/limits/',
		transform: (us: number) => us / 1000, // Convert microseconds to milliseconds
		note: 'See developers.cloudflare.com/workers/platform/pricing.',
	},
	{
		id: 'workers_duration',
		name: 'Workers Duration',
		category: 'compute',
		description: 'Total wall-clock duration of Worker executions',
		defaultLimit: 100_000_000,
		unit: 'ms',
		dataset: 'workersInvocationsAdaptive',
		field: 'duration',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/workers/platform/limits/',
		note: 'Wall-clock time (not billed). CPU time is the billable metric.',
	},
	{
		id: 'pages_requests',
		name: 'Pages Requests',
		category: 'compute',
		description: 'Total requests to Cloudflare Pages sites',
		defaultLimit: 0, // Unlimited - included free
		unit: 'requests',
		dataset: 'pagesRequestsAdaptiveGroups',
		field: 'requests',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use Pages
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/pages/',
		note: 'Static asset requests included. Pages Functions billed separately as Workers.',
	},
	{
		id: 'queues_messages',
		name: 'Queues Messages',
		category: 'compute',
		description: 'Total messages processed by Queues',
		defaultLimit: 1_000_000,
		unit: 'messages',
		dataset: 'queuesAdaptiveGroups',
		field: 'messages',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use Queues
		docsUrl: 'https://developers.cloudflare.com/queues/',
		note: 'Enable if you use Cloudflare Queues. Dataset may not be available on all accounts.',
	},
	// Pages Functions (separate from Pages static assets)
	{
		id: 'pages_functions_invocations',
		name: 'Pages Functions Invocations',
		category: 'compute',
		description: 'Function invocations on Cloudflare Pages',
		defaultLimit: 100_000,
		unit: 'invocations',
		dataset: 'pagesFunctionsInvocationsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use Pages Functions
		docsUrl: 'https://developers.cloudflare.com/pages/functions/',
		note: 'Server-side functions in Pages. Enable if you use Pages Functions.',
	},
	// Workers Subrequests (fetch calls from within Workers)
	{
		id: 'workers_subrequests',
		name: 'Workers Subrequests',
		category: 'compute',
		description: 'Subrequests (fetch calls) made by Workers',
		defaultLimit: 50_000_000,
		unit: 'requests',
		dataset: 'workersSubrequestsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts
		docsUrl: 'https://developers.cloudflare.com/workers/platform/limits/',
		note: 'External fetch() calls from Workers. Dataset may not be available on all accounts.',
	},
];
