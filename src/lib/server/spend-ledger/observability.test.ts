import { afterEach, describe, expect, it, vi } from 'vitest';
import { LedgerCore } from './ledger-core';
import { logLedgerEvent, type LedgerEvent } from './observability';

const NOW = new Date('2026-06-11T12:00:00Z');
const OPENAI = { provider: 'openai' as const, model: 'gpt-4o-mini' };
const ONE_M_INPUT = { candidates: [OPENAI], maxInputTokens: 1_000_000, maxOutputTokens: 0 };

function makeCore(events: LedgerEvent[], dailySpendUsd = 100) {
	let n = 0;
	return new LedgerCore({
		ceilings: {
			dailySpendUsd,
			dailyRequests: 100_000,
			monthlyProviderUsd: { claude: 100, openai: 100 }
		},
		reservationTtlMs: 60_000,
		idFactory: () => `r${++n}`,
		emit: (event) => events.push(event)
	});
}

describe('LedgerCore observability', () => {
	it('emits reserve on admission with the bucket keys', () => {
		const events: LedgerEvent[] = [];
		makeCore(events).reserve(ONE_M_INPUT, NOW);

		expect(events).toEqual([
			{
				type: 'reserve',
				reservationId: 'r1',
				provider: 'openai',
				model: 'gpt-4o-mini',
				reservedUsd: 0.15,
				day: '2026-06-11',
				month: '2026-06'
			}
		]);
	});

	it('emits commit on reconcile and refund on release', () => {
		const events: LedgerEvent[] = [];
		const core = makeCore(events);
		const r = core.reserve(ONE_M_INPUT, NOW);
		if (!r.ok) throw new Error('expected reserve to succeed');
		core.reconcile(r.reservationId, { provider: 'openai', usd: 0.01 }, NOW);

		const second = core.reserve(ONE_M_INPUT, NOW);
		if (!second.ok) throw new Error('expected reserve to succeed');
		core.release(second.reservationId);

		expect(events.map((e) => e.type)).toEqual(['reserve', 'commit', 'reserve', 'refund']);
	});

	it('emits deny when a ceiling refuses the request', () => {
		const events: LedgerEvent[] = [];
		makeCore(events, 0.05).reserve(ONE_M_INPUT, NOW); // worst-case $0.15 > $0.05 cap

		expect(events).toEqual([{ type: 'deny', reason: 'daily-spend', detail: expect.any(String) }]);
	});

	it('emits expire when an orphaned hold ages out', () => {
		const events: LedgerEvent[] = [];
		const core = makeCore(events);
		const r = core.reserve(ONE_M_INPUT, NOW);
		if (!r.ok) throw new Error('expected reserve to succeed');

		// A later reserve triggers purgeExpired, which ages out the orphaned hold.
		core.reserve(ONE_M_INPUT, new Date(NOW.getTime() + 61_000));

		expect(events.some((e) => e.type === 'expire' && e.reservationId === r.reservationId)).toBe(
			true
		);
	});
});

describe('logLedgerEvent', () => {
	afterEach(() => vi.restoreAllMocks());

	it('writes one queryable JSON line per event', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		logLedgerEvent({ type: 'deny', reason: 'monthly-provider', detail: 'over cap' });

		expect(spy).toHaveBeenCalledTimes(1);
		const logged = JSON.parse(spy.mock.calls[0][0] as string);
		expect(logged).toMatchObject({
			event: 'spend-ledger',
			decision: 'deny',
			reason: 'monthly-provider'
		});
	});
});
