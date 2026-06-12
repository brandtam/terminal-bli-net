import { describe, it, expect } from 'vitest';
import { LedgerCore, type LedgerCoreOptions } from './ledger-core';
import type { CandidateProvider, LedgerCeilings } from './types';

// gpt-4o-mini reserves input at its worst-case cache-creation fallback
// ($0.1875/1M), so 800,000 input + 0 output = exactly $0.15 per reserve.
const OPENAI: CandidateProvider = { provider: 'openai', model: 'gpt-4o-mini' };
const CLAUDE: CandidateProvider = { provider: 'claude', model: 'claude-haiku-4-5-20251001' };
const OPENAI_800K_INPUT = {
	candidates: [OPENAI],
	maxInputTokens: 800_000,
	maxOutputTokens: 0
};
const COST_PER_RESERVE = 0.15;

const NOW = new Date('2026-06-11T12:00:00Z');

function makeCore(ceilings: Partial<LedgerCeilings> = {}, ttlMs = 60_000): LedgerCore {
	let n = 0;
	const opts: LedgerCoreOptions = {
		ceilings: {
			dailySpendUsd: 100,
			dailyRequests: 100_000,
			monthlyProviderUsd: { claude: 100, openai: 100 },
			...ceilings
		},
		reservationTtlMs: ttlMs,
		idFactory: () => `r${++n}`
	};
	return new LedgerCore(opts);
}

describe('LedgerCore — exactness invariant', () => {
	it('never lets committed-plus-reserved exceed the daily spend cap under concurrent reservations', () => {
		// Cap = $0.45 → exactly 3 reservations of $0.15 fit; the 4th must be refused
		// even though NOTHING has reconciled yet (the holds alone fill the ceiling).
		const core = makeCore({ dailySpendUsd: 0.45 });

		const results = [
			core.reserve(OPENAI_800K_INPUT, NOW),
			core.reserve(OPENAI_800K_INPUT, NOW),
			core.reserve(OPENAI_800K_INPUT, NOW)
		];
		expect(results.every((r) => r.ok)).toBe(true);

		const fourth = core.reserve(OPENAI_800K_INPUT, NOW);
		expect(fourth.ok).toBe(false);
		if (!fourth.ok) expect(fourth.reason).toBe('daily-spend');

		const status = core.status(NOW);
		expect(status.daily.reservedUsd).toBeCloseTo(3 * COST_PER_RESERVE, 6);
		expect(status.daily.spentUsd).toBe(0);
		// The guarantee: held money never exceeds the cap.
		expect(status.daily.reservedUsd).toBeLessThanOrEqual(status.daily.spendCapUsd);
	});

	it('frees exactly the worst-case-minus-actual headroom on reconcile', () => {
		const core = makeCore({ dailySpendUsd: 0.45 });
		const r1 = core.reserve(OPENAI_800K_INPUT, NOW);
		const r2 = core.reserve(OPENAI_800K_INPUT, NOW);
		core.reserve(OPENAI_800K_INPUT, NOW); // full: 3 holds × $0.15 = $0.45
		expect(core.reserve(OPENAI_800K_INPUT, NOW).ok).toBe(false);

		// Reconcile one request to a tiny actual: its $0.15 hold is replaced by a
		// $0.01 commit, freeing only $0.14 — less than a full $0.15 request — so a
		// new request still cannot fit. Worst-case stays held for the other two.
		if (r1.ok) core.reconcile(r1.reservationId, { provider: 'openai', usd: 0.01 }, NOW);
		expect(core.status(NOW).daily.spentUsd).toBeCloseTo(0.01, 6);
		expect(core.reserve(OPENAI_800K_INPUT, NOW).ok).toBe(false);

		// Reconcile a second the same way: committed $0.02 + one $0.15 hold = $0.17,
		// which finally leaves room for a fresh reservation.
		if (r2.ok) core.reconcile(r2.reservationId, { provider: 'openai', usd: 0.01 }, NOW);
		expect(core.reserve(OPENAI_800K_INPUT, NOW).ok).toBe(true);
	});

	it('auto-refunds an expired hold so it stops counting against the cap', () => {
		const core = makeCore({ dailySpendUsd: 0.15 }, 60_000); // room for exactly one hold
		expect(core.reserve(OPENAI_800K_INPUT, NOW).ok).toBe(true);
		expect(core.reserve(OPENAI_800K_INPUT, NOW).ok).toBe(false); // full

		const later = new Date(NOW.getTime() + 61_000); // past the 60s TTL
		const afterExpiry = core.reserve(OPENAI_800K_INPUT, later);
		expect(afterExpiry.ok).toBe(true); // the orphaned hold expired and refunded
		expect(core.status(later).daily.reservedUsd).toBeCloseTo(COST_PER_RESERVE, 6);
	});
});

describe('LedgerCore — request-count backstop', () => {
	it('refuses once the daily request cap is hit, independent of dollars', () => {
		const core = makeCore({ dailyRequests: 2, dailySpendUsd: 1000 });
		expect(core.reserve(OPENAI_800K_INPUT, NOW).ok).toBe(true);
		expect(core.reserve(OPENAI_800K_INPUT, NOW).ok).toBe(true);
		const third = core.reserve(OPENAI_800K_INPUT, NOW);
		expect(third.ok).toBe(false);
		if (!third.ok) expect(third.reason).toBe('daily-requests');
	});

	it('counts the request at reserve time and never refunds the count', () => {
		const core = makeCore();
		const r = core.reserve(OPENAI_800K_INPUT, NOW);
		if (r.ok) core.release(r.reservationId); // dollars refunded...
		expect(core.status(NOW).daily.requests).toBe(1); // ...but the request still counted
	});

	it('counts over-budget denials against the daily request backstop', () => {
		const core = makeCore({ dailySpendUsd: 0.01 });

		const denied = core.reserve(OPENAI_800K_INPUT, NOW);
		expect(denied.ok).toBe(false);
		expect(core.status(NOW).daily.requests).toBe(1);
	});
});

