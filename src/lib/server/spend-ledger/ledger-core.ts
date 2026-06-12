import { LLM_PROVIDERS, type LlmProvider } from '$lib/types';
import { worstCaseCostUsd } from './cost';
import type { LedgerEventSink } from './observability';
import type {
	CeilingId,
	LedgerCeilings,
	LedgerStatus,
	ProviderReservation,
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
	/** Observability sink, one event per decision; defaults to a no-op. */
	emit?: LedgerEventSink;
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

function monthFromMonthlyKey(key: string): string {
	return key.slice(0, key.indexOf(':'));
}

export class LedgerCore {
	private readonly ceilings: LedgerCeilings;
	private readonly ttlMs: number;
	private readonly newId: () => string;
	private readonly emit: LedgerEventSink;

	private committedDaily: Map<string, DailyCommit>;
	private committedMonthly: Map<string, number>;
	private reservations: Map<string, Reservation>;
	private heldDaily: Map<string, number>;
	private heldMonthly: Map<string, number>;

	constructor(opts: LedgerCoreOptions) {
		this.ceilings = opts.ceilings;
		this.ttlMs = opts.reservationTtlMs;
		this.newId = opts.idFactory ?? (() => crypto.randomUUID());
		this.emit = opts.emit ?? (() => {});
		this.committedDaily = new Map(Object.entries(opts.state?.committedDaily ?? {}));
		this.committedMonthly = new Map(Object.entries(opts.state?.committedMonthly ?? {}));
		this.reservations = new Map(Object.entries(opts.state?.reservations ?? {}));
		this.heldDaily = new Map();
		this.heldMonthly = new Map();
		for (const res of this.reservations.values()) this.addHeld(res);
	}

	private addTo(map: Map<string, number>, key: string, usd: number): void {
		map.set(key, (map.get(key) ?? 0) + usd);
	}

	private subtractFrom(map: Map<string, number>, key: string, usd: number): void {
		const next = (map.get(key) ?? 0) - usd;
		if (next <= 1e-12) map.delete(key);
		else map.set(key, next);
	}

	private addHeld(res: Reservation): void {
		this.addTo(this.heldDaily, res.dayKey, res.usd);
		this.addTo(this.heldMonthly, monthlyKey(res.monthKey, res.provider), res.usd);
	}

	private removeHeld(res: Reservation): void {
		this.subtractFrom(this.heldDaily, res.dayKey, res.usd);
		this.subtractFrom(this.heldMonthly, monthlyKey(res.monthKey, res.provider), res.usd);
	}

	private putReservation(id: string, res: Reservation): void {
		this.reservations.set(id, res);
		this.addHeld(res);
	}

	private takeReservation(id: string): Reservation | undefined {
		const res = this.reservations.get(id);
		if (!res) return undefined;
		this.reservations.delete(id);
		this.removeHeld(res);
		return res;
	}

	/** Drop expired holds so their dollars stop counting against ceilings. */
	private purgeExpired(now: Date): void {
		const cutoff = now.getTime();
		for (const [id, res] of this.reservations) {
			if (res.expiresAt <= cutoff) {
				this.takeReservation(id);
				this.emit({ type: 'expire', reservationId: id, provider: res.provider, usd: res.usd });
			}
		}
	}

	private pruneHistory(now: Date): void {
		const keepDays = new Set([utcDayKey(now)]);
		const keepMonths = new Set([utcMonthKey(now)]);
		for (const res of this.reservations.values()) {
			keepDays.add(res.dayKey);
			keepMonths.add(res.monthKey);
		}

		for (const dayKey of this.committedDaily.keys()) {
			if (!keepDays.has(dayKey)) this.committedDaily.delete(dayKey);
		}
		for (const key of this.committedMonthly.keys()) {
			if (!keepMonths.has(monthFromMonthlyKey(key))) this.committedMonthly.delete(key);
		}
	}

	private heldDailyUsd(dayKey: string): number {
		return this.heldDaily.get(dayKey) ?? 0;
	}

	private heldMonthlyUsd(monthKey: string, provider: LlmProvider): number {
		return this.heldMonthly.get(monthlyKey(monthKey, provider)) ?? 0;
	}

	private heldDailyUsdAt(dayKey: string, now: Date): number {
		const cutoff = now.getTime();
		let sum = 0;
		for (const res of this.reservations.values()) {
			if (res.dayKey === dayKey && res.expiresAt > cutoff) sum += res.usd;
		}
		return sum;
	}

	private heldMonthlyUsdAt(monthKey: string, provider: LlmProvider, now: Date): number {
		const cutoff = now.getTime();
		let sum = 0;
		for (const res of this.reservations.values()) {
			if (res.monthKey === monthKey && res.provider === provider && res.expiresAt > cutoff) {
				sum += res.usd;
			}
		}
		return sum;
	}

	private activeReservationCountAt(now: Date): number {
		const cutoff = now.getTime();
		let count = 0;
		for (const res of this.reservations.values()) {
			if (res.expiresAt > cutoff) count += 1;
		}
		return count;
	}

	private deny(reason: CeilingId, detail: string): ReserveResult {
		this.emit({ type: 'deny', reason, detail });
		return { ok: false, reason, detail };
	}

	reserve(req: ReserveRequest, now: Date): ReserveResult {
		this.purgeExpired(now);
		this.pruneHistory(now);

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
		let dailyRemaining = this.ceilings.dailySpendUsd - daily.usd - heldDaily;
		let sawDailyBlock = false;
		let sawDailyFit = false;
		const plannedMonthly = new Map<string, number>();
		const planned: ProviderReservation[] = [];

		for (const candidate of req.candidates) {
			const worst = worstCaseCostUsd(candidate.model, req.maxInputTokens, req.maxOutputTokens);

			// Global daily spend — provider-independent. A later candidate can be
			// cheaper, so keep scanning rather than failing on the first miss.
			if (worst > dailyRemaining) {
				sawDailyBlock = true;
				continue;
			}
			sawDailyFit = true;

			const monthCap = this.ceilings.monthlyProviderUsd[candidate.provider];
			const mKey = monthlyKey(monthKey, candidate.provider);
			const committedMonth = this.committedMonthly.get(mKey) ?? 0;
			const heldMonth = this.heldMonthlyUsd(monthKey, candidate.provider);
			const alreadyPlanned = plannedMonthly.get(mKey) ?? 0;
			if (committedMonth + heldMonth + alreadyPlanned + worst > monthCap) {
				continue;
			}

			const reservationId = this.newId();
			const expiresAt = now.getTime() + this.ttlMs;
			planned.push({
				reservationId,
				provider: candidate.provider,
				model: candidate.model,
				reservedUsd: worst,
				expiresAt
			});
			plannedMonthly.set(mKey, alreadyPlanned + worst);
			dailyRemaining -= worst;
		}

		// Count every ledger-adjudicated chat request, including over-budget
		// refusals, so the global request backstop protects the ledger path too.
		this.committedDaily.set(dayKey, { usd: daily.usd, requests: daily.requests + 1 });

		if (planned.length === 0) {
			const reason: CeilingId = !sawDailyFit && sawDailyBlock ? 'daily-spend' : 'monthly-provider';
			const detail =
				reason === 'daily-spend'
					? `Daily spend cap reached ($${this.ceilings.dailySpendUsd}/day).`
					: 'All candidate providers are over their monthly cap.';
			return this.deny(reason, detail);
		}

		for (const hold of planned) {
			this.putReservation(hold.reservationId, {
				provider: hold.provider,
				model: hold.model,
				usd: hold.reservedUsd,
				dayKey,
				monthKey,
				expiresAt: hold.expiresAt
			});

			this.emit({
				type: 'reserve',
				reservationId: hold.reservationId,
				provider: hold.provider,
				model: hold.model,
				reservedUsd: hold.reservedUsd,
				day: dayKey,
				month: monthKey
			});
		}

		return {
			ok: true,
			...planned[0],
			reservations: planned
		};
	}

	reconcile(reservationId: string, actual: ReconcileInput, now: Date): void {
		const res = this.takeReservation(reservationId);
		const usd = Math.max(0, actual.usd);

		// Commit actual spend even if the hold already expired — the request did
		// spend the money. Prefer the reservation's buckets so a request that
		// crossed a day/month boundary settles where it was admitted.
		const dayKey = res?.dayKey ?? utcDayKey(now);
		const monthKey = res?.monthKey ?? utcMonthKey(now);

		const daily = this.committedDaily.get(dayKey) ?? { usd: 0, requests: 0 };
		this.committedDaily.set(dayKey, { usd: daily.usd + usd, requests: daily.requests });

		const mKey = monthlyKey(monthKey, actual.provider);
		this.committedMonthly.set(mKey, (this.committedMonthly.get(mKey) ?? 0) + usd);
		this.pruneHistory(now);

		this.emit({ type: 'commit', reservationId, provider: actual.provider, usd });
	}

	release(reservationId: string, now?: Date): void {
		this.takeReservation(reservationId);
		if (now) this.pruneHistory(now);
		this.emit({ type: 'refund', reservationId });
	}

	status(now: Date): LedgerStatus {
		const dayKey = utcDayKey(now);
		const monthKey = utcMonthKey(now);
		const daily = this.committedDaily.get(dayKey) ?? { usd: 0, requests: 0 };

		const monthly = {} as LedgerStatus['monthly'];
		for (const provider of LLM_PROVIDERS) {
			monthly[provider] = {
				spentUsd: this.committedMonthly.get(monthlyKey(monthKey, provider)) ?? 0,
				reservedUsd: this.heldMonthlyUsdAt(monthKey, provider, now),
				capUsd: this.ceilings.monthlyProviderUsd[provider]
			};
		}

		return {
			day: dayKey,
			month: monthKey,
			daily: {
				spentUsd: daily.usd,
				reservedUsd: this.heldDailyUsdAt(dayKey, now),
				requests: daily.requests,
				spendCapUsd: this.ceilings.dailySpendUsd,
				requestCap: this.ceilings.dailyRequests
			},
			monthly,
			activeReservations: this.activeReservationCountAt(now)
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
