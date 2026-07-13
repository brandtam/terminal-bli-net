import { defineConfig } from 'vitest/config';

// `pnpm test:unit` runs three projects under one command:
//  - "unit": app + server code, in node/jsdom with the Svelte plugin (vite.config.ts).
//  - "reminder-agent": the ReminderAgent Durable Object, inside the real Workers
//    runtime via @cloudflare/vitest-pool-workers (workers/reminder-agent/vitest.config.ts).
//  - "dialer": the Dialer's D1 auth/session/cron + DialerBoardNode DO, also in
//    the Workers runtime (src/lib/server/dialer/vitest.config.ts).
// They need different runtimes, so they live in separate configs and are composed here.
export default defineConfig({
	test: {
		projects: [
			'./vite.config.ts',
			'./workers/reminder-agent/vitest.config.ts',
			'./src/lib/server/dialer/vitest.config.ts'
		]
	}
});