describe('LedgerCore — monthly provider cap with fallback', () => {
	it('skips a provider over its monthly cap and admits the next candidate', () => {
		// Claude worst-case here is $1.25 (haiku cache-write input $1.25/1M);
		// its monthly cap is $0.50 so it cannot fit. OpenAI can, and is the fallback.
		const core = makeCore({ monthlyProviderUsd: { claude: 0.5, openai: 25 } });
		const result = core.reserve(
			{ candidates: [CLAUDE, OPENAI], maxInputTokens: 1_000_000, maxOutputTokens: 0 },
			NOW
		);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.provider).toBe('openai');
	});

	it('reserves each fallback candidate that fits both daily and provider caps', () => {
		const core = makeCore({ dailySpendUsd: 2, monthlyProviderUsd: { claude: 2, openai: 2 } });
		const result = core.reserve(
			{ candidates: [CLAUDE, OPENAI], maxInputTokens: 800_000, maxOutputTokens: 0 },
			NOW
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.provider).toBe('claude');
		expect(result.reservations.map((hold) => hold.provider)).toEqual(['claude', 'openai']);
		expect(core.status(NOW).daily.reservedUsd).toBeCloseTo(1.15, 6);
		expect(core.status(NOW).monthly.claude.reservedUsd).toBeCloseTo(1, 6);
		expect(core.status(NOW).monthly.openai.reservedUsd).toBeCloseTo(0.15, 6);
	});

	it('refuses with monthly-provider when every candidate is over its monthly cap', () => {
		const core = makeCore({ monthlyProviderUsd: { claude: 0.5, openai: 0.05 } });
		const result = core.reserve(
			{ candidates: [CLAUDE, OPENAI], maxInputTokens: 1_000_000, maxOutputTokens: 0 },
			NOW
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('monthly-provider');
	});

	it('settles actual spend against the reserved provider and month', () => {
		const core = makeCore();
		const r = core.reserve(OPENAI_800K_INPUT, NOW);
		if (r.ok) core.reconcile(r.reservationId, { provider: 'openai', usd: 0.0123 }, NOW);
		const status = core.status(NOW);
		expect(status.monthly.openai.spentUsd).toBeCloseTo(0.0123, 6);
		expect(status.monthly.claude.spentUsd).toBe(0);
	});
});

describe('LedgerCore — state round-trips for the DO adapter', () => {
	it('restores committed and reserved state from a snapshot', () => {
		const core = makeCore({ dailySpendUsd: 0.45 });
		const first = core.reserve(OPENAI_800K_INPUT, NOW);
		if (first.ok) core.reconcile(first.reservationId, { provider: 'openai', usd: 0.02 }, NOW);
		core.reserve(OPENAI_800K_INPUT, NOW); // an outstanding hold

		const restored = new LedgerCore({
			ceilings: {
				dailySpendUsd: 0.45,
				dailyRequests: 100_000,
				monthlyProviderUsd: { claude: 100, openai: 100 }
			},
			reservationTtlMs: 60_000,
			state: core.snapshot()
		});

		const a = core.status(NOW);
		const b = restored.status(NOW);
		expect(b.daily.spentUsd).toBeCloseTo(a.daily.spentUsd, 6);
		expect(b.daily.reservedUsd).toBeCloseTo(a.daily.reservedUsd, 6);
		expect(b.daily.requests).toBe(a.daily.requests);
		expect(b.activeReservations).toBe(a.activeReservations);
	});

	it('status excludes expired holds without mutating the snapshot', () => {
		const core = makeCore({ dailySpendUsd: 0.15 }, 60_000);
		const result = core.reserve(OPENAI_800K_INPUT, NOW);
		if (!result.ok) throw new Error('expected reserve to succeed');

		const later = new Date(NOW.getTime() + 61_000);
		const status = core.status(later);
		expect(status.daily.reservedUsd).toBe(0);
		expect(status.activeReservations).toBe(0);
		expect(Object.keys(core.snapshot().reservations)).toHaveLength(1);
	});

	it('prunes closed historical buckets on the next mutation', () => {
		const core = makeCore();
		const first = core.reserve(OPENAI_800K_INPUT, NOW);
		if (!first.ok) throw new Error('expected reserve to succeed');
		core.reconcile(first.reservationId, { provider: 'openai', usd: 0.01 }, NOW);

		const nextMonth = new Date('2026-07-01T00:00:00Z');
		const second = core.reserve(OPENAI_800K_INPUT, nextMonth);
		if (!second.ok) throw new Error('expected reserve to succeed');
		core.reconcile(second.reservationId, { provider: 'openai', usd: 0.02 }, nextMonth);

		const snapshot = core.snapshot();
		expect(Object.keys(snapshot.committedDaily)).toEqual(['2026-07-01']);
		expect(Object.keys(snapshot.committedMonthly)).toEqual(['2026-07:openai']);
	});
});
