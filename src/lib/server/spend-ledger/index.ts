import type { LedgerCeilings } from './types';

export type {
	CandidateProvider,
	CeilingId,
	LedgerCeilings,
	LedgerStatus,
	MonthlyProviderCaps,
	ReconcileInput,
	ReserveRequest,
	ReserveResult,
	SpendLedger
} from './types';
export { LedgerCore, type LedgerState } from './ledger-core';
export { InMemorySpendLedger } from './in-memory-ledger';
export { worstCaseCostUsd, actualCostUsd } from './cost';

/** Defaults match docs/prd/cost-abuse-hardening.md. */
export const DEFAULT_CEILINGS: LedgerCeilings = {
	dailySpendUsd: 3,
	dailyRequests: 5000,
	monthlyProviderUsd: { claude: 25, openai: 25 }
};

export const DEFAULT_RESERVATION_TTL_MS = 60_000;

interface CeilingEnv {
	DAILY_SPEND_CAP_USD?: string;
	DAILY_REQUEST_CAP?: string;
	ANTHROPIC_MONTHLY_SPEND_CAP?: string;
	OPENAI_MONTHLY_SPEND_CAP?: string;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
	if (raw === undefined || raw.trim() === '') return fallback;
	const value = Number(raw);
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Build ceilings from environment variables, falling back to the defaults. */
export function resolveCeilings(env: CeilingEnv): LedgerCeilings {
	return {
		dailySpendUsd: positiveNumber(env.DAILY_SPEND_CAP_USD, DEFAULT_CEILINGS.dailySpendUsd),
		dailyRequests: positiveNumber(env.DAILY_REQUEST_CAP, DEFAULT_CEILINGS.dailyRequests),
		monthlyProviderUsd: {
			claude: positiveNumber(
				env.ANTHROPIC_MONTHLY_SPEND_CAP,
				DEFAULT_CEILINGS.monthlyProviderUsd.claude
			),
			openai: positiveNumber(
				env.OPENAI_MONTHLY_SPEND_CAP,
				DEFAULT_CEILINGS.monthlyProviderUsd.openai
			)
		}
	};
}
