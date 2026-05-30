import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';
import { visualizer } from 'rollup-plugin-visualizer';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Run `ANALYZE=1 pnpm build` to emit + open bundle-stats.html (a chunk treemap).
const analyze = !!process.env.ANALYZE;

export default defineConfig({
	plugins: [
		sveltekit(),
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
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	build: {
		// Chunk-size guardrail: warn (non-fatal, non-flaky) if any single chunk
		// exceeds this raw-KB budget. The home/index chunk was ~106 KB gz before the
		// lazy-loading work; 250 KB leaves headroom while still catching a regression
		// where a whole app or library lands back in the eager graph.
		chunkSizeWarningLimit: 250
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
