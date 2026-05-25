declare global {
	namespace App {
		interface Platform {
			env: {
				KV: KVNamespace;
				ANTHROPIC_API_KEY: string;
				OPENAI_API_KEY?: string;
				PROVIDER: string;
				MONTHLY_SPEND_CAP: string;
				RATE_LIMIT_PER_HOUR: string;
				SESSION_MESSAGE_CAP: string;
				MODEL?: string;
			};
		}
	}
}

export {};
