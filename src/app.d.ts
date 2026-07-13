declare global {
	const __APP_VERSION__: string;

	namespace App {
		interface Platform {
			env: {
				KV: KVNamespace;
				// Dialer (docs/adr/0008: app-prefixed bindings). Present on a real
				// Workers deploy and under wrangler dev; plain `pnpm dev` emulates D1
				// but cannot host same-worker DO classes — /api/dialer/* answers 503
				// there and the app degrades to LOCAL MODE.
				DIALER_DB: D1Database;
				DIALER_FILES: R2Bucket;
				DIALER_BOARD_NODE: DurableObjectNamespace<
					import('$lib/server/dialer/board-node').DialerBoardNode
				>;
				/** Kill switch secret: truthy -> every /api/dialer/* answers 503. */
				DIALER_FORCE_LOCAL?: string;
				REMINDER_SERVICE?: Fetcher;
				SPEND_LEDGER?: Fetcher;
				SPEND_LEDGER_REQUIRED?: string;
				DAILY_SPEND_CAP_USD?: string;
				DAILY_REQUEST_CAP?: string;
				TURNSTILE_SECRET?: string;
				REMINDER_SUBSCRIBE_RATE_LIMIT_PER_HOUR?: string;
				ANTHROPIC_API_KEY?: string;
				OPENAI_API_KEY?: string;
				LLM_PROVIDER_ORDER?: string;
				ANTHROPIC_MODEL?: string;
				OPENAI_MODEL?: string;
				ANTHROPIC_MONTHLY_SPEND_CAP?: string;
				OPENAI_MONTHLY_SPEND_CAP?: string;
				RATE_LIMIT_PER_HOUR: string;
				PROVIDER?: string;
				MONTHLY_SPEND_CAP?: string;
				MODEL?: string;
			};
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
