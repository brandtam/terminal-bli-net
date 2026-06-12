import { LLM_PROVIDERS, type LlmProvider } from '$lib/types';
import type { LedgerCeilings, MonthlyProviderCaps } from './types';

/**
 * Ceiling configuration for the Spend Ledger. Lives in its own module so both
 * the public barrel (`index.ts`) and the adapter factory (`factory.ts`) can read
 * it without an import cycle.
 */

/** Defaults match docs/prd/cost-abuse-hardening.md. */
export const DEFAULT_CEILINGS: LedgerCeilings = {
	dailySpendUsd: 3,
	dailyRequests: 5000,
	monthlyProviderUsd: { claude: 25, openai: 25 }
};

export const DEFAULT_RESERVATION_TTL_MS = 60_000;

export interface CeilingEnv {
	DAILY_SPEND_CAP_USD?: string;
	DAILY_REQUEST_CAP?: string;
	ANTHROPIC_MONTHLY_SPEND_CAP?: string;
	OPENAI_MONTHLY_SPEND_CAP?: string;
}

const MONTHLY_CAP_ENV: Record<LlmProvider, keyof CeilingEnv> = {
	claude: 'ANTHROPIC_MONTHLY_SPEND_CAP',
	openai: 'OPENAI_MONTHLY_SPEND_CAP'
};

function positiveNumber(raw: string | undefined, fallback: number): number {
	if (raw === undefined || raw.trim() === '') return fallback;
	const value = Number(raw);
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Build ceilings from environment variables, falling back to the defaults. */
export function resolveCeilings(env: CeilingEnv): LedgerCeilings {
	const monthlyProviderUsd = Object.fromEntries(
		LLM_PROVIDERS.map((provider) => [
			provider,
			positiveNumber(env[MONTHLY_CAP_ENV[provider]], DEFAULT_CEILINGS.monthlyProviderUsd[provider])
		])
	) as MonthlyProviderCaps;

	return {
		dailySpendUsd: positiveNumber(env.DAILY_SPEND_CAP_USD, DEFAULT_CEILINGS.dailySpendUsd),
		dailyRequests: positiveNumber(env.DAILY_REQUEST_CAP, DEFAULT_CEILINGS.dailyRequests),
		monthlyProviderUsd
	};
}
