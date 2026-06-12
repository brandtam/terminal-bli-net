import { InMemorySpendLedger } from './in-memory-ledger';
import { resolveCeilings, DEFAULT_RESERVATION_TTL_MS, type CeilingEnv } from './config';
import type { SpendLedger } from './types';

/**
 * Chooses which `SpendLedger` adapter the chat route gets.
 *
 * Production binds the single global Durable Object (exact, fails closed); dev
 * and tests get the in-memory adapter (fails open, no deployed dependency). The
 * route depends only on the port, so it never knows which one it holds.
 *
 * The DO branch is added in step 4 (fail-closed wiring); step 2 wires the
 * in-memory path end to end first.
 */

export interface SpendLedgerEnv extends CeilingEnv {
	/** RPC binding to the `terminal-spend-ledger` Worker; present only in prod. */
	SPEND_LEDGER?: Fetcher;
}

// One in-memory ledger per isolate so concurrent dev requests share state.
let devLedger: InMemorySpendLedger | undefined;

export function getSpendLedger(env: SpendLedgerEnv): SpendLedger {
	if (!devLedger) {
		devLedger = new InMemorySpendLedger({
			ceilings: resolveCeilings(env),
			reservationTtlMs: DEFAULT_RESERVATION_TTL_MS
		});
	}
	return devLedger;
}
