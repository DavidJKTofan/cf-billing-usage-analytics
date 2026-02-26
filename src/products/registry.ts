/**
 * Product Registry (Legacy Re-export)
 *
 * This file re-exports from the modular index for backward compatibility.
 * For new code, import directly from './index' or category-specific files.
 *
 * Structure:
 * - compute.ts    - Workers, Pages, Durable Objects, Queues
 * - storage.ts    - R2, KV, D1
 * - network.ts    - HTTP Requests, Bandwidth, DNS, Load Balancing
 * - security.ts   - WAF, Bot Management, Rate Limiting
 * - media.ts      - Stream, Images
 * - ai.ts         - Workers AI, AI Gateway, Vectorize
 * - connectivity.ts - Tunnels, Gateway, Access, Browser Isolation
 * - index.ts      - Aggregates all products
 *
 * To add a new product:
 * 1. Find the appropriate category file (e.g., compute.ts for Workers)
 * 2. Add a ProductDefinition to the category array
 * 3. The product will automatically appear in the dashboard and config
 *
 * IMPORTANT NOTES:
 * - Account-scoped datasets typically don't have an "Account" prefix in the query
 *   (e.g., use "workersInvocationsAdaptive" not "AccountWorkersInvocationsAdaptive")
 * - For httpRequestsAdaptiveGroups, use aggregation: 'count' for request counts
 * - For httpRequestsAdaptiveGroups, use aggregation: 'sum' for bytes fields
 * - D1 and AI Gateway use filterField: 'date' instead of 'datetime'
 */

// Re-export everything from the modular index
export * from './index';
