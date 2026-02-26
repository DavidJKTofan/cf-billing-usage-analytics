import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('Cloudflare Billing & Usage Analytics', () => {
	describe('Health check endpoint', () => {
		it('/health responds with OK (unit style)', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/health');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe('OK');
		});

		it('/health responds with OK (integration style)', async () => {
			const request = new Request('http://example.com/health');
			const response = await SELF.fetch(request);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe('OK');
		});
	});

	describe('API endpoints', () => {
		it('/api/products returns product list', async () => {
			const request = new Request('http://example.com/api/products');
			const response = await SELF.fetch(request);
			expect(response.status).toBe(200);

			const data = await response.json() as { products: unknown[]; categories: unknown[] };
			expect(data.products).toBeDefined();
			expect(Array.isArray(data.products)).toBe(true);
			expect(data.products.length).toBeGreaterThan(0);
			expect(data.categories).toBeDefined();
		});

		it('/api/config returns configuration (without exposing secrets)', async () => {
			const request = new Request('http://example.com/api/config');
			const response = await SELF.fetch(request);
			expect(response.status).toBe(200);

			const data = await response.json() as {
				alertThresholdPercent: number;
				warningThresholdPercent: number;
				environment: Record<string, unknown>;
				products: Array<{ id: string; name: string; dataset?: string }>;
			};
			expect(data.alertThresholdPercent).toBe(90);
			expect(data.warningThresholdPercent).toBe(75);
			expect(data.environment).toBeDefined();
			// Should expose boolean status flags (not actual secret values)
			expect(data.environment).toHaveProperty('hasApiToken');
			expect(data.environment).toHaveProperty('hasAccountId');
			expect(data.environment).toHaveProperty('hasDiscordWebhook');
			expect(data.environment).toHaveProperty('hasZoneTags');
			expect(data.environment).toHaveProperty('zoneCount');
			// Also keep legacy fields for backwards compatibility
			expect(data.environment).toHaveProperty('configured');
			expect(data.environment).toHaveProperty('notificationsConfigured');
			expect(data.environment).toHaveProperty('zonesConfigured');
			expect(data.environment).toHaveProperty('authenticationEnabled');
			// Should NOT expose actual secret values
			expect(data.environment).not.toHaveProperty('apiToken');
			expect(data.environment).not.toHaveProperty('accountId');
			expect(data.environment).not.toHaveProperty('discordWebhookUrl');
			// Products should include dataset field
			expect(data.products).toBeDefined();
			expect(data.products.length).toBeGreaterThan(0);
			expect(data.products[0]).toHaveProperty('dataset');
		});

		it('/api/trigger requires POST method', async () => {
			const request = new Request('http://example.com/api/trigger', { method: 'GET' });
			const response = await SELF.fetch(request);
			expect(response.status).toBe(405);
		});

		it('/api/test-discord requires POST method', async () => {
			const request = new Request('http://example.com/api/test-discord', { method: 'GET' });
			const response = await SELF.fetch(request);
			expect(response.status).toBe(405);
		});
	});

	describe('CORS handling', () => {
		it('OPTIONS request returns CORS headers', async () => {
			const request = new Request('http://example.com/api/products', {
				method: 'OPTIONS',
				headers: { Origin: 'http://localhost:3000' },
			});
			const response = await SELF.fetch(request);
			expect(response.status).toBe(204);
			expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
			expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
		});

		it('API responses include CORS headers', async () => {
			const request = new Request('http://example.com/api/products', {
				headers: { Origin: 'http://localhost:3000' },
			});
			const response = await SELF.fetch(request);
			expect(response.headers.has('Access-Control-Allow-Origin')).toBe(true);
		});
	});

	describe('404 handling', () => {
		it('Unknown paths return 404', async () => {
			const request = new Request('http://example.com/unknown-path');
			const response = await SELF.fetch(request);
			expect(response.status).toBe(404);
		});

		it('Unknown API paths return 404 JSON', async () => {
			const request = new Request('http://example.com/api/unknown');
			const response = await SELF.fetch(request);
			expect(response.status).toBe(404);
			const data = await response.json() as { error: string };
			expect(data.error).toBe('Not found');
		});
	});

	describe('Input validation', () => {
		it('/api/status requires valid instanceId', async () => {
			// Missing instanceId
			let request = new Request('http://example.com/api/status');
			let response = await SELF.fetch(request);
			expect(response.status).toBe(400);

			// Invalid instanceId format (injection attempt)
			request = new Request('http://example.com/api/status?instanceId=<script>alert(1)</script>');
			response = await SELF.fetch(request);
			expect(response.status).toBe(400);
		});
	});
});
