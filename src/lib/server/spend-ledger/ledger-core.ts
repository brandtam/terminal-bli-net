import type { LlmProvider } from '$lib/types';
import { worstCaseCostUsd } from './cost';
import type {
	CeilingId,
	LedgerCeilings,
	LedgerStatus,
	ReconcileInput,
	ReserveRequest,
	ReserveResult
} from './types';

/**
 * Pure, storage-agnostic Spend Ledger logic. Both adapters (in-memory and the
 * Durable Object) delegate here; the DO simply persists this state between
 * calls. Keeping the rules in one pure object is what makes the load-bearing
 * invariant — committed-plus-reserved can never exceed a ceiling — unit-testable
 * without a Workers runtime.
 *
 * Time is always passed in (`now`) and ids come from an injected factory, so the
 * core is deterministic and free of `Date.now()` / `Math.random()`.
 */

interface Reservation {
	provider: LlmProvider;
	model: string;
	usd: number;
	dayKey: string;
	monthKey: string;
	expiresAt: number;
}

interface DailyCommit {
	usd: number;
	requests: number;
}

/** Serializable snapshot so the DO adapter can persist/restore core state. */
export interface LedgerState {
	committedDaily: Record<string, DailyCommit>;
	committedMonthly: Record<string, number>;
	reservations: Record<string, Reservation>;
}

export interface LedgerCoreOptions {
	ceilings: LedgerCeilings;
	/** How long a hold survives without reconciliation before auto-refunding. */
	reservationTtlMs: number;
	/** Injectable for deterministic tests; defaults to crypto.randomUUID(). */
	idFactory?: () => string;
	/** Restore prior state (DO adapter). */
	state?: LedgerState;
}

