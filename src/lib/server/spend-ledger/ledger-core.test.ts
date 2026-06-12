import { describe, it, expect } from 'vitest';
import { LedgerCore, type LedgerCoreOptions } from './ledger-core';
import type { CandidateProvider, LedgerCeilings } from './types';

// gpt-4o-mini priced at $0.15/1M input → 1,000,000 input + 0 output = exactly
// $0.15 per reserve, which keeps the ceiling arithmetic easy to reason about.
const OPENAI: CandidateProvider = { provider: 'openai', model: 'gpt-4o-mini' };
const CLAUDE: CandidateProvider = { provider: 'claude', model: 'claude-haiku-4-5-20251001' };
const ONE_M_INPUT = { candidates: [OPENAI], maxInputTokens: 1_000_000, maxOutputTokens: 0 };
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
			core.reserve(ONE_M_INPUT, NOW),
			core.reserve(ONE_M_INPUT, NOW),
			core.reserve(ONE_M_INPUT, NOW)
		];
		expect(results.every((r) => r.ok)).toBe(true);

		const fourth = core.reserve(ONE_M_INPUT, NOW);
		expect(fourth.ok).toBe(false);
		if (!fourth.ok) expect(fourth.ceiling).toBe('daily-spend');

		const status = core.status(NOW);
		expect(status.daily.reservedUsd).toBeCloseTo(3 * COST_PER_RESERVE, 6);
		expect(status.daily.spentUsd).toBe(0);
		// The guarantee: held money never exceeds the cap.
		expect(status.daily.reservedUsd).toBeLessThanOrEqual(status.daily.spendCapUsd);
	});

	it('frees exactly the worst-case-minus-actual headroom on reconcile', () => {
		const core = makeCore({ dailySpendUsd: 0.45 });
		const r1 = core.reserve(ONE_M_INPUT, NOW);
		const r2 = core.reserve(ONE_M_INPUT, NOW);
		core.reserve(ONE_M_INPUT, NOW); // full: 3 holds × $0.15 = $0.45
		expect(core.reserve(ONE_M_INPUT, NOW).ok).toBe(false);

		// Reconcile one request to a tiny actual: its $0.15 hold is replaced by a
		// $0.01 commit, freeing only $0.14 — less than a full $0.15 request — so a
		// new request still cannot fit. Worst-case stays held for the other two.
		if (r1.ok) core.reconcile(r1.reservationId, { provider: 'openai', usd: 0.01 }, NOW);
		expect(core.status(NOW).daily.spentUsd).toBeCloseTo(0.01, 6);
		expect(core.reserve(ONE_M_INPUT, NOW).ok).toBe(false);

		// Reconcile a second the same way: committed $0.02 + one $0.15 hold = $0.17,
		// which finally leaves room for a fresh reservation.
		if (r2.ok) core.reconcile(r2.reservationId, { provider: 'openai', usd: 0.01 }, NOW);
		expect(core.reserve(ONE_M_INPUT, NOW).ok).toBe(true);
	});

	it('auto-refunds an expired hold so it stops counting against the cap', () => {
		const core = makeCore({ dailySpendUsd: 0.15 }, 60_000); // room for exactly one hold
		expect(core.reserve(ONE_M_INPUT, NOW).ok).toBe(true);
		expect(core.reserve(ONE_M_INPUT, NOW).ok).toBe(false); // full

		const later = new Date(NOW.getTime() + 61_000); // past the 60s TTL
		const afterExpiry = core.reserve(ONE_M_INPUT, later);
		expect(afterExpiry.ok).toBe(true); // the orphaned hold expired and refunded
		expect(core.status(later).daily.reservedUsd).toBeCloseTo(COST_PER_RESERVE, 6);
	});
});

describe('LedgerCore — request-count backstop', () => {
	it('refuses once the daily request cap is hit, independent of dollars', () => {
		const core = makeCore({ dailyRequests: 2, dailySpendUsd: 1000 });
		expect(core.reserve(ONE_M_INPUT, NOW).ok).toBe(true);
		expect(core.reserve(ONE_M_INPUT, NOW).ok).toBe(true);
		const third = core.reserve(ONE_M_INPUT, NOW);
		expect(third.ok).toBe(false);
		if (!third.ok) expect(third.ceiling).toBe('daily-requests');
	});

	it('counts the request at reserve time and never refunds the count', () => {
		const core = makeCore();
		const r = core.reserve(ONE_M_INPUT, NOW);
		if (r.ok) core.release(r.reservationId); // dollars refunded...
		expect(core.status(NOW).daily.requests).toBe(1); // ...but the request still counted
	});
});

describe('LedgerCore — monthly provider cap with fallback', () => {
	it('skips a provider over its monthly cap and admits the next candidate', () => {
		// claude worst-case here is $1.00 (haiku input $1/1M); its monthly cap is
		// $0.50 so it cannot fit. openai ($0.15) can, and is the fallback.
		const core = makeCore({ monthlyProviderUsd: { claude: 0.5, openai: 25 } });
		const result = core.reserve(
			{ candidates: [CLAUDE, OPENAI], maxInputTokens: 1_000_000, maxOutputTokens: 0 },
			NOW
		);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.provider).toBe('openai');
	});

	it('refuses with monthly-provider when every candidate is over its monthly cap', () => {
		const core = makeCore({ monthlyProviderUsd: { claude: 0.5, openai: 0.05 } });
		const result = core.reserve(
			{ candidates: [CLAUDE, OPENAI], maxInputTokens: 1_000_000, maxOutputTokens: 0 },
			NOW
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.ceiling).toBe('monthly-provider');
	});

	it('settles actual spend against the reserved provider and month', () => {
		const core = makeCore();
		const r = core.reserve(ONE_M_INPUT, NOW);
		if (r.ok) core.reconcile(r.reservationId, { provider: 'openai', usd: 0.0123 }, NOW);
		const status = core.status(NOW);
		expect(status.monthly.openai.spentUsd).toBeCloseTo(0.0123, 6);
		expect(status.monthly.claude.spentUsd).toBe(0);
	});
});

describe('LedgerCore — state round-trips for the DO adapter', () => {
	it('restores committed and reserved state from a snapshot', () => {
		const core = makeCore({ dailySpendUsd: 0.45 });
		const first = core.reserve(ONE_M_INPUT, NOW);
		if (first.ok) core.reconcile(first.reservationId, { provider: 'openai', usd: 0.02 }, NOW);
		core.reserve(ONE_M_INPUT, NOW); // an outstanding hold

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
});
