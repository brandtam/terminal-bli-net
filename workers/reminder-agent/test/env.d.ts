import type { ReminderAgent, SpendLedgerDO } from '../src/index';

// Types for the bindings exposed to tests via `cloudflare:test`'s `env`.
// Augments the pool's base ProvidedEnv with this worker's bindings.
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		REMINDER_AGENT: DurableObjectNamespace<ReminderAgent>;
		SPEND_LEDGER_DO: DurableObjectNamespace<SpendLedgerDO>;
		EMAIL_SECRET: string;
		REMINDER_CONTENT_URL: string;
		REMINDER_LEAD_MINUTES: string;
		DAILY_SPEND_CAP_USD: string;
		DAILY_REQUEST_CAP: string;
		ANTHROPIC_MONTHLY_SPEND_CAP: string;
		OPENAI_MONTHLY_SPEND_CAP: string;
	}
}
