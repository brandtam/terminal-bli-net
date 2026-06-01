declare global {
	const __APP_VERSION__: string;

	namespace App {
		interface Platform {
			env: {
				KV: KVNamespace;
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
		}
	}
}

export {};
