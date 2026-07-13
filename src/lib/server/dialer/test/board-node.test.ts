import { env } from './env';
import { describe, it, expect } from 'vitest';

// Storage is shared across tests in this file (the current pool version has
// no per-test isolation), so every test uses its own board instance.
function boardStub(name: string) {
	return env.DIALER_BOARD_NODE.get(env.DIALER_BOARD_NODE.idFromName(name));
}

function upgradeRequest(handle?: string): Request {
	const headers = new Headers({ Upgrade: 'websocket' });
	if (handle) headers.set('X-Dialer-Handle', handle);
	return new Request('https://dialer/socket', { headers });
}

describe('DialerBoardNode', () => {
	it('starts silent: no callers, no last caller, not busy', async () => {
		expect(await boardStub('silent-board').status()).toEqual({
			callers: 0,
			lastCaller: null,
			online: [],
			busy: false
		});
	});

	it('counts calls and remembers the last caller', async () => {
		const stub = boardStub('counter-board');
		await stub.recordCall('NEON');
		await stub.recordCall('SLINGSHOT');
		const status = await stub.status();
		expect(status.callers).toBe(2);
		expect(status.lastCaller).toBe('SLINGSHOT');
	});

	it('keeps counters per board', async () => {
		await boardStub('board-a').recordCall('NEON');
		expect((await boardStub('board-b').status()).callers).toBe(0);
	});

	it('refuses non-websocket requests', async () => {
		const res = await boardStub('http-board').fetch('https://dialer/socket');
		expect(res.status).toBe(426);
	});

	it('refuses an upgrade without an authenticated handle', async () => {
		const res = await boardStub('anon-board').fetch(upgradeRequest());
		expect(res.status).toBe(401);
	});

	it('accepts an upgrade, shows presence, and cleans up on close', async () => {
		const stub = boardStub('presence-board');
		const res = await stub.fetch(upgradeRequest('NEON'));
		expect(res.status).toBe(101);
		const ws = res.webSocket;
		expect(ws).toBeTruthy();
		ws!.accept();

		let status = await stub.status();
		expect(status.online).toEqual(['NEON']);
		expect(status.callers).toBe(1);
		expect(status.lastCaller).toBe('NEON');

		ws!.close();
		// Close delivery is async; poll briefly rather than sleeping blind.
		for (let i = 0; i < 20 && (await stub.status()).online.length > 0; i++) {
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
		status = await stub.status();
		expect(status.online).toEqual([]);
	});
});
