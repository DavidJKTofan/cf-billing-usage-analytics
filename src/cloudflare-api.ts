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
 * Zero Trust user information
 */
export interface ZeroTrustUser {
	id: string;
	uid: string;
	name: string;
	email: string;
	access_seat: boolean;
	gateway_seat: boolean;
	active_device_count: number;
	created_at: string;
	updated_at: string;
	last_successful_login: string | null;
	seat_uid: string | null;
}

/**
 * Zero Trust seats summary
 */
export interface ZeroTrustSeats {
	totalUsers: number;
	accessSeats: number;
	gatewaySeats: number;
	activeSeats: number; // Users with either access_seat or gateway_seat
	error?: string;
	durationMs: number;
}

/**
 * Fetch Zero Trust users and calculate seat usage
 *
 * @param apiToken - Cloudflare API token with Access:Read permission
 * @param accountId - Cloudflare account ID
 * @returns Seat usage summary
 */
export async function getZeroTrustSeats(apiToken: string, accountId: string): Promise<ZeroTrustSeats> {
	const startTime = Date.now();

	try {
		// Fetch first page to get total count (we just need the count, not all users)
		const url = new URL(`${CLOUDFLARE_API_BASE}/accounts/${accountId}/access/users`);
		url.searchParams.set('per_page', '1000'); // Max per page
		url.searchParams.set('page', '1');

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

		const data = (await response.json()) as CloudflareApiResponse<ZeroTrustUser[]>;

		if (!data.success) {
			const errorMessages = data.errors.map((e) => e.message).join(', ');
			throw new Error(`API error: ${errorMessages}`);
		}

		// Count seats from the users we got
		let accessSeats = 0;
		let gatewaySeats = 0;
		let activeSeats = 0;
		const allUsers: ZeroTrustUser[] = [...data.result];

		// If there are more pages, fetch them all
		const resultInfo = data.result_info;
		if (resultInfo && resultInfo.total_pages > 1) {
			for (let page = 2; page <= resultInfo.total_pages; page++) {
				url.searchParams.set('page', page.toString());
				const pageResponse = await fetch(url.toString(), {
					headers: {
						Authorization: `Bearer ${apiToken}`,
						'Content-Type': 'application/json',
					},
				});

				if (pageResponse.ok) {
					const pageData = (await pageResponse.json()) as CloudflareApiResponse<ZeroTrustUser[]>;
					if (pageData.success) {
						allUsers.push(...pageData.result);
					}
				}

				// Small delay to avoid rate limiting
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}

		// Count seat types
		for (const user of allUsers) {
			if (user.access_seat) accessSeats++;
			if (user.gateway_seat) gatewaySeats++;
			if (user.access_seat || user.gateway_seat) activeSeats++;
		}

		return {
			totalUsers: resultInfo?.total_count ?? allUsers.length,
			accessSeats,
			gatewaySeats,
			activeSeats,
			durationMs: Date.now() - startTime,
		};
	} catch (error) {
		return {
			totalUsers: 0,
			accessSeats: 0,
			gatewaySeats: 0,
			activeSeats: 0,
			error: error instanceof Error ? error.message : String(error),
			durationMs: Date.now() - startTime,
		};
	}
}


