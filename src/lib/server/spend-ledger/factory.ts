import { InMemorySpendLedger } from './in-memory-ledger';
import { DurableObjectSpendLedger } from './do-adapter';
import { FailClosedSpendLedger } from './fail-closed-ledger';
import { resolveCeilings, DEFAULT_RESERVATION_TTL_MS, type CeilingEnv } from './config';
import type { SpendLedger } from './types';

/**
 * Chooses which `SpendLedger` adapter the chat route gets. The route depends
 * only on the port, so it never knows which one it holds.
 *
 * - **Production** — the `SPEND_LEDGER` service binding is present, so use the
 *   exact Durable-Object ledger, wrapped to **fail closed**: if the money
 *   authority is unreachable, requests are denied, never permitted (ADR 0005).
 * - **Development / tests** — no binding, so use the in-memory adapter. It has
 *   no deployed dependency, which makes dev trivially **fail open**.
 */

export interface SpendLedgerEnv extends CeilingEnv {
	/** RPC service binding to the Worker that hosts the global SpendLedgerDO. */
	SPEND_LEDGER?: Fetcher;
}

// One in-memory ledger per isolate so concurrent dev requests share state.
let devLedger: InMemorySpendLedger | undefined;

export function getSpendLedger(env: SpendLedgerEnv): SpendLedger {
	if (env.SPEND_LEDGER) {
		return new FailClosedSpendLedger(new DurableObjectSpendLedger(env.SPEND_LEDGER));
	}

	if (!devLedger) {
		devLedger = new InMemorySpendLedger({
			ceilings: resolveCeilings(env),
			reservationTtlMs: DEFAULT_RESERVATION_TTL_MS
		});
	}
	return devLedger;
}
