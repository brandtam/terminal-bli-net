import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { configDefaults, defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';
import { visualizer } from 'rollup-plugin-visualizer';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
	// Run `ANALYZE=1 pnpm build` to emit + open bundle-stats.html (a chunk treemap).
	const analyze = !!process.env.ANALYZE;
	const isTest = mode === 'test' || process.env.VITEST === 'true';

	return {
		plugins: [
			// SvelteKit's dev-server lifecycle leaves file handles open under Vitest.
			// Unit tests only need Svelte compilation and $lib aliasing, so use the
			// lighter Svelte plugin there and keep SvelteKit for app dev/build.
			isTest ? svelte() : sveltekit(),
			// Bundle visualizer — only added for an analyze build, so normal builds and
			// dev are untouched. `as never` bridges the Rollup/Vite plugin-type gap.
			...(analyze
				? [
						visualizer({
							filename: 'bundle-stats.html',
							gzipSize: true,
							brotliSize: true,
							open: true
						}) as never
					]
				: [])
		],
		resolve: {
			alias: {
				$lib: new URL('./src/lib', import.meta.url).pathname
			}
		},
		define: {
			__APP_VERSION__: JSON.stringify(pkg.version)
		},
		build: {
			// Chunk-size guardrail: warn (non-fatal, non-flaky) if any single chunk
			// exceeds this budget. Vite measures uncompressed bytes, so this is a
			// raw-KB limit — the gzipped number you'd see in devtools is ~3x smaller.
			// After the lazy-loading work the largest chunk is ~165 KB raw (~45 KB gz);
			// 250 KB raw leaves headroom while still catching a regression where a
			// whole app or library lands back in the eager graph.
			chunkSizeWarningLimit: 250
		},
		test: {
			// The "node" project: app + server code, jsdom/node with the Svelte plugin.
			name: 'unit',
			include: [
				'src/**/*.{test,spec}.{js,ts}',
				'scripts/**/*.{test,spec}.{js,ts}',
				'workers/**/*.{test,spec}.{js,ts}'
			],
			// The Durable Object suite needs the real Workers runtime — it runs in the
			// Cloudflare pool project instead (workers/reminder-agent/vitest.config.ts).
			exclude: [...configDefaults.exclude, 'workers/reminder-agent/test/**']
		}
	};
});
