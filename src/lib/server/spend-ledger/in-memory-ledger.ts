import { LedgerCore, type LedgerCoreOptions } from './ledger-core';
import type { ReconcileInput, ReserveRequest, SpendLedger } from './types';

/**
 * In-memory Spend Ledger adapter for development and tests.
 *
 * It holds a single `LedgerCore` in process memory, so it provides the same
 * exact accounting as production within one runtime — and it is the natural
 * "fail open" path in dev: there is no external authority to be unreachable.
 * Production uses the Durable-Object adapter instead.
 */
export class InMemorySpendLedger implements SpendLedger {
	private readonly core: LedgerCore;

	constructor(opts: LedgerCoreOptions) {
		this.core = new LedgerCore(opts);
	}

	async reserve(req: ReserveRequest, now: Date) {
		return this.core.reserve(req, now);
	}

	async reconcile(reservationId: string, actual: ReconcileInput, now: Date) {
		this.core.reconcile(reservationId, actual, now);
	}

	async release(reservationId: string, now: Date) {
		void now;
		this.core.release(reservationId);
	}

	async status(now: Date) {
		return this.core.status(now);
	}
}
