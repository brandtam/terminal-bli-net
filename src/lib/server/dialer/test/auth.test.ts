import { env } from './env';
import { describe, it, expect } from 'vitest';
import { canonicalizeHandle, loginCaller, registerCaller, STARTER_RATIO_CREDITS } from '../auth';
import { mintSession, validateSession } from '../session';

const NOW = new Date('2026-07-12T12:00:00Z');
const DAY_S = 24 * 60 * 60;

// Storage is shared across tests in this file (the current pool version has
// no per-test isolation), so every test registers its own unique handle and
// queries are scoped to it.

function minutesLater(minutes: number): Date {
	return new Date(NOW.getTime() + minutes * 60 * 1000);
}

async function sessionExpiry(handle: string): Promise<number | undefined> {
	const row = await env.DIALER_DB.prepare(
		'SELECT expires_at FROM sessions WHERE handle = ?1 ORDER BY created_at LIMIT 1'
	)
		.bind(handle)
		.first<{ expires_at: number }>();
	return row?.expires_at;
}

describe('handles', () => {
	it('canonicalizes to uppercase and enforces the charset', () => {
		expect(canonicalizeHandle('phreak.99')).toBe('PHREAK.99');
		expect(canonicalizeHandle('  wf-7 ')).toBe('WF-7');
		expect(canonicalizeHandle('x')).toBeNull(); // too short
		expect(canonicalizeHandle('SEVENTEEN.CHARS.X')).toBeNull(); // too long
		expect(canonicalizeHandle('BAD HANDLE')).toBeNull(); // space
		expect(canonicalizeHandle('N0_CARRIER')).toBeNull(); // underscore
	});
});

describe('registration', () => {
	it('registers a caller with starter ratio credits', async () => {
		const result = await registerCaller(env.DIALER_DB, 'phreak.99', 'hunter2!', null, NOW);
		expect(result).toEqual({ ok: true, handle: 'PHREAK.99' });

		const row = await env.DIALER_DB.prepare(
			'SELECT ratio_credits, is_canon, pass_hash, salt FROM callers WHERE handle = ?1'
		)
			.bind('PHREAK.99')
			.first<{ ratio_credits: number; is_canon: number; pass_hash: string; salt: string }>();
		expect(row?.ratio_credits).toBe(STARTER_RATIO_CREDITS);
		expect(row?.is_canon).toBe(0);
		expect(row?.pass_hash).toBeTruthy();
		expect(row?.pass_hash).not.toContain('hunter2'); // hashed, never plaintext
	});

	it('refuses a taken handle, case-insensitively', async () => {
		await registerCaller(env.DIALER_DB, 'SLINGSHOT', 'password', null, NOW);
		const dupe = await registerCaller(env.DIALER_DB, 'slingshot', 'other-pass', null, NOW);
		expect(dupe).toEqual({ ok: false, reason: 'taken' });
	});

	it('refuses the seeded canon handles', async () => {
		for (const canon of ['OPERATOR', 'CAPT.VECTOR', 'wf-7']) {
			const result = await registerCaller(env.DIALER_DB, canon, 'password', null, NOW);
			expect(result, canon).toEqual({ ok: false, reason: 'taken' });
		}
	});

	it('rejects malformed handles and passwords', async () => {
		expect(await registerCaller(env.DIALER_DB, 'no spaces', 'password', null, NOW)).toEqual({
			ok: false,
			reason: 'invalid-handle'
		});
		expect(await registerCaller(env.DIALER_DB, 'FINE', 'abc', null, NOW)).toEqual({
			ok: false,
			reason: 'invalid-password'
		});
	});

	it('stores the questionnaire json', async () => {
		await registerCaller(env.DIALER_DB, 'CURIOUS', 'password', '{"why":"the hunt"}', NOW);
		const row = await env.DIALER_DB.prepare(
			'SELECT questionnaire_json FROM callers WHERE handle = ?1'
		)
			.bind('CURIOUS')
			.first<{ questionnaire_json: string }>();
		expect(row?.questionnaire_json).toBe('{"why":"the hunt"}');
	});

	it('rejects an oversized questionnaire', async () => {
		const oversized = JSON.stringify({ why: 'x'.repeat(3000) });
		expect(await registerCaller(env.DIALER_DB, 'VERBOSE', 'password', oversized, NOW)).toEqual({
			ok: false,
			reason: 'invalid-questionnaire'
		});
		// Nothing was written — the handle stays claimable.
		const row = await env.DIALER_DB.prepare('SELECT 1 AS present FROM callers WHERE handle = ?1')
			.bind('VERBOSE')
			.first();
		expect(row).toBeNull();
	});
});

