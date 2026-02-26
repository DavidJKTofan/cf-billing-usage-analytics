/**
 * Product Registry Index
 *
 * Aggregates all product definitions from category-specific files.
 * Import from this file to get all products or specific category exports.
 */

// Re-export types
export * from './types';

// Import category-specific products
import { COMPUTE_PRODUCTS } from './compute';
import { STORAGE_PRODUCTS } from './storage';
import { NETWORK_PRODUCTS } from './network';
import { SECURITY_PRODUCTS } from './security';
import { MEDIA_PRODUCTS } from './media';
import { AI_PRODUCTS } from './ai';
import { CONNECTIVITY_PRODUCTS } from './connectivity';
import { PLATFORM_PRODUCTS } from './platform';

// Re-export category arrays for direct access
export {
	COMPUTE_PRODUCTS,
	STORAGE_PRODUCTS,
	NETWORK_PRODUCTS,
	SECURITY_PRODUCTS,
	MEDIA_PRODUCTS,
	AI_PRODUCTS,
	CONNECTIVITY_PRODUCTS,
	PLATFORM_PRODUCTS,
};

import type { ProductDefinition, ProductCategory } from './types';

/**
 * All available products for monitoring (aggregated from all categories)
 */
export const PRODUCTS: ProductDefinition[] = [
	...COMPUTE_PRODUCTS,
	...STORAGE_PRODUCTS,
	...NETWORK_PRODUCTS,
	...SECURITY_PRODUCTS,
	...MEDIA_PRODUCTS,
	...AI_PRODUCTS,
	...CONNECTIVITY_PRODUCTS,
	...PLATFORM_PRODUCTS,
];

/**
 * Get all products
 */
export function getAllProducts(): ProductDefinition[] {
	return PRODUCTS;
}

/**
 * Get a product by ID
 */
export function getProductById(id: string): ProductDefinition | undefined {
	return PRODUCTS.find((p) => p.id === id);
}

/**
 * Get products by category
 */
export function getProductsByCategory(category: ProductCategory): ProductDefinition[] {
	return PRODUCTS.filter((p) => p.category === category);
}

/**
 * Get products by scope
 */
export function getProductsByScope(scope: 'zone' | 'account'): ProductDefinition[] {
	return PRODUCTS.filter((p) => p.scope === scope);
}

/**
 * Get products enabled by default
 */
export function getDefaultEnabledProducts(): ProductDefinition[] {
	return PRODUCTS.filter((p) => p.enabledByDefault);
}

/**
 * Get all unique categories
 */
export function getAllCategories(): ProductCategory[] {
	return [...new Set(PRODUCTS.map((p) => p.category))];
}

/**
 * Category display names
 */
export const CATEGORY_NAMES: Record<ProductCategory, string> = {
	compute: 'Compute',
	storage: 'Storage',
	network: 'Application Services',
	security: 'Security',
	media: 'Media',
	ai: 'AI & ML',
	connectivity: 'Zero Trust & Connectivity',
	platform: 'Platform Services',
};

/**
 * Category-specific product arrays for easy access
 */
export const PRODUCTS_BY_CATEGORY: Record<ProductCategory, ProductDefinition[]> = {
	compute: COMPUTE_PRODUCTS,
	storage: STORAGE_PRODUCTS,
	network: NETWORK_PRODUCTS,
	security: SECURITY_PRODUCTS,
	media: MEDIA_PRODUCTS,
	ai: AI_PRODUCTS,
	connectivity: CONNECTIVITY_PRODUCTS,
	platform: PLATFORM_PRODUCTS,
};