function utcDayKey(now: Date): string {
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(now.getUTCDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

function utcMonthKey(now: Date): string {
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `${yyyy}-${mm}`;
}

function monthlyKey(monthKey: string, provider: LlmProvider): string {
	return `${monthKey}:${provider}`;
}

export class LedgerCore {
	private readonly ceilings: LedgerCeilings;
	private readonly ttlMs: number;
	private readonly newId: () => string;

	private committedDaily: Map<string, DailyCommit>;
	private committedMonthly: Map<string, number>;
	private reservations: Map<string, Reservation>;

	constructor(opts: LedgerCoreOptions) {
		this.ceilings = opts.ceilings;
		this.ttlMs = opts.reservationTtlMs;
		this.newId = opts.idFactory ?? (() => crypto.randomUUID());
		this.committedDaily = new Map(Object.entries(opts.state?.committedDaily ?? {}));
		this.committedMonthly = new Map(Object.entries(opts.state?.committedMonthly ?? {}));
		this.reservations = new Map(Object.entries(opts.state?.reservations ?? {}));
	}

	/** Drop expired holds so their dollars stop counting against ceilings. */
	private purgeExpired(now: Date): void {
		const cutoff = now.getTime();
		for (const [id, res] of this.reservations) {
			if (res.expiresAt <= cutoff) this.reservations.delete(id);
		}
	}

	private heldDailyUsd(dayKey: string): number {
		let sum = 0;
		for (const res of this.reservations.values()) {
			if (res.dayKey === dayKey) sum += res.usd;
		}
		return sum;
	}

	private heldMonthlyUsd(monthKey: string, provider: LlmProvider): number {
		let sum = 0;
		for (const res of this.reservations.values()) {
			if (res.monthKey === monthKey && res.provider === provider) sum += res.usd;
		}
		return sum;
	}

	private deny(reason: CeilingId, detail: string): ReserveResult {
		return { ok: false, reason, detail };
	}

	reserve(req: ReserveRequest, now: Date): ReserveResult {
		this.purgeExpired(now);

		const dayKey = utcDayKey(now);
		const monthKey = utcMonthKey(now);
		const daily = this.committedDaily.get(dayKey) ?? { usd: 0, requests: 0 };

		// Daily request count is dollar-independent: if it's full, nothing fits.
		if (daily.requests + 1 > this.ceilings.dailyRequests) {
			return this.deny(
				'daily-requests',
				`Daily request cap reached (${this.ceilings.dailyRequests}/day).`
			);
		}

		const heldDaily = this.heldDailyUsd(dayKey);
		let lastReason: CeilingId = 'monthly-provider';

		for (const candidate of req.candidates) {
			const worst = worstCaseCostUsd(candidate.model, req.maxInputTokens, req.maxOutputTokens);

			// Global daily spend — provider-independent, but a cheaper candidate
			// may still fit, so record and keep trying rather than denying outright.
			if (daily.usd + heldDaily + worst > this.ceilings.dailySpendUsd) {
				lastReason = 'daily-spend';
				continue;
			}

			const monthCap = this.ceilings.monthlyProviderUsd[candidate.provider];
			const committedMonth =
				this.committedMonthly.get(monthlyKey(monthKey, candidate.provider)) ?? 0;
			const heldMonth = this.heldMonthlyUsd(monthKey, candidate.provider);
			if (committedMonth + heldMonth + worst > monthCap) {
				lastReason = 'monthly-provider';
				continue;
			}

			// Admit. Request count commits immediately (the request is happening);
			// only the dollar amount is held and reconciled later.
			this.committedDaily.set(dayKey, { usd: daily.usd, requests: daily.requests + 1 });
			const reservationId = this.newId();
			const expiresAt = now.getTime() + this.ttlMs;
			this.reservations.set(reservationId, {
				provider: candidate.provider,
				model: candidate.model,
				usd: worst,
				dayKey,
				monthKey,
				expiresAt
			});

			return {
				ok: true,
				reservationId,
				provider: candidate.provider,
				model: candidate.model,
				reservedUsd: worst,
				expiresAt
			};
		}

		const detail =
			lastReason === 'daily-spend'
				? `Daily spend cap reached ($${this.ceilings.dailySpendUsd}/day).`
				: 'All candidate providers are over their monthly cap.';
		return this.deny(lastReason, detail);
	}

	reconcile(reservationId: string, actual: ReconcileInput, now: Date): void {
		const res = this.reservations.get(reservationId);
		this.reservations.delete(reservationId);

		// Commit actual spend even if the hold already expired — the request did
		// spend the money. Prefer the reservation's buckets so a request that
		// crossed a day/month boundary settles where it was admitted.
		const dayKey = res?.dayKey ?? utcDayKey(now);
		const monthKey = res?.monthKey ?? utcMonthKey(now);

		const daily = this.committedDaily.get(dayKey) ?? { usd: 0, requests: 0 };
		this.committedDaily.set(dayKey, { usd: daily.usd + actual.usd, requests: daily.requests });

		const mKey = monthlyKey(monthKey, actual.provider);
		this.committedMonthly.set(mKey, (this.committedMonthly.get(mKey) ?? 0) + actual.usd);
	}

	release(reservationId: string): void {
		this.reservations.delete(reservationId);
	}

	status(now: Date): LedgerStatus {
		this.purgeExpired(now);
		const dayKey = utcDayKey(now);
		const monthKey = utcMonthKey(now);
		const daily = this.committedDaily.get(dayKey) ?? { usd: 0, requests: 0 };

		const providers: LlmProvider[] = ['claude', 'openai'];
		const monthly = {} as LedgerStatus['monthly'];
		for (const provider of providers) {
			monthly[provider] = {
				spentUsd: this.committedMonthly.get(monthlyKey(monthKey, provider)) ?? 0,
				reservedUsd: this.heldMonthlyUsd(monthKey, provider),
				capUsd: this.ceilings.monthlyProviderUsd[provider]
			};
		}

		return {
			day: dayKey,
			month: monthKey,
			daily: {
				spentUsd: daily.usd,
				reservedUsd: this.heldDailyUsd(dayKey),
				requests: daily.requests,
				spendCapUsd: this.ceilings.dailySpendUsd,
				requestCap: this.ceilings.dailyRequests
			},
			monthly,
			activeReservations: this.reservations.size
		};
	}

	/** Serialize for the DO adapter to persist. */
	snapshot(): LedgerState {
		return {
			committedDaily: Object.fromEntries(this.committedDaily),
			committedMonthly: Object.fromEntries(this.committedMonthly),
			reservations: Object.fromEntries(this.reservations)
		};
	}
}
