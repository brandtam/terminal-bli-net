import { describe, expect, it, vi } from 'vitest';
import {
	evaluateChatGate,
	issueSessionToken,
	verifySessionToken,
	verifyTurnstileToken,
	verifyTurnstileTokenResult
} from './turnstile';

const SECRET = 'test-turnstile-secret';
const NOW = new Date('2026-06-11T12:00:00Z');

function siteverify(success: boolean, ok = true): typeof fetch {
	return vi.fn(
		async () => new Response(JSON.stringify({ success }), { status: ok ? 200 : 500 })
	) as unknown as typeof fetch;
}

describe('session token', () => {
	it('round-trips a freshly issued token', async () => {
		const token = await issueSessionToken(SECRET, NOW);
		expect(await verifySessionToken(SECRET, token, NOW)).toBe(true);
	});

	it('rejects a token past its 30-minute window', async () => {
		const token = await issueSessionToken(SECRET, NOW);
		const later = new Date(NOW.getTime() + 30 * 60 * 1000 + 1);
		expect(await verifySessionToken(SECRET, token, later)).toBe(false);
	});

	it('rejects a tampered signature', async () => {
		const token = await issueSessionToken(SECRET, NOW);
		const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
		expect(await verifySessionToken(SECRET, tampered, NOW)).toBe(false);
	});

	it('rejects a token signed with a different secret', async () => {
		const token = await issueSessionToken('other-secret', NOW);
		expect(await verifySessionToken(SECRET, token, NOW)).toBe(false);
	});

	it('rejects malformed tokens', async () => {
		expect(await verifySessionToken(SECRET, 'garbage', NOW)).toBe(false);
		expect(await verifySessionToken(SECRET, '.sig', NOW)).toBe(false);
		expect(await verifySessionToken(SECRET, 'notanumber.sig', NOW)).toBe(false);
	});
});

describe('verifyTurnstileToken', () => {
	it('posts the secret + token and returns success', async () => {
		const fetchImpl = siteverify(true);
		const result = await verifyTurnstileToken(SECRET, 'tok', '203.0.113.7', fetchImpl);
		expect(result).toBe(true);
		const [, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
			.calls[0];
		expect((init.body as FormData).get('secret')).toBe(SECRET);
		expect((init.body as FormData).get('response')).toBe('tok');
		expect((init.body as FormData).get('remoteip')).toBe('203.0.113.7');
	});

	it('returns false when siteverify says failure', async () => {
		expect(await verifyTurnstileToken(SECRET, 'tok', undefined, siteverify(false))).toBe(false);
	});

	it('returns false on a non-2xx siteverify response', async () => {
		const fetchImpl = siteverify(true, false);
		expect(await verifyTurnstileToken(SECRET, 'tok', undefined, fetchImpl)).toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('distinguishes verifier outages from invalid tokens', async () => {
		expect(
			await verifyTurnstileTokenResult(SECRET, 'tok', undefined, siteverify(true, false))
		).toBe('unavailable');
		expect(await verifyTurnstileTokenResult(SECRET, 'tok', undefined, siteverify(false))).toBe(
			'invalid'
		);
	});
});

describe('evaluateChatGate', () => {
	it('admits everything when no secret is configured (dev fail-open)', async () => {
		const result = await evaluateChatGate(undefined, { turnstileToken: 'x' }, NOW);
		expect(result).toEqual({ ok: true });
	});

	it('admits a valid session token without minting a new one', async () => {
		const sessionToken = await issueSessionToken(SECRET, NOW);
		const result = await evaluateChatGate(SECRET, { sessionToken }, NOW, siteverify(false));
		expect(result).toEqual({ ok: true });
	});

	it('admits a valid Turnstile token and mints a session token', async () => {
		const result = await evaluateChatGate(SECRET, { turnstileToken: 'tok' }, NOW, siteverify(true));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.issuedSessionToken).toBeDefined();
			expect(await verifySessionToken(SECRET, result.issuedSessionToken!, NOW)).toBe(true);
		}
	});

	it('refuses when neither token is valid', async () => {
		const result = await evaluateChatGate(
			SECRET,
			{ turnstileToken: 'bad', sessionToken: 'expired' },
			NOW,
			siteverify(false)
		);
		expect(result).toEqual({ ok: false });
	});

	it('soft-admits a token-bearing request when siteverify is unavailable', async () => {
		const result = await evaluateChatGate(
			SECRET,
			{ turnstileToken: 'tok' },
			NOW,
			siteverify(true, false)
		);
		expect(result).toEqual({ ok: true });
	});

	it('does not soft-admit siteverify outages without a token', async () => {
		const result = await evaluateChatGate(SECRET, {}, NOW, siteverify(true, false));
		expect(result).toEqual({ ok: false });
	});
});
