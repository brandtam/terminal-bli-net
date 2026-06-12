import { describe, expect, it, vi } from 'vitest';
import { FailClosedSpendLedger } from './fail-closed-ledger';
import type { ReserveResult, SpendLedger } from './types';

const OK_RESERVE: ReserveResult = {
	ok: true,
	reservationId: 'r1',
	provider: 'openai',
	model: 'gpt-4o-mini',
	reservedUsd: 0.05,
	expiresAt: 1_000
};

const REQUEST = {
	candidates: [{ provider: 'openai' as const, model: 'gpt-4o-mini' }],
	maxInputTokens: 100,
	maxOutputTokens: 300
};

function innerLedger(overrides: Partial<SpendLedger>): SpendLedger {
	return {
		reserve: vi.fn(),
		reconcile: vi.fn(),
		release: vi.fn(),
		status: vi.fn(),
		...overrides
	} as SpendLedger;
}

describe('FailClosedSpendLedger', () => {
	it('passes a successful reservation straight through', async () => {
		const ledger = new FailClosedSpendLedger(
			innerLedger({ reserve: vi.fn().mockResolvedValue(OK_RESERVE) })
		);

		await expect(ledger.reserve(REQUEST, new Date())).resolves.toEqual(OK_RESERVE);
	});

	it('denies with ledger-unavailable when the inner reserve throws', async () => {
		const ledger = new FailClosedSpendLedger(
			innerLedger({ reserve: vi.fn().mockRejectedValue(new Error('unreachable')) })
		);

		const result = await ledger.reserve(REQUEST, new Date());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('ledger-unavailable');
	});

	it('swallows reconcile failures (the hold self-expires)', async () => {
		const ledger = new FailClosedSpendLedger(
			innerLedger({ reconcile: vi.fn().mockRejectedValue(new Error('write failed')) })
		);

		await expect(
			ledger.reconcile('r1', { provider: 'openai', usd: 0.01 }, new Date())
		).resolves.toBeUndefined();
	});

	it('swallows release failures (the hold self-expires)', async () => {
		const ledger = new FailClosedSpendLedger(
			innerLedger({ release: vi.fn().mockRejectedValue(new Error('write failed')) })
		);

		await expect(ledger.release('r1', new Date())).resolves.toBeUndefined();
	});
});
