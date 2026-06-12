import type {
	LedgerStatus,
	ReconcileInput,
	ReserveRequest,
	ReserveResult,
	SpendLedger
} from './types';

/**
 * Production `SpendLedger` adapter. Implements the port by calling the global
 * `SpendLedgerDO` over a Worker `services` binding (a `Fetcher`), mirroring how
 * the Pages app already reaches `ReminderAgent` via `REMINDER_SERVICE`.
 *
 * It holds no rules — it serializes the call, hands off to the DO (where the
 * exact accounting lives), and parses the reply. A non-2xx reply throws; the
 * factory wraps that into a fail-closed *denial* in production (step 4), so an
 * unreachable money authority can never mean unlimited spend.
 */

/** Wire endpoints, shared with the Worker router so the two can't drift. */
export const SPEND_LEDGER_ROUTES = {
	reserve: '/ledger/reserve',
	reconcile: '/ledger/reconcile',
	release: '/ledger/release',
	status: '/ledger/status'
} as const;

// The host is irrelevant over a service binding; it just has to be a valid URL.
const BASE = 'https://spend-ledger.internal';

export class DurableObjectSpendLedger implements SpendLedger {
	constructor(private readonly service: Fetcher) {}

	private async call<T>(path: string, payload: unknown): Promise<T> {
		const response = await this.service.fetch(`${BASE}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (!response.ok) {
			throw new Error(`Spend ledger ${path} failed: ${response.status}`);
		}
		return (await response.json()) as T;
	}

	reserve(req: ReserveRequest, now: Date): Promise<ReserveResult> {
		return this.call<ReserveResult>(SPEND_LEDGER_ROUTES.reserve, {
			req,
			nowMs: now.getTime()
		});
	}

	async reconcile(reservationId: string, actual: ReconcileInput, now: Date): Promise<void> {
		await this.call<{ ok: true }>(SPEND_LEDGER_ROUTES.reconcile, {
			reservationId,
			actual,
			nowMs: now.getTime()
		});
	}

	async release(reservationId: string, now: Date): Promise<void> {
		await this.call<{ ok: true }>(SPEND_LEDGER_ROUTES.release, {
			reservationId,
			nowMs: now.getTime()
		});
	}

	status(now: Date): Promise<LedgerStatus> {
		return this.call<LedgerStatus>(SPEND_LEDGER_ROUTES.status, { nowMs: now.getTime() });
	}
}
