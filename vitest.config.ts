import { defineConfig } from 'vitest/config';

// `pnpm test:unit` runs two projects under one command:
//  - "unit": app + server code, in node/jsdom with the Svelte plugin (vite.config.ts).
//  - "reminder-agent": the ReminderAgent Durable Object, inside the real Workers
//    runtime via @cloudflare/vitest-pool-workers (workers/reminder-agent/vitest.config.ts).
// They need different runtimes, so they live in separate configs and are composed here.
export default defineConfig({
	test: {
		projects: ['./vite.config.ts', './workers/reminder-agent/vitest.config.ts']
	}
});
