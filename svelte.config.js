import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// No `routes` option: that only shapes the Pages-era _routes.json. On a
		// Workers deploy, static assets are served before the Worker runs, so the
		// old exclude list (/bots/*, /themes/*, favicons) is covered by default.
		//
		// The adapter reads wrangler.adapter.jsonc (NOT wrangler.jsonc): it rimrafs
		// and rewrites whatever `main` points at, and the real config's `main` is
		// the hand-written Worker entry (src/worker/index.ts) that wraps the
		// generated SvelteKit worker with Durable Objects and cron dispatch.
		adapter: adapter({ config: 'wrangler.adapter.jsonc' })
	}
};

export default config;
