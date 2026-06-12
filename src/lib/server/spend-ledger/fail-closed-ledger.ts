import type {
	LedgerStatus,
	ReconcileInput,
	ReserveRequest,
	ReserveResult,
	SpendLedger
} from './types';

/**
 * Fail-closed decorator around a `SpendLedger`.
 *
 * If the underlying ledger — in production, the global Durable Object reached
 * over a service binding — is unreachable, a *reserve* is denied: no money
 * authority means no budget, so an outage can never turn into unlimited spend
 * (docs/adr/0005). That is the whole point of "fail closed".
 *
 * Settling calls are different. `reconcile` and `release` only ever *record* or
 * *free* money that a reserve already authorized, so a failure there can't cause
 * overspend — the worst case is a worst-case hold that lingers until its TTL
 * auto-refunds it. Those failures are logged and swallowed so a flaky settle
 * never tears down a response the user is already reading.
 */
export class FailClosedSpendLedger implements SpendLedger {
	constructor(private readonly inner: SpendLedger) {}

	async reserve(req: ReserveRequest, now: Date): Promise<ReserveResult> {
		try {
			return await this.inner.reserve(req, now);
		} catch (err) {
			console.error('[spend-ledger] reserve failed; failing closed (denying)', err);
			return {
				ok: false,
				reason: 'ledger-unavailable',
				detail: 'Spend ledger is unreachable; refusing spend.'
			};
		}
	}

	async reconcile(reservationId: string, actual: ReconcileInput, now: Date): Promise<void> {
		try {
			await this.inner.reconcile(reservationId, actual, now);
		} catch (err) {
			console.error('[spend-ledger] reconcile failed; hold will self-expire', err);
		}
	}

	async release(reservationId: string, now: Date): Promise<void> {
		try {
			await this.inner.release(reservationId, now);
		} catch (err) {
			console.error('[spend-ledger] release failed; hold will self-expire', err);
		}
	}

	status(now: Date): Promise<LedgerStatus> {
		return this.inner.status(now);
	}
}
