/**
 * Network Products
 *
 * CDN, HTTP Requests, Bandwidth, DNS, Load Balancing, Argo, Cache Reserve,
 * Waiting Room, Spectrum, Magic Transit
 */

import type { ProductDefinition } from './types';

export const NETWORK_PRODUCTS: ProductDefinition[] = [
	// Account-level HTTP requests (aggregates all zones)
	{
		id: 'http_requests',
		name: 'HTTP Requests (Account)',
		category: 'network',
		description: 'Total HTTP requests across all zones in the account',
		defaultLimit: 100_000_000, // 100MM requests - customize based on your contract
		unit: 'requests',
		dataset: 'httpRequestsAdaptiveGroups',
		field: '', // Not used for count aggregation
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/cache/',
		note: 'Set limit based on your contract. DDoS traffic excluded from billing.',
	},
	// Zone-level HTTP requests (for zone filtering)
	{
		id: 'http_requests_zone',
		name: 'HTTP Requests',
		category: 'network',
		description: 'HTTP requests for this zone',
		defaultLimit: 100_000_000, // 100MM requests - customize based on your contract
		unit: 'requests',
		dataset: 'httpRequestsAdaptiveGroups',
		field: '', // Not used for count aggregation
		aggregation: 'count',
		scope: 'zone',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/cache/',
		note: 'Set limit based on your contract. DDoS traffic excluded from billing.',
	},
	{
		id: 'bandwidth',
		name: 'Bandwidth (Account)',
		category: 'network',
		description: 'Total bandwidth served across all zones in the account',
		defaultLimit: 1 * 1024 * 1024 * 1024 * 1024, // 1TB - customize based on your contract
		unit: 'bytes',
		dataset: 'httpRequestsAdaptiveGroups',
		field: 'edgeResponseBytes',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/cache/',
		note: 'DDoS traffic excluded from billing. See cloudflare.com/plans/enterprise.',
	},
	// Zone-level Bandwidth (for zone filtering)
	{
		id: 'bandwidth_zone',
		name: 'Bandwidth',
		category: 'network',
		description: 'Bandwidth served for this zone',
		defaultLimit: 1 * 1024 * 1024 * 1024 * 1024, // 1TB - customize based on your contract
		unit: 'bytes',
		dataset: 'httpRequestsAdaptiveGroups',
		field: 'edgeResponseBytes',
		aggregation: 'sum',
		scope: 'zone',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/cache/',
		note: 'DDoS traffic excluded from billing. See cloudflare.com/plans/enterprise.',
	},
	{
		id: 'cached_bandwidth',
		name: 'Cached Bandwidth (Account)',
		category: 'network',
		description: 'Bandwidth served from cache across all zones',
		defaultLimit: 1 * 1024 * 1024 * 1024 * 1024, // 1 TB
		unit: 'bytes',
		dataset: 'httpRequests1dGroups',
		field: 'cachedBytes',
		aggregation: 'sum',
		scope: 'account',
		filterField: 'date', // Daily rollup uses date filter, not datetime
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/cache/',
		note: 'Cached responses (hit/stale/revalidated). High cache rates reduce origin bandwidth costs.',
	},
	// Zone-level Cached Bandwidth (for zone filtering)
	{
		id: 'cached_bandwidth_zone',
		name: 'Cached Bandwidth',
		category: 'network',
		description: 'Bandwidth served from cache for this zone',
		defaultLimit: 1 * 1024 * 1024 * 1024 * 1024, // 1 TB
		unit: 'bytes',
		dataset: 'httpRequests1dGroups',
		field: 'cachedBytes',
		aggregation: 'sum',
		scope: 'zone',
		filterField: 'date', // Daily rollup uses date filter, not datetime
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/cache/',
		note: 'Cached responses (hit/stale/revalidated). High cache rates reduce origin bandwidth costs.',
	},
	// Account-level DNS queries (new API as of June 2025)
	{
		id: 'dns_queries',
		name: 'DNS Queries (Account)',
		category: 'network',
		description: 'Total authoritative DNS queries across all zones',
		defaultLimit: 1_000_000_000, // 1B queries - customize based on your contract
		unit: 'queries',
		dataset: 'dnsAnalyticsAdaptiveGroups',
		field: '', // Not used for count aggregation
		aggregation: 'count',
		scope: 'account',
		filterField: 'date', // DNS uses date filter, not datetime
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/dns/',
		note: 'Set limit based on your contract. Foundation DNS included with Enterprise.',
	},
	{
		id: 'load_balancer_requests',
		name: 'Load Balancer Requests',
		category: 'network',
		description: 'Requests handled by Load Balancing',
		defaultLimit: 10_000_000,
		unit: 'requests',
		dataset: 'loadBalancingRequestsAdaptiveGroups',
		field: '', // Uses count aggregation per Cloudflare docs
		aggregation: 'count',
		scope: 'zone',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/load-balancing/',
		note: 'See cloudflare.com/load-balancing.',
	},
	{
		id: 'argo_bandwidth',
		name: 'Argo Smart Routing Bandwidth',
		category: 'network',
		description: 'Bandwidth using Argo Smart Routing',
		defaultLimit: 5 * 1024 * 1024 * 1024 * 1024, // 5TB - customize based on your contract
		unit: 'bytes',
		dataset: 'httpRequestsAdaptiveGroups',
		field: 'edgeResponseBytes',
		aggregation: 'sum',
		scope: 'zone',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/argo-smart-routing/',
		note: 'Set limit based on your contract. Reduces latency by routing around congestion.',
	},
	// Cache Reserve - Requires Cache Reserve to be enabled on the zone
	// See: https://developers.cloudflare.com/smart-shield/configuration/cache-reserve/analytics/
	{
		id: 'cache_reserve_operations',
		name: 'Cache Reserve Operations',
		category: 'network',
		description: 'Operations to Cache Reserve storage (Class A writes + Class B reads)',
		defaultLimit: 10_000_000,
		unit: 'operations',
		dataset: 'cacheReserveOperationsAdaptiveGroups',
		field: 'requests', // sum { requests } - not count!
		aggregation: 'sum',
		scope: 'zone',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/smart-shield/configuration/cache-reserve/analytics/',
		note: 'Requires Cache Reserve to be enabled on the zone. Shows 0 if not enabled.',
	},
	{
		id: 'cache_reserve_storage',
		name: 'Cache Reserve Storage',
		category: 'network',
		description: 'Current storage used by Cache Reserve (point-in-time max)',
		defaultLimit: 100 * 1024 * 1024 * 1024, // 100 GB
		unit: 'bytes',
		dataset: 'cacheReserveStorageAdaptiveGroups',
		field: 'storedBytes', // max { storedBytes } - storage is point-in-time, not cumulative
		aggregation: 'max',
		scope: 'zone',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/smart-shield/configuration/cache-reserve/analytics/',
		note: 'Requires Cache Reserve to be enabled on the zone. Shows 0 if not enabled.',
	},
	// Waiting Room - Billed per room, not by events/visitors
	{
		id: 'waiting_room_events',
		name: 'Waiting Room Events',
		category: 'network',
		description: 'Visitors processed by Waiting Room (informational only)',
		defaultLimit: 0, // Waiting Room is billed per room, not by events
		unit: 'events',
		dataset: 'waitingRoomAnalyticsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'zone',
		enabledByDefault: false, // Disabled - Waiting Room is billed per room, not by events
		docsUrl: 'https://developers.cloudflare.com/waiting-room/',
		note: 'Informational only. Waiting Room is billed per room, not by visitor events. See cloudflare.com/waiting-room.',
	},
	// Health Checks (Load Balancing)
	{
		id: 'health_check_events',
		name: 'Health Check Events',
		category: 'network',
		description: 'Health check events for Load Balancing origins',
		defaultLimit: 0, // Unlimited - included with Load Balancing
		unit: 'events',
		dataset: 'healthCheckEventsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use Load Balancing
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/load-balancing/monitors/',
		note: 'Enable if you use Load Balancing. Dataset may not be available on all accounts.',
	},
	// Spectrum - Enterprise feature
	{
		id: 'spectrum_bytes',
		name: 'Spectrum Bandwidth',
		category: 'network',
		description: 'Bandwidth proxied through Spectrum',
		defaultLimit: 1 * 1024 * 1024 * 1024 * 1024, // 1 TB
		unit: 'bytes',
		dataset: 'spectrumNetworkAnalyticsAdaptiveGroups',
		field: 'bytes',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Enterprise feature - enable if you use Spectrum
		docsUrl: 'https://developers.cloudflare.com/spectrum/',
		note: 'Enterprise feature. Enable if you use Spectrum for TCP/UDP proxying.',
	},
	// Magic Transit - Enterprise feature
	{
		id: 'magic_transit_bytes',
		name: 'Magic Transit Bandwidth',
		category: 'network',
		description: 'Bandwidth processed by Magic Transit',
		defaultLimit: 10 * 1024 * 1024 * 1024 * 1024, // 10 TB
		unit: 'bytes',
		dataset: 'magicTransitNetworkAnalyticsAdaptiveGroups',
		field: 'bytes',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Enterprise feature - enable if you use Magic Transit
		docsUrl: 'https://developers.cloudflare.com/magic-transit/',
		note: 'Enterprise feature. Enable if you use Magic Transit for network DDoS protection.',
	},
	// Magic WAN - Enterprise feature
	{
		id: 'magic_wan_bytes',
		name: 'Magic WAN Bandwidth',
		category: 'network',
		description: 'Bandwidth through Magic WAN connectors',
		defaultLimit: 1 * 1024 * 1024 * 1024 * 1024, // 1 TB
		unit: 'bytes',
		dataset: 'magicWanConnectorMetricsAdaptiveGroups',
		field: 'bytes',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Enterprise feature - enable if you use Magic WAN
		docsUrl: 'https://developers.cloudflare.com/magic-wan/',
		note: 'Enterprise feature. Enable if you use Magic WAN.',
	},
];
