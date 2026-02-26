/**
 * Cloudflare REST API Client
 *
 * Provides functions to interact with Cloudflare's REST API
 * for fetching account and zone information.
 */

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Zone information returned from the API
 */
export interface Zone {
	id: string;
	name: string;
	status: 'initializing' | 'pending' | 'active' | 'moved';
	paused: boolean;
	type: 'full' | 'partial' | 'secondary' | 'internal';
	account: {
		id: string;
		name: string;
	};
	created_on: string;
	modified_on: string;
	activated_on: string | null;
}

/**
 * Result of zone discovery
 */
export interface ZoneDiscoveryResult {
	zones: Zone[];
	zoneIds: string[];
	total: number;
	error?: string;
	durationMs: number;
}

/**
 * Cloudflare API response structure
 */
interface CloudflareApiResponse<T> {
	success: boolean;
	errors: Array<{ code: number; message: string }>;
	messages: Array<{ code: number; message: string }>;
	result: T;
	result_info?: {
		page: number;
		per_page: number;
		total_pages: number;
		count: number;
		total_count: number;
	};
}

/**
 * Fetch all zones for an account
 *
 * @param apiToken - Cloudflare API token with Zone:Read permission
 * @param accountId - Cloudflare account ID
 * @returns List of active zones and their IDs
 */
export async function discoverZones(apiToken: string, accountId: string): Promise<ZoneDiscoveryResult> {
	const startTime = Date.now();
	const allZones: Zone[] = [];
	let page = 1;
	const perPage = 50; // Maximum allowed

	try {
		// Paginate through all zones
		while (true) {
			const url = new URL(`${CLOUDFLARE_API_BASE}/zones`);
			url.searchParams.set('account.id', accountId);
			url.searchParams.set('status', 'active'); // Only get active zones
			url.searchParams.set('page', page.toString());
			url.searchParams.set('per_page', perPage.toString());

			const response = await fetch(url.toString(), {
				headers: {
					Authorization: `Bearer ${apiToken}`,
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`API request failed: ${response.status} - ${errorText}`);
			}

			const data = (await response.json()) as CloudflareApiResponse<Zone[]>;

			if (!data.success) {
				const errorMessages = data.errors.map((e) => e.message).join(', ');
				throw new Error(`API error: ${errorMessages}`);
			}

			allZones.push(...data.result);

			// Check if there are more pages
			const resultInfo = data.result_info;
			if (!resultInfo || page >= resultInfo.total_pages) {
				break;
			}

			page++;

			// Small delay to avoid rate limiting
			if (page <= resultInfo.total_pages) {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}

		return {
			zones: allZones,
			zoneIds: allZones.map((z) => z.id),
			total: allZones.length,
			durationMs: Date.now() - startTime,
		};
	} catch (error) {
		return {
			zones: [],
			zoneIds: [],
			total: 0,
			error: error instanceof Error ? error.message : String(error),
			durationMs: Date.now() - startTime,
		};
	}
}

/**
 * Get a single zone by ID
 *
 * @param apiToken - Cloudflare API token
 * @param zoneId - Zone ID
 * @returns Zone information or null if not found
 */
export async function getZone(apiToken: string, zoneId: string): Promise<Zone | null> {
	try {
		const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}`, {
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as CloudflareApiResponse<Zone>;

		if (!data.success) {
			return null;
		}

		return data.result;
	} catch {
		return null;
	}
}
