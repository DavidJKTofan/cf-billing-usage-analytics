/**
 * Media Products
 *
 * Stream, Images
 */

import type { ProductDefinition } from './types';

export const MEDIA_PRODUCTS: ProductDefinition[] = [
	{
		id: 'stream_minutes_viewed',
		name: 'Stream Minutes Viewed',
		category: 'media',
		description: 'Minutes of video delivered via Stream',
		defaultLimit: 10_000,
		unit: 'minutes',
		dataset: 'streamMinutesViewedAdaptiveGroups',
		field: 'minutesViewed',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/stream/',
		note: 'Billed per 1k minutes delivered. Enterprise: contracted amount with soft cap. See developers.cloudflare.com/stream/pricing.',
	},
	{
		id: 'stream_minutes_stored',
		name: 'Stream Minutes Stored',
		category: 'media',
		description: 'Minutes of video stored on Stream',
		defaultLimit: 1_000,
		unit: 'minutes',
		dataset: 'streamMinutesStoredAdaptiveGroups',
		field: 'minutesStored',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use Stream
		docsUrl: 'https://developers.cloudflare.com/stream/',
		note: 'Billed per 1k minutes stored (prepaid). Includes encoding. See developers.cloudflare.com/stream/pricing.',
	},
	{
		id: 'images_delivered',
		name: 'Images Delivered',
		category: 'media',
		description: 'Number of images delivered via Cloudflare Images',
		defaultLimit: 5_000_000, // Enterprise includes a small free tier
		unit: 'images',
		dataset: 'imagesRequestsAdaptiveGroups',
		field: 'requests',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/images/',
		note: 'See developers.cloudflare.com/images/pricing for overage rates.',
	},
	{
		id: 'images_transformations',
		name: 'Images Transformations',
		category: 'media',
		description: 'Unique image transformations performed',
		defaultLimit: 1_000_000, // Enterprise includes a small free tier
		unit: 'transformations',
		dataset: 'imagesTransformationsAdaptiveGroups',
		field: '',
		aggregation: 'count',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use Images
		docsUrl: 'https://developers.cloudflare.com/images/',
		note: 'Billed once per 30 days per unique URL. See developers.cloudflare.com/images/pricing.',
	},
];
