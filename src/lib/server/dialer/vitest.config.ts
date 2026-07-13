import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Runs the Dialer server suite inside the real Workers runtime (workerd) so
// D1, the DialerBoardNode's storage, and WebSocket upgrades behave as in
// production — same pattern as workers/reminder-agent. Bindings come from
// test/wrangler.jsonc; the real D1 migrations are applied per-test by the
// setup file, so the tests exercise the exact shipped schema.
export default defineConfig(async () => {
	const migrations = await readD1Migrations(
		new URL('../../../../migrations/dialer', import.meta.url).pathname
	);
	return {
		plugins: [
			cloudflareTest({
				// NOTE: this pool version has no per-test storage isolation — D1 and
				// DO storage persist across tests within a file, so tests use unique
				// handles/board names instead of assuming a fresh snapshot.
				wrangler: { configPath: './test/wrangler.jsonc' },
				miniflare: {
					bindings: { TEST_MIGRATIONS: migrations }
				}
			})
		],
		test: {
			name: 'dialer',
			include: ['test/**/*.test.ts'],
			setupFiles: ['./test/apply-migrations.ts']
		}
	};
});
