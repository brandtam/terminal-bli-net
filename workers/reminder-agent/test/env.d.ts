import type { ReminderAgent } from '../src/index';

// Types for the bindings exposed to tests via `cloudflare:test`'s `env`.
// Augments the pool's base ProvidedEnv with this worker's bindings.
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		REMINDER_AGENT: DurableObjectNamespace<ReminderAgent>;
		EMAIL_SECRET: string;
		REMINDER_CONTENT_URL: string;
		REMINDER_LEAD_MINUTES: string;
	}
}
