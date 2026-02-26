/**
 * Platform Products
 *
 * Email Routing, Zaraz, Logpush, and other platform services
 */

import type { ProductDefinition } from './types';

export const PLATFORM_PRODUCTS: ProductDefinition[] = [
	// Email Routing - Inbound email routing is FREE
	{
		id: 'email_routing_messages',
		name: 'Email Routing Messages',
		category: 'platform',
		description: 'Emails routed through Cloudflare Email Routing (FREE)',
		defaultLimit: 0, // Email Routing (inbound) is free
		unit: 'messages',
		dataset: 'emailRoutingAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'zone',
		enabledByDefault: false, // Disabled - Email Routing is FREE
		docsUrl: 'https://developers.cloudflare.com/email-routing/',
		note: 'Inbound Email Routing is free. Review official documentation for details.',
	},
	// Zaraz - Uses zarazTrackAdaptiveGroups for event counts
	// Note: zarazActionsAdaptiveGroups tracks actions, zarazTrackAdaptiveGroups tracks events
	{
		id: 'zaraz_events',
		name: 'Zaraz Events',
		category: 'platform',
		description: 'Events processed by Zaraz tag manager',
		defaultLimit: 1_000_000,
		unit: 'events',
		dataset: 'zarazTrackAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'zone',
		filterField: 'datetimeHour', // Zaraz uses datetimeHour filter
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/zaraz/',
		note: 'Server-side tag management. Requires zaraz.track() calls. Free tier available.',
	},
	// Logpush Health - Logpush is included with Enterprise, not billed
	{
		id: 'logpush_jobs',
		name: 'Logpush Job Events',
		category: 'platform',
		description: 'Logpush job execution events (informational only)',
		defaultLimit: 0, // Logpush is included with Enterprise plans
		unit: 'events',
		dataset: 'logpushHealthAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Disabled - Logpush is included with Enterprise, not usage-billed
		docsUrl: 'https://developers.cloudflare.com/logs/logpush/',
		note: 'Informational only. Logpush is included with Enterprise plans, not billed per event.',
	},
	// Web Analytics / RUM - FREE for all plans
	{
		id: 'web_analytics_events',
		name: 'Web Analytics Events',
		category: 'platform',
		description: 'Real User Monitoring (RUM) page load events (FREE)',
		defaultLimit: 0, // FREE - Web Analytics is free for all plans
		unit: 'events',
		dataset: 'rumPageloadEventsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Disabled - Web Analytics is FREE for all plans
		docsUrl: 'https://developers.cloudflare.com/web-analytics/',
		note: 'Web Analytics is a free, privacy-focused analytics tool for all plans.',
	},
	// Web Vitals - FREE as part of Web Analytics
	{
		id: 'web_vitals_events',
		name: 'Web Vitals Events',
		category: 'platform',
		description: 'Core Web Vitals measurements collected (FREE)',
		defaultLimit: 0, // FREE - Part of Web Analytics
		unit: 'events',
		dataset: 'rumWebVitalsEventsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Disabled - Web Vitals is FREE as part of Web Analytics
		docsUrl: 'https://developers.cloudflare.com/web-analytics/',
		note: 'Part of Web Analytics. Tracks LCP, FID, CLS metrics.',
	},
];
