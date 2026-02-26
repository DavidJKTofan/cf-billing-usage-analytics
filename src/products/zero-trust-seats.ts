/**
 * Zero Trust Seats Module
 *
 * Provides functionality to fetch and display Zero Trust user/seat information.
 * Zero Trust products (Access, Gateway, Browser Isolation, WARP) are billed per seat,
 * not per request, so we need to track seat usage separately from GraphQL Analytics.
 *
 * @see https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/
 */

// Re-export types and function from cloudflare-api
export { getZeroTrustSeats } from '../cloudflare-api';
export type { ZeroTrustSeats, ZeroTrustUser } from '../cloudflare-api';

/**
 * Contract limit for Zero Trust seats (configurable)
 * Set this based on your Enterprise contract
 */
export const DEFAULT_ZERO_TRUST_SEAT_LIMIT = 0; // 0 = no limit configured

/**
 * Zero Trust seat type descriptions
 */
export const SEAT_TYPES = {
	access: {
		name: 'Access Seats',
		description: 'Users who have authenticated with Cloudflare Access',
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/policies/access/',
	},
	gateway: {
		name: 'Gateway Seats',
		description: 'Users who have logged into the WARP client',
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/policies/gateway/',
	},
	active: {
		name: 'Active Seats',
		description: 'Users with either Access or Gateway seat (billed seats)',
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/',
	},
	total: {
		name: 'Total Users',
		description: 'All users in the Zero Trust organization',
		docsUrl: 'https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/',
	},
} as const;

/**
 * Format seat count for display
 */
export function formatSeatCount(count: number): string {
	return count.toLocaleString();
}

/**
 * Calculate seat usage percentage against a contract limit
 */
export function calculateSeatUsagePercent(activeSeats: number, contractLimit: number): number {
	if (contractLimit <= 0) return 0;
	return (activeSeats / contractLimit) * 100;
}

/**
 * Get seat status based on usage percentage
 */
export function getSeatStatus(
	activeSeats: number,
	contractLimit: number,
	warningThreshold = 70,
	alertThreshold = 90
): 'healthy' | 'warning' | 'alert' | 'critical' | 'unlimited' {
	if (contractLimit <= 0) return 'unlimited';

	const percent = calculateSeatUsagePercent(activeSeats, contractLimit);
	if (percent >= 100) return 'critical';
	if (percent >= alertThreshold) return 'alert';
	if (percent >= warningThreshold) return 'warning';
	return 'healthy';
}
