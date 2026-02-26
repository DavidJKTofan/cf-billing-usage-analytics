/**
 * Connectivity Products
 *
 * Cloudflare Tunnels, Gateway, Access, Browser Isolation, WARP (Zero Trust)
 */

import type { ProductDefinition } from './types';

export const CONNECTIVITY_PRODUCTS: ProductDefinition[] = [
	{
		id: 'tunnel_requests',
		name: 'Cloudflare Tunnel Requests',
		category: 'connectivity',
		description: 'Requests through Cloudflare Tunnels',
		defaultLimit: 0, // Included with Zero Trust seats
		unit: 'requests',
		dataset: 'cloudflareTunnelsAnalyticsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use Tunnels
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/',
		note: 'Included with Zero Trust. No per-request charges for Tunnels.',
	},
	{
		id: 'gateway_dns_queries',
		name: 'Gateway DNS Queries',
		category: 'connectivity',
		description: 'DNS queries through Cloudflare Gateway',
		defaultLimit: 0, // Included with Zero Trust seats
		unit: 'queries',
		dataset: 'gatewayResolverQueriesAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: true,
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/policies/gateway/',
		note: 'Included with Zero Trust seats. DNS filtering and security policies. If DNS-only use case, might get charged for DNS Queries.',
	},
	// Gateway HTTP Requests - Not billed separately, included with Zero Trust seats
	{
		id: 'gateway_http_requests',
		name: 'Gateway HTTP Requests',
		category: 'connectivity',
		description: 'HTTP requests through Cloudflare Gateway (included with Zero Trust)',
		defaultLimit: 0,
		unit: 'requests',
		dataset: 'gatewayL7RequestsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: true,
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/policies/gateway/',
		note: 'Included with Zero Trust seats. No separate charge for Gateway HTTP requests.',
	},
	{
		id: 'access_requests',
		name: 'Access Requests',
		category: 'connectivity',
		description: 'Authentication requests to Cloudflare Access',
		defaultLimit: 0, // Included with Zero Trust seats
		unit: 'requests',
		dataset: 'accessRequestsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use Access
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/policies/access/',
		note: 'Included with Zero Trust seats. ZTNA for apps and services. See cloudflare.com/zero-trust for pricing.',
	},
	// Browser Isolation Sessions - Not billed separately, included with Zero Trust seats
	{
		id: 'browser_isolation_sessions',
		name: 'Browser Isolation Sessions',
		category: 'connectivity',
		description: 'Remote browser isolation sessions (included with Zero Trust)',
		defaultLimit: 0,
		unit: 'sessions',
		dataset: 'browserIsolationSessionsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: true,
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/policies/browser-isolation/',
		note: 'Included with Zero Trust seats. No separate charge for Browser Isolation sessions.',
	},
	// WARP Devices - Note: Zero Trust is billed per seat/user, not by device sessions
	{
		id: 'warp_devices',
		name: 'WARP Device Sessions',
		category: 'connectivity',
		description: 'Active WARP client device sessions (informational only)',
		defaultLimit: 0, // Zero Trust is billed per seat/user, not by sessions
		unit: 'sessions',
		dataset: 'warpDeviceAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Not a billable metric - Zero Trust is billed per seat
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/',
		note: 'Included with Zero Trust seats. See cloudflare.com/zero-trust for pricing.',
	},
	// Gateway L4 Network Sessions - Not billed separately, included with Zero Trust seats
	{
		id: 'gateway_network_sessions',
		name: 'Gateway Network Sessions',
		category: 'connectivity',
		description: 'L4 network sessions through Gateway (included with Zero Trust)',
		defaultLimit: 0,
		unit: 'sessions',
		dataset: 'gatewayL4SessionsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: true,
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/policies/gateway/network-policies/',
		note: 'Included with Zero Trust seats. Non-HTTP traffic (TCP/UDP) proxied through Gateway.',
	},
	// Access Login Requests (authentication events) - Has limited data retention (~7 days)
	{
		id: 'access_login_requests',
		name: 'Access Login Requests',
		category: 'connectivity',
		description: 'Authentication attempts to Access applications',
		defaultLimit: 1_000_000,
		unit: 'requests',
		dataset: 'accessLoginRequestsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Limited data retention (~7 days) - can't query full billing period
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/policies/access/',
		note: 'Limited to ~7 day data retention. Cannot query full billing period.',
	},
];
