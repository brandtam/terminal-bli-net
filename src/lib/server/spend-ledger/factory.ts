import { InMemorySpendLedger } from './in-memory-ledger';
import { DurableObjectSpendLedger } from './do-adapter';
import { FailClosedSpendLedger } from './fail-closed-ledger';
import { resolveCeilings, DEFAULT_RESERVATION_TTL_MS, type CeilingEnv } from './config';
import type {
	LedgerStatus,
	ReconcileInput,
	ReserveRequest,
	ReserveResult,
	SpendLedger
} from './types';

/**
 * Chooses which `SpendLedger` adapter the chat route gets. The route depends
 * only on the port, so it never knows which one it holds.
 *
 * - **Production** — the `SPEND_LEDGER` service binding is required. If it is
 *   present, use the exact Durable-Object ledger wrapped to **fail closed**; if
 *   it is missing or unreachable, requests are denied, never permitted (ADR 0005).
 * - **Development / tests** — no binding may fall back to the in-memory adapter.
 *   It has no deployed dependency, which makes dev trivially **fail open**.
 */

export interface SpendLedgerEnv extends CeilingEnv {
	/** RPC service binding to the Worker that hosts the global SpendLedgerDO. */
	SPEND_LEDGER?: Fetcher;
	/** Test/deploy override: true means a missing SPEND_LEDGER binding must deny. */
	SPEND_LEDGER_REQUIRED?: string;
}

// One in-memory ledger per isolate so concurrent dev requests share state.
let devLedger: InMemorySpendLedger | undefined;

class MissingSpendLedgerBinding implements SpendLedger {
	private fail(): never {
		throw new Error('SPEND_LEDGER service binding is required but missing');
	}

	reserve(_req: ReserveRequest, _now: Date): Promise<ReserveResult> {
		this.fail();
	}

	reconcile(_reservationId: string, _actual: ReconcileInput, _now: Date): Promise<void> {
		this.fail();
	}

	release(_reservationId: string, _now: Date): Promise<void> {
		this.fail();
	}

	status(_now: Date): Promise<LedgerStatus> {
		this.fail();
	}
}

function allowsInMemoryFallback(env: SpendLedgerEnv): boolean {
	if (env.SPEND_LEDGER_REQUIRED === 'true') return false;
	return import.meta.env.DEV || import.meta.env.MODE === 'test';
}

export function getSpendLedger(env: SpendLedgerEnv): SpendLedger {
	if (env.SPEND_LEDGER) {
		return new FailClosedSpendLedger(new DurableObjectSpendLedger(env.SPEND_LEDGER));
	}

	if (!allowsInMemoryFallback(env)) {
		return new FailClosedSpendLedger(new MissingSpendLedgerBinding());
	}

	if (!devLedger) {
		devLedger = new InMemorySpendLedger({
			ceilings: resolveCeilings(env),
			reservationTtlMs: DEFAULT_RESERVATION_TTL_MS
		});
	}
	return devLedger;
}
