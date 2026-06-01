import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Runs the ReminderAgent tests inside the real Workers runtime (workerd) so the
// Durable Object's SQLite storage, alarms, and bindings behave as they do in
// production. Bindings come from this worker's wrangler.jsonc; see the Cloudflare
// "Testing Durable Objects" guide.
export default defineConfig({
	plugins: [
		cloudflareTest({
			// Each test gets a fresh, isolated copy of Durable Object storage.
			isolatedStorage: true,
			wrangler: { configPath: './wrangler.jsonc' },
			miniflare: {
				// EMAIL_SECRET is a deploy-time secret (set with `wrangler secret put`),
				// so it isn't in wrangler.jsonc vars. The agent refuses to run without
				// it — provide a deterministic value for tests.
				bindings: { EMAIL_SECRET: 'test-secret' }
			}
		})
	],
	resolve: {
		// The agent reaches into src/lib (e.g. reminder-delivery → `$lib/schedule`),
		// so mirror the app's `$lib` alias here.
		alias: {
			$lib: new URL('../../src/lib', import.meta.url).pathname
		}
	},
	test: {
		name: 'reminder-agent',
		include: ['test/**/*.test.ts']
	}
});
