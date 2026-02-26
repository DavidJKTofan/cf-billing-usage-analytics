/**
 * Storage Products
 *
 * R2, KV, D1
 */

import type { ProductDefinition } from './types';

/**
 * R2 Class A operations - mutating operations (write/list)
 * Official list from: https://developers.cloudflare.com/r2/pricing/#class-a-operations
 *
 * Includes: ListBuckets, PutBucket, ListObjects, PutObject, CopyObject,
 * CompleteMultipartUpload, CreateMultipartUpload, LifecycleStorageTierTransition,
 * ListMultipartUploads, UploadPart, UploadPartCopy, ListParts, PutBucketEncryption,
 * PutBucketCors, PutBucketLifecycleConfiguration
 */
const R2_CLASS_A_ACTIONS = [
	'ListBuckets',
	'PutBucket',
	'ListObjects',
	'PutObject',
	'CopyObject',
	'CompleteMultipartUpload',
	'CreateMultipartUpload',
	'LifecycleStorageTierTransition',
	'ListMultipartUploads',
	'UploadPart',
	'UploadPartCopy',
	'ListParts',
	'PutBucketEncryption',
	'PutBucketCors',
	'PutBucketLifecycleConfiguration',
];

/**
 * R2 Class B operations - read operations
 * Official list from: https://developers.cloudflare.com/r2/pricing/#class-b-operations
 *
 * Includes: HeadBucket, HeadObject, GetObject, UsageSummary, GetBucketEncryption,
 * GetBucketLocation, GetBucketCors, GetBucketLifecycleConfiguration
 */
const R2_CLASS_B_ACTIONS = [
	'HeadBucket',
	'HeadObject',
	'GetObject',
	'UsageSummary',
	'GetBucketEncryption',
	'GetBucketLocation',
	'GetBucketCors',
	'GetBucketLifecycleConfiguration',
];

/**
 * R2 Free operations (no charge)
 * Official list from: https://developers.cloudflare.com/r2/pricing/#free-operations
 *
 * Includes: DeleteObject, DeleteBucket, AbortMultipartUpload
 * Note: These are tracked but NOT billed, so we don't need to filter them out
 */
// const R2_FREE_ACTIONS = ['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload'];

export const STORAGE_PRODUCTS: ProductDefinition[] = [
	// R2 Class A Operations (mutating)
	{
		id: 'r2_class_a_operations',
		name: 'R2 Class A Operations',
		category: 'storage',
		description: 'R2 mutating operations (PUT, LIST, multipart uploads)',
		defaultLimit: 1_000_000,
		unit: 'operations',
		dataset: 'r2OperationsAdaptiveGroups',
		field: 'requests',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/r2/pricing/',
		dimensionFilters: { actionType_in: R2_CLASS_A_ACTIONS },
		note: 'Write/list operations. See developers.cloudflare.com/r2/pricing for official rates.',
	},
	// R2 Class B Operations (read-only)
	{
		id: 'r2_class_b_operations',
		name: 'R2 Class B Operations',
		category: 'storage',
		description: 'R2 read operations (GET, HEAD)',
		defaultLimit: 10_000_000,
		unit: 'operations',
		dataset: 'r2OperationsAdaptiveGroups',
		field: 'requests',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/r2/pricing/',
		dimensionFilters: { actionType_in: R2_CLASS_B_ACTIONS },
		note: 'Read operations. See developers.cloudflare.com/r2/pricing for official rates.',
	},
	{
		id: 'r2_storage',
		name: 'R2 Storage',
		category: 'storage',
		description: 'Total storage used by R2 buckets',
		defaultLimit: 10 * 1024 * 1024 * 1024,
		unit: 'bytes',
		dataset: 'r2StorageAdaptiveGroups',
		field: 'payloadSize',
		aggregation: 'max', // R2 storage uses max aggregation per the docs
		scope: 'account',
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/r2/pricing/',
		note: 'FREE egress (no bandwidth charges) when used with Workers Binding or S3 API. See developers.cloudflare.com/r2/pricing for details.',
	},
	// R2 Egress is FREE - this is R2's key differentiator from AWS S3
	{
		id: 'r2_egress',
		name: 'R2 Egress',
		category: 'storage',
		description: 'Data transferred out of R2 (FREE - no egress fees)',
		defaultLimit: 0, // FREE - R2 has zero egress fees
		unit: 'bytes',
		dataset: 'r2OperationsAdaptiveGroups',
		field: 'responseBytes',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Disabled - R2 egress is FREE
		docsUrl: 'https://developers.cloudflare.com/r2/',
		note: 'FREE - R2 has zero egress fees when used with Workers Binding or S3 API. This is a key differentiator from AWS S3.',
	},
	{
		id: 'kv_reads',
		name: 'KV Reads',
		category: 'storage',
		description: 'Total KV read operations',
		defaultLimit: 10_000_000,
		unit: 'operations',
		dataset: 'workersKvStorageAdaptiveGroups',
		field: 'readOperations',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use KV
		docsUrl: 'https://developers.cloudflare.com/kv/',
		note: 'See developers.cloudflare.com/kv/platform/pricing for details.',
	},
	{
		id: 'kv_writes',
		name: 'KV Writes',
		category: 'storage',
		description: 'Total KV write/delete/list operations',
		defaultLimit: 1_000_000,
		unit: 'operations',
		dataset: 'workersKvStorageAdaptiveGroups',
		field: 'writeOperations',
		aggregation: 'sum',
		scope: 'account',
		enabledByDefault: false, // Dataset not available on most accounts - enable if you use KV
		docsUrl: 'https://developers.cloudflare.com/kv/',
		note: 'See developers.cloudflare.com/kv/platform/pricing for details.',
	},
	{
		id: 'd1_rows_read',
		name: 'D1 Rows Read',
		category: 'storage',
		description: 'Total rows read from D1 databases',
		defaultLimit: 25_000_000_000,
		unit: 'rows',
		dataset: 'd1AnalyticsAdaptiveGroups',
		field: 'rowsRead',
		aggregation: 'sum',
		scope: 'account',
		filterField: 'date', // D1 uses date filter
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/d1/',
		note: 'Counts all rows scanned. See developers.cloudflare.com/d1/platform/pricing for details.',
	},
	{
		id: 'd1_rows_written',
		name: 'D1 Rows Written',
		category: 'storage',
		description: 'Total rows written to D1 databases',
		defaultLimit: 50_000_000,
		unit: 'rows',
		dataset: 'd1AnalyticsAdaptiveGroups',
		field: 'rowsWritten',
		aggregation: 'sum',
		scope: 'account',
		filterField: 'date', // D1 uses date filter
		enabledByDefault: true,
		docsUrl: 'https://developers.cloudflare.com/d1/',
		note: 'See developers.cloudflare.com/d1/platform/pricing for details.',
	},
];
