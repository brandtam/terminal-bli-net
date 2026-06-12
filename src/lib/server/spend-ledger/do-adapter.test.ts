import { describe, expect, it, vi } from 'vitest';
import { DurableObjectSpendLedger, SPEND_LEDGER_ROUTES } from './do-adapter';

// The adapter is a thin RPC client over a service binding, so the tests pin the
// wire contract: the right path, epoch-ms time, the request echoed through, and
// a non-2xx reply surfacing as a throw (the hook the factory turns into a
// fail-closed denial in step 4).
function fetcherReturning(response: Response) {
	const fetch = vi.fn(async () => response);
	return { fetch: { fetch } as unknown as Fetcher, spy: fetch };
}

describe('DurableObjectSpendLedger', () => {
	it('posts reserve with epoch-ms time and returns the ledger result', async () => {
		const { fetch, spy } = fetcherReturning(
			Response.json({
				ok: true,
				reservationId: 'r1',
				provider: 'openai',
				model: 'gpt-4o-mini',
				reservedUsd: 0.05,
				expiresAt: 123
			})
		);
		const ledger = new DurableObjectSpendLedger(fetch);
		const now = new Date('2026-01-04T10:00:00Z');

		const result = await ledger.reserve(
			{
				candidates: [{ provider: 'openai', model: 'gpt-4o-mini' }],
				maxInputTokens: 100,
				maxOutputTokens: 300
			},
			now
		);

		expect(result).toMatchObject({ ok: true, reservationId: 'r1', provider: 'openai' });
		const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
		expect(String(url)).toContain(SPEND_LEDGER_ROUTES.reserve);
		const body = JSON.parse(String(init.body));
		expect(body.nowMs).toBe(now.getTime());
		expect(body.req.maxOutputTokens).toBe(300);
	});

	it('sends reservationId + actual cost on reconcile', async () => {
		const { fetch, spy } = fetcherReturning(Response.json({ ok: true }));
		const ledger = new DurableObjectSpendLedger(fetch);

		await ledger.reconcile(
			'r1',
			{ provider: 'openai', usd: 0.02 },
			new Date('2026-01-04T10:00:00Z')
		);

		const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
		expect(String(url)).toContain(SPEND_LEDGER_ROUTES.reconcile);
		const body = JSON.parse(String(init.body));
		expect(body).toMatchObject({ reservationId: 'r1', actual: { provider: 'openai', usd: 0.02 } });
	});

	it('throws when the ledger replies non-2xx (basis for fail-closed)', async () => {
		const { fetch } = fetcherReturning(new Response('nope', { status: 503 }));
		const ledger = new DurableObjectSpendLedger(fetch);

		await expect(ledger.status(new Date())).rejects.toThrow(/failed: 503/);
	});
});
