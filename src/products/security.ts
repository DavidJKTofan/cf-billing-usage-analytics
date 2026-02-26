/**
 * Security Products
 *
 * WAF, Bot Management, Rate Limiting, DDoS, Turnstile, Page Shield,
 * API Shield, DMARC, Magic Firewall
 */

import type { ProductDefinition } from './types';

export const SECURITY_PRODUCTS: ProductDefinition[] = [
	{
		id: 'firewall_events',
		name: 'WAF/Firewall Events',
		category: 'security',
		description: 'Events triggered by WAF and firewall rules',
		defaultLimit: 0, // WAF included with Enterprise
		unit: 'events',
		dataset: 'firewallEventsAdaptiveGroups',
		field: '', // Not used for count aggregation
		aggregation: 'count',
		scope: 'zone', // firewallEventsAdaptiveGroups is zone-scoped per Cloudflare docs
		enabledByDefault: true,
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/waf/',
		note: 'WAF included with Enterprise.',
	},
	{
		id: 'bot_management_requests',
		name: 'Bot Management Requests',
		category: 'security',
		description: 'Requests analyzed by Bot Management',
		defaultLimit: 100_000_000, // 100M requests - customize based on your contract
		unit: 'requests',
		dataset: 'httpRequestsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'zone',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/bots/',
		note: 'Set limit based on your contract. Bot scoring and management.',
	},
	{
		id: 'rate_limiting_requests',
		name: 'Rate Limiting Requests',
		category: 'security',
		description: 'Requests processed by Rate Limiting rules',
		defaultLimit: 0, // Basic Rate Limiting included with Enterprise
		unit: 'requests',
		dataset: 'httpRequestsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'zone',
		enabledByDefault: true,
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/waf/rate-limiting-rules/',
		note: 'Included with Enterprise. Advanced Rate Limiting available in higher tiers.',
	},
	// Turnstile - Has limited data retention (~7 days)
	{
		id: 'turnstile_challenges',
		name: 'Turnstile Challenges',
		category: 'security',
		description: 'Turnstile CAPTCHA challenges issued',
		defaultLimit: 0, // Free version of Turnstile included in all accounts
		unit: 'challenges',
		dataset: 'turnstileAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Limited data retention (~7 days) - can't query full billing period
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/turnstile/',
		note: 'Turnstile Managed Challenge. Data retention ~7 days.',
	},
	// Page Shield - Billed by HTTP requests, not violations
	{
		id: 'page_shield_violations',
		name: 'Page Shield Violations',
		category: 'security',
		description: 'Page Shield policy violations detected (informational only)',
		defaultLimit: 0, // Page Shield is billed by HTTP requests, not violations
		unit: 'violations',
		dataset: 'pageShieldReportsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'zone',
		enabledByDefault: false, // Disabled - Page Shield is billed by HTTP requests, not violations
		docsUrl: 'https://developers.cloudflare.com/page-shield/',
		note: 'Informational only. Page Shield is billed by HTTP requests (base fee + per MM requests), not by violations.',
	},
	// API Shield / Gateway - Sessions are NOT billed, API Shield is billed by HTTP requests
	// The apiGatewayMatchedSessionIDsAdaptiveGroups dataset is for analytics only, not billing
	{
		id: 'api_gateway_sessions',
		name: 'API Gateway Sessions',
		category: 'security',
		description: 'API sessions tracked by API Gateway (informational only)',
		defaultLimit: 1_000_000,
		unit: 'sessions',
		dataset: 'apiGatewayMatchedSessionIDsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'zone',
		enabledByDefault: false, // Disabled - API Shield is billed by HTTP requests, not sessions
		docsUrl: 'https://developers.cloudflare.com/api-shield/',
		note: 'Informational only. API Shield is billed by HTTP requests, not by sessions. See cloudflare.com/application-services/products/api-gateway.',
	},
	// DDoS Attack Analytics - Dataset uses different filter format, disable by default
	{
		id: 'ddos_attacks',
		name: 'DDoS Attacks Detected',
		category: 'security',
		description: 'DDoS attacks detected and mitigated',
		defaultLimit: 0, // Unlimited - DDoS protection is free
		unit: 'attacks',
		dataset: 'dosdAttackAnalyticsGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Dataset uses different filter format - not critical for billing
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/ddos-protection/',
		note: 'Unlimited DDoS protection included. No billing for DDoS mitigation. Dataset query format not supported.',
	},
	// DMARC
	{
		id: 'dmarc_reports',
		name: 'DMARC Reports',
		category: 'security',
		description: 'DMARC aggregate reports received',
		defaultLimit: 100_000,
		unit: 'reports',
		dataset: 'dmarcReportsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use DMARC Management
		docsUrl: 'https://developers.cloudflare.com/dmarc-management/',
		note: 'Enable if you use DMARC Management. Dataset may not be available on all accounts.',
	},
	// Magic Firewall - Standard included with Magic Transit/WAN
	{
		id: 'magic_firewall_packets',
		name: 'Magic Firewall Packets',
		category: 'security',
		description: 'Packets processed by Magic Firewall (included with Magic Transit/WAN)',
		defaultLimit: 0,
		unit: 'packets',
		dataset: 'magicFirewallNetworkAnalyticsAdaptiveGroups',
		field: 'packets',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		unlimited: true,
		docsUrl: 'https://developers.cloudflare.com/magic-firewall/',
		note: 'Included with Magic Transit/WAN. No separate charge for Magic Firewall packet processing.',
	},
];