describe('login', () => {
	it('round-trips register -> login', async () => {
		await registerCaller(env.DIALER_DB, 'ROUNDTRIP', 'correct-horse', null, NOW);
		expect(await loginCaller(env.DIALER_DB, 'roundtrip', 'correct-horse', NOW)).toEqual({
			ok: true,
			handle: 'ROUNDTRIP'
		});
	});

	it('fails identically for wrong password, unknown handle, and canon handles', async () => {
		await registerCaller(env.DIALER_DB, 'STONEWALL', 'correct-horse', null, NOW);
		expect(await loginCaller(env.DIALER_DB, 'STONEWALL', 'wrong', NOW)).toEqual({ ok: false });
		expect(await loginCaller(env.DIALER_DB, 'NOBODY', 'wrong', NOW)).toEqual({ ok: false });
		expect(await loginCaller(env.DIALER_DB, 'OPERATOR', 'anything', NOW)).toEqual({ ok: false });
	});

	it('locks the handle for 15 minutes after 5 failures', async () => {
		await registerCaller(env.DIALER_DB, 'LOCKOUT', 'correct-horse', null, NOW);
		for (let i = 0; i < 5; i++) {
			await loginCaller(env.DIALER_DB, 'LOCKOUT', `wrong-${i}`, NOW);
		}
		// Correct password during the lock window still answers NO CARRIER…
		expect(await loginCaller(env.DIALER_DB, 'LOCKOUT', 'correct-horse', minutesLater(1))).toEqual({
			ok: false
		});
		// …and works again once the lock expires.
		expect(await loginCaller(env.DIALER_DB, 'LOCKOUT', 'correct-horse', minutesLater(16))).toEqual({
			ok: true,
			handle: 'LOCKOUT'
		});
	});

	it('a successful login resets the failure count', async () => {
		await registerCaller(env.DIALER_DB, 'RESILIENT', 'correct-horse', null, NOW);
		for (let i = 0; i < 4; i++) {
			await loginCaller(env.DIALER_DB, 'RESILIENT', 'wrong', NOW);
		}
		expect((await loginCaller(env.DIALER_DB, 'RESILIENT', 'correct-horse', NOW)).ok).toBe(true);
		// Four more misses shouldn't lock (counter restarted at zero).
		for (let i = 0; i < 4; i++) {
			await loginCaller(env.DIALER_DB, 'RESILIENT', 'wrong', NOW);
		}
		expect((await loginCaller(env.DIALER_DB, 'RESILIENT', 'correct-horse', NOW)).ok).toBe(true);
	});
});

describe('sessions', () => {
	it('mints a token that validates back to the handle', async () => {
		await registerCaller(env.DIALER_DB, 'MINTY', 'correct-horse', null, NOW);
		const session = await mintSession(env.DIALER_DB, 'MINTY', NOW);
		expect(await validateSession(env.DIALER_DB, session.token, NOW)).toBe('MINTY');
		expect(await validateSession(env.DIALER_DB, 'garbage-token', NOW)).toBeNull();
	});

	it('stores only the hash of the token', async () => {
		await registerCaller(env.DIALER_DB, 'HASHED', 'correct-horse', null, NOW);
		const session = await mintSession(env.DIALER_DB, 'HASHED', NOW);
		const row = await env.DIALER_DB.prepare('SELECT token_hash FROM sessions WHERE handle = ?1')
			.bind('HASHED')
			.first<{ token_hash: string }>();
		expect(row?.token_hash).toBeTruthy();
		expect(row?.token_hash).not.toBe(session.token);
	});

	it('expires after 30 days and slides at most once a day', async () => {
		await registerCaller(env.DIALER_DB, 'SLIDER', 'correct-horse', null, NOW);
		const session = await mintSession(env.DIALER_DB, 'SLIDER', NOW);

		// A validation a few minutes later must NOT rewrite expiry (daily cap).
		await validateSession(env.DIALER_DB, session.token, minutesLater(5));
		expect(await sessionExpiry('SLIDER')).toBe(session.expiresAt);

		// A validation two days later slides expiry forward…
		const twoDaysOn = new Date(NOW.getTime() + 2 * DAY_S * 1000);
		expect(await validateSession(env.DIALER_DB, session.token, twoDaysOn)).toBe('SLIDER');
		expect(await sessionExpiry('SLIDER')).toBe(session.expiresAt + 2 * DAY_S);

		// …and past expiry the token is dead.
		const thirtyThreeDays = new Date(NOW.getTime() + 33 * DAY_S * 1000);
		expect(await validateSession(env.DIALER_DB, session.token, thirtyThreeDays)).toBeNull();
	});
});
