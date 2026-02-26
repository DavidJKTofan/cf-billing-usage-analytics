/**
 * Security Utilities for Enterprise-Grade Protection
 *
 * This module provides security primitives following Cloudflare Workers best practices:
 * - Timing-safe token comparison using Web Crypto API
 * - Optional API key authentication for sensitive endpoints
 * - CORS configuration with environment-based origin restrictions
 * - Rate limiting awareness and tracking
 * - Input validation and sanitization utilities
 * - Structured security event logging
 *
 * SECURITY CONSIDERATIONS:
 * 1. API tokens in environment variables are never logged or exposed
 * 2. All secret comparisons use timing-safe algorithms to prevent side-channel attacks
 * 3. CORS is restricted to configured origins in production
 * 4. Sensitive endpoints require authentication when API_ACCESS_KEY is configured
 */

/**
 * Security configuration interface
 */
export interface SecurityConfig {
	/** Optional API access key for protecting sensitive endpoints */
	apiAccessKey?: string;

	/** Allowed CORS origins (comma-separated or "*" for development) */
	allowedOrigins?: string;

	/** Enable debug logging for security events */
	debugSecurity?: boolean;
}

/**
 * Security event types for structured logging
 */
export type SecurityEventType =
	| 'auth_success'
	| 'auth_failure'
	| 'rate_limit_warning'
	| 'input_validation_failure'
	| 'cors_blocked'
	| 'sensitive_endpoint_access';

/**
 * Structured security event for logging
 */
export interface SecurityEvent {
	type: SecurityEventType;
	timestamp: string;
	path: string;
	method: string;
	sourceIp?: string;
	userAgent?: string;
	details?: Record<string, unknown>;
}

/**
 * Timing-safe comparison of two strings using Web Crypto API
 *
 * This prevents timing side-channel attacks by ensuring the comparison
 * takes constant time regardless of how many characters match.
 *
 * @param provided - The provided value to compare
 * @param expected - The expected value to compare against
 * @returns Promise<boolean> - True if values match
 */
export async function timingSafeEqual(provided: string, expected: string): Promise<boolean> {
	const encoder = new TextEncoder();

	// Hash both values to a fixed size first to avoid length-based timing leaks
	const [providedHash, expectedHash] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(provided)),
		crypto.subtle.digest('SHA-256', encoder.encode(expected)),
	]);

	return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

/**
 * Verify an API access key from request headers
 *
 * Checks the Authorization header for a Bearer token or X-API-Key header.
 * Uses timing-safe comparison to prevent side-channel attacks.
 *
 * @param request - The incoming request
 * @param expectedKey - The expected API key from environment
 * @returns Promise<boolean> - True if authentication succeeds
 */
export async function verifyApiKey(request: Request, expectedKey: string): Promise<boolean> {
	// Check Authorization: Bearer <token>
	const authHeader = request.headers.get('Authorization');
	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.substring(7);
		return timingSafeEqual(token, expectedKey);
	}

	// Check X-API-Key header
	const apiKeyHeader = request.headers.get('X-API-Key');
	if (apiKeyHeader) {
		return timingSafeEqual(apiKeyHeader, expectedKey);
	}

	return false;
}

/**
 * Generate a cryptographically secure random token
 *
 * Uses Web Crypto API for secure random bytes.
 *
 * @param length - The byte length of the token (default: 32)
 * @returns string - Hex-encoded token
 */
export function generateSecureToken(length: number = 32): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Endpoints that require authentication when API_ACCESS_KEY is configured
 */
export const PROTECTED_ENDPOINTS = [
	'/api/trigger', // Can trigger workflow execution
	'/api/test-discord', // Can send external notifications
	'/api/check', // Can run queries against the API
];

/**
 * Endpoints that should never expose sensitive configuration
 */
export const REDACTED_CONFIG_ENDPOINTS = [
	'/api/config',
	'/api/discover',
];

/**
 * Check if an endpoint requires authentication
 */
export function isProtectedEndpoint(pathname: string): boolean {
	return PROTECTED_ENDPOINTS.some((ep) => pathname === ep || pathname.startsWith(ep + '?'));
}

