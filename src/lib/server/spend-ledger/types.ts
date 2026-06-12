import type { LlmProvider } from '$lib/types';

/**
 * Spend Ledger — the single authority for every *dollar* ceiling on the chat
 * endpoint. See CONTEXT.md (Cost control) and docs/adr/0005-exact-spend-enforcement.md.
 *
 * The ledger works by reserve-then-reconcile: a request reserves its worst-case
 * cost before streaming, then reconciles to the actual cost once the stream
 * finishes. Reservations count against the ceilings immediately, so concurrent
 * requests can never push committed-plus-reserved spend past a cap. When the
 * route is willing to fail over across providers, the reserve call returns one
 * hold per fallback candidate that also fits the configured ceilings.
 */

/** A ceiling the ledger can refuse against. Used for denial reasons + metrics. */
export type CeilingId = 'daily-spend' | 'daily-requests' | 'monthly-provider';

/**
 * Why a reservation was refused: a specific ceiling, or the ledger being
 * unreachable. `ledger-unavailable` is the fail-closed path — when the money
 * authority can't be reached in production, the request is denied, never
 * permitted (see the adapter factory).
 */
export type DenialReason = CeilingId | 'ledger-unavailable';

/** One provider/model the request is willing to use, in preference order. */
export interface CandidateProvider {
	provider: LlmProvider;
	model: string;
}

export interface ReserveRequest {
	/** Ordered provider/model preferences. The ledger reserves each candidate that fits. */
	candidates: CandidateProvider[];
	/** Upper-bound input tokens for this request (used for the worst-case hold). */
	maxInputTokens: number;
	/** Hard output-token cap for this request (used for the worst-case hold). */
	maxOutputTokens: number;
}

export interface ProviderReservation {
	/** Opaque id passed back to reconcile/release. */
	reservationId: string;
	/** Provider/model covered by this hold. */
	provider: LlmProvider;
	model: string;
	/** Worst-case dollars held against the ceilings until reconciled. */
	reservedUsd: number;
	/** Epoch ms after which an un-reconciled hold auto-refunds. */
	expiresAt: number;
}

export type ReserveResult =
	| ({
			ok: true;
			/**
			 * Provider holds reserved up front for operational failover. The first
			 * entry is the preferred provider; later entries are fallbacks that also
			 * fit their monthly cap and the remaining daily spend headroom.
			 */
			reservations: ProviderReservation[];
	  } & ProviderReservation)
	| {
			ok: false;
			/** Why the request was refused (a ceiling, or the ledger being unreachable). */
			reason: DenialReason;
			/** Human-readable detail, safe to log. */
			detail: string;
	  };

/** Actual settled cost for a completed request, from real token usage. */
export interface ReconcileInput {
	provider: LlmProvider;
	usd: number;
}

export interface LedgerStatus {
	day: string;
	month: string;
	daily: {
		spentUsd: number;
		reservedUsd: number;
		requests: number;
		spendCapUsd: number;
		requestCap: number;
	};
	monthly: Record<LlmProvider, { spentUsd: number; reservedUsd: number; capUsd: number }>;
	activeReservations: number;
}

/**
 * The port. The chat route depends on this interface, never on a concrete store.
 * Production binds the Durable-Object-backed adapter; dev/tests bind the
 * in-memory adapter.
 */
export interface SpendLedger {
	/** Reserve worst-case cost for the provider fallback plan, or refuse with a ceiling. */
	reserve(req: ReserveRequest, now: Date): Promise<ReserveResult>;
	/** Settle a completed request to its actual cost (releases the hold). */
	reconcile(reservationId: string, actual: ReconcileInput, now: Date): Promise<void>;
	/** Refund an un-spent hold (request produced no billable usage). */
	release(reservationId: string, now: Date): Promise<void>;
	/** Snapshot for observability and tests. */
	status(now: Date): Promise<LedgerStatus>;
}

/** Per-provider monthly dollar caps. */
export type MonthlyProviderCaps = Record<LlmProvider, number>;

export interface LedgerCeilings {
	/** Global all-visitors spend cap per UTC day (the Daily Circuit Breaker). */
	dailySpendUsd: number;
	/** Global all-visitors request cap per UTC day (dollar-independent backstop). */
	dailyRequests: number;
	/** Per-provider spend cap per UTC month (the Monthly Provider Cap). */
	monthlyProviderUsd: MonthlyProviderCaps;
}
