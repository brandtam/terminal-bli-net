import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { LedgerState } from '../../../src/lib/server/spend-ledger/ledger-core';

// Exercises the SpendLedgerDO inside the real Workers runtime, so its storage
// persistence and RPC surface behave as they will in production. Each test gets
// its own named instance; isolatedStorage in vitest.config keeps them independent.
type Stub = ReturnType<typeof env.SPEND_LEDGER_DO.getByName>;

function ledger(instance: string): Stub {
	return env.SPEND_LEDGER_DO.getByName(instance);
}

const NOW = new Date('2026-01-04T10:00:00Z').getTime();
const CANDIDATE = { provider: 'openai' as const, model: 'gpt-4o-mini' };
const SMALL_REQUEST = { candidates: [CANDIDATE], maxInputTokens: 100, maxOutputTokens: 300 };

describe('SpendLedgerDO', () => {
	it('admits a request and persists the count + reservation to storage', async () => {
		const stub = ledger('admit');
		const result = await stub.reserve(SMALL_REQUEST, NOW);
		expect(result.ok).toBe(true);

		const status = await stub.status(NOW);
		expect(status.daily.requests).toBe(1);
		expect(status.daily.reservedUsd).toBeGreaterThan(0);
		expect(status.activeReservations).toBe(1);

		// Prove it's persisted, not just held in the live instance's memory.
		const stored = await runInDurableObject(stub, (_instance, state) =>
			state.storage.get<LedgerState>('ledger')
		);
		expect(Object.keys(stored!.reservations)).toHaveLength(1);
		expect(stored!.committedDaily[status.day].requests).toBe(1);
	});

	it('reconciles a reservation to actual spend and clears the hold', async () => {
		const stub = ledger('reconcile');
		const result = await stub.reserve(SMALL_REQUEST, NOW);
		if (!result.ok) throw new Error('expected reserve to succeed');

		await stub.reconcile(result.reservationId, { provider: 'openai', usd: 0.01 }, NOW);

		const status = await stub.status(NOW);
		expect(status.activeReservations).toBe(0);
		expect(status.daily.reservedUsd).toBe(0);
		expect(status.daily.spentUsd).toBeCloseTo(0.01);
		expect(status.monthly.openai.spentUsd).toBeCloseTo(0.01);
	});

	it('releases a reservation without committing spend', async () => {
		const stub = ledger('release');
		const result = await stub.reserve(SMALL_REQUEST, NOW);
		if (!result.ok) throw new Error('expected reserve to succeed');

		await stub.release(result.reservationId, NOW);

		const status = await stub.status(NOW);
		expect(status.activeReservations).toBe(0);
		expect(status.daily.reservedUsd).toBe(0);
		expect(status.daily.spentUsd).toBe(0);
		// The request itself still counted — only the dollar hold was refunded.
		expect(status.daily.requests).toBe(1);
	});

	it('refuses when a single request would blow the daily spend cap', async () => {
		const stub = ledger('deny');
		const result = await stub.reserve(
			{ candidates: [CANDIDATE], maxInputTokens: 1_000_000_000, maxOutputTokens: 300 },
			NOW
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.ceiling).toBe('daily-spend');
	});
});
