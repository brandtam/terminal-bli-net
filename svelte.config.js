import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// No `routes` option: that only shapes the Pages-era _routes.json. On a
		// Workers deploy, static assets are served before the Worker runs, so the
		// old exclude list (/bots/*, /themes/*, favicons) is covered by default.
		adapter: adapter()
	}
};

export default config;
