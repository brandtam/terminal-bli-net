import { describe, expect, it, vi } from 'vitest';
import { getSpendLedger } from './factory';

const REQUEST = {
	candidates: [{ provider: 'openai' as const, model: 'gpt-4o-mini' }],
	maxInputTokens: 100,
	maxOutputTokens: 300
};

describe('getSpendLedger', () => {
	it('fails closed in production: an unreachable SPEND_LEDGER binding denies the reserve', async () => {
		const service = {
			fetch: vi.fn(async () => new Response('down', { status: 503 }))
		} as unknown as Fetcher;

		const ledger = getSpendLedger({ SPEND_LEDGER: service });
		const result = await ledger.reserve(REQUEST, new Date('2026-06-11T12:00:00Z'));

		expect(service.fetch).toHaveBeenCalled();
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('ledger-unavailable');
	});

	it('uses the in-memory adapter when no binding is present (dev fails open)', async () => {
		const ledger = getSpendLedger({});
		const result = await ledger.reserve(REQUEST, new Date('2026-06-11T12:00:00Z'));

		// No external authority to be unreachable — a normal request is admitted.
		expect(result.ok).toBe(true);
	});

	it('fails closed when the binding is required but absent', async () => {
		const ledger = getSpendLedger({ SPEND_LEDGER_REQUIRED: 'true' });
		const result = await ledger.reserve(REQUEST, new Date('2026-06-11T12:00:00Z'));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('ledger-unavailable');
	});
});
