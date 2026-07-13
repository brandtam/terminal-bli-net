import { describe, expect, it, vi } from 'vitest';
import { dialerEnv, requireSession, withBoardNode } from './guard';
import { isForcedLocal, type DialerEnv } from './env';
import { epochSeconds } from './auth';

// The session/auth SQL runs against real D1 in the workers-pool suite
// (test/auth.test.ts). These tests cover the route-side glue — header
// parsing, kill switch, 503 mapping — so the D1 here is a minimal fake.

function fakeDb(row: { handle: string; expires_at: number } | null) {
	const statement = {
		bind: vi.fn(() => statement),
		first: vi.fn(async () => row),
		run: vi.fn(async () => ({ meta: { changes: 1 } }))
	};
	const prepare = vi.fn(() => statement);
	return { db: { prepare } as unknown as D1Database, prepare };
}

function envWith(db: D1Database): DialerEnv {
	return { DIALER_DB: db } as unknown as DialerEnv;
}

function platformWith(env: Record<string, unknown>): Readonly<App.Platform> {
	return { env } as unknown as App.Platform;
}

function requestWith(authorization?: string): Request {
	return new Request('https://terminal/api/dialer/boards/foundry/status', {
		headers: authorization ? { Authorization: authorization } : {}
	});
}

describe('dialerEnv', () => {
	it('answers LOCAL MODE when there is no platform (plain vitest, no proxy)', () => {
		expect(() => dialerEnv(undefined)).toThrowError(expect.objectContaining({ status: 503 }));
	});

	it('answers LOCAL MODE when the Dialer bindings are missing', () => {
		expect(() => dialerEnv(platformWith({ KV: {} }))).toThrowError(
			expect.objectContaining({ status: 503 })
		);
	});

	it('answers LOCAL MODE when the kill switch is on', () => {
		const { db } = fakeDb(null);
		expect(() => dialerEnv(platformWith({ DIALER_DB: db, DIALER_FORCE_LOCAL: '1' }))).toThrowError(
			expect.objectContaining({ status: 503 })
		);
	});

	it('hands back the env when the bindings are present and the switch is off', () => {
		const { db } = fakeDb(null);
		const platform = platformWith({ DIALER_DB: db });
		expect(dialerEnv(platform)).toBe(platform.env);
	});
});

describe('isForcedLocal', () => {
	it.each(['1', 'true', 'on', ' TRUE '])('treats %j as on', (value) => {
		expect(isForcedLocal({ DIALER_FORCE_LOCAL: value })).toBe(true);
	});

	it.each([undefined, '', '0', 'off', 'false'])('treats %j as off', (value) => {
		expect(isForcedLocal({ DIALER_FORCE_LOCAL: value })).toBe(false);
	});
});

describe('requireSession', () => {
	it('answers NO CARRIER without touching D1 when the header is missing', async () => {
		const { db, prepare } = fakeDb(null);
		await expect(requireSession(envWith(db), requestWith())).rejects.toMatchObject({
			status: 401
		});
		expect(prepare).not.toHaveBeenCalled();
	});

	it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer   '])(
		'answers NO CARRIER without touching D1 for %j',
		async (authorization) => {
			const { db, prepare } = fakeDb(null);
			await expect(requireSession(envWith(db), requestWith(authorization))).rejects.toMatchObject({
				status: 401
			});
			expect(prepare).not.toHaveBeenCalled();
		}
	);

	it('answers NO CARRIER for a token D1 does not know', async () => {
		const { db } = fakeDb(null);
		await expect(
			requireSession(envWith(db), requestWith('Bearer unknown-token'))
		).rejects.toMatchObject({ status: 401 });
	});

	it('resolves to the handle behind a live session', async () => {
		const { db } = fakeDb({ handle: 'NEON', expires_at: epochSeconds(new Date()) + 3600 });
		await expect(requireSession(envWith(db), requestWith('Bearer live-token'))).resolves.toBe(
			'NEON'
		);
	});
});

describe('withBoardNode', () => {
	it('passes a successful interaction through untouched', async () => {
		await expect(withBoardNode(async () => 'ok')).resolves.toBe('ok');
	});

	it('degrades a board-node failure to LOCAL MODE and logs the real error', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(
				withBoardNode(async () => {
					throw new Error('no DO host under getPlatformProxy');
				})
			).rejects.toMatchObject({ status: 503 });
			expect(consoleError).toHaveBeenCalledOnce();
		} finally {
			consoleError.mockRestore();
		}
	});
});