/**
 * Parse allowed origins from configuration
 *
 * @param originsConfig - Comma-separated origins or "*"
 * @returns Array of allowed origins
 */
export function parseAllowedOrigins(originsConfig?: string): string[] {
	if (!originsConfig || originsConfig === '*') {
		return ['*'];
	}
	return originsConfig.split(',').map((o) => o.trim()).filter(Boolean);
}

/**
 * Check if an origin is allowed by CORS policy
 *
 * @param requestOrigin - The Origin header from the request
 * @param allowedOrigins - Array of allowed origins
 * @returns boolean - True if origin is allowed
 */
export function isOriginAllowed(requestOrigin: string | null, allowedOrigins: string[]): boolean {
	if (!requestOrigin) {
		// No origin header (same-origin request or non-browser)
		return true;
	}

	if (allowedOrigins.includes('*')) {
		return true;
	}

	return allowedOrigins.includes(requestOrigin);
}

/**
 * Get CORS headers based on configuration
 *
 * @param requestOrigin - The Origin header from the request
 * @param allowedOrigins - Array of allowed origins
 * @returns Headers object with CORS configuration
 */
export function getCorsHeaders(
	requestOrigin: string | null,
	allowedOrigins: string[]
): Record<string, string> {
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
		'Access-Control-Max-Age': '86400',
	};

	if (allowedOrigins.includes('*')) {
		headers['Access-Control-Allow-Origin'] = '*';
	} else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
		headers['Access-Control-Allow-Origin'] = requestOrigin;
		headers['Vary'] = 'Origin';
	}

	return headers;
}

/**
 * Validate and sanitize a zone ID
 *
 * Zone IDs should be 32-character hex strings.
 *
 * @param zoneId - The zone ID to validate
 * @returns string | null - Sanitized zone ID or null if invalid
 */
export function validateZoneId(zoneId: string | null | undefined): string | null {
	if (!zoneId) return null;

	// Zone IDs are 32-character hexadecimal strings
	const sanitized = zoneId.trim().toLowerCase();
	if (/^[a-f0-9]{32}$/.test(sanitized)) {
		return sanitized;
	}

	return null;
}

/**
 * Validate and sanitize a workflow instance ID
 *
 * Instance IDs should be alphanumeric with dashes.
 *
 * @param instanceId - The instance ID to validate
 * @returns string | null - Sanitized instance ID or null if invalid
 */
export function validateInstanceId(instanceId: string | null | undefined): string | null {
	if (!instanceId) return null;

	// Instance IDs are typically UUID-like or alphanumeric with dashes
	const sanitized = instanceId.trim();
	if (/^[a-zA-Z0-9-_]{1,128}$/.test(sanitized)) {
		return sanitized;
	}

	return null;
}

/**
 * Log a security event in structured JSON format
 *
 * @param event - The security event to log
 */
export function logSecurityEvent(event: SecurityEvent): void {
	console.log(JSON.stringify({
		security_event: true,
		...event,
	}));
}

/**
 * Extract security context from a request for logging
 *
 * @param request - The incoming request
 * @returns Partial security event context
 */
export function extractRequestContext(request: Request): Pick<SecurityEvent, 'sourceIp' | 'userAgent' | 'path' | 'method'> {
	const url = new URL(request.url);
	return {
		path: url.pathname,
		method: request.method,
		sourceIp: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || undefined,
		userAgent: request.headers.get('User-Agent') || undefined,
	};
}

/**
 * Create an unauthorized response
 */
export function createUnauthorizedResponse(allowedOrigins: string[], requestOrigin: string | null): Response {
	const corsHeaders = getCorsHeaders(requestOrigin, allowedOrigins);
	return new Response(JSON.stringify({ error: 'Unauthorized. API key required.' }), {
		status: 401,
		headers: {
			'Content-Type': 'application/json',
			'WWW-Authenticate': 'Bearer realm="API", X-API-Key',
			...corsHeaders,
		},
	});
}

/**
 * Create a forbidden response for CORS violations
 */
export function createCorsBlockedResponse(): Response {
	return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
		status: 403,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
