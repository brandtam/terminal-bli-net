import { env } from './env';
import { describe, it, expect } from 'vitest';
import { registerCaller } from '../auth';
import { DAILY_MINUTES_BUDGET } from '../boards';

const NOW = new Date('2026-07-12T12:00:00Z');

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

	it('announces the remaining time budget on join', async () => {
		const stub = boardStub('time-board');
		const res = await stub.fetch(upgradeRequest('CLOCKWATCH'));
		const ws = res.webSocket!;
		const messages: { type: string; remaining?: number }[] = [];
		ws.addEventListener('message', (event) => {
			messages.push(JSON.parse(event.data as string));
		});
		ws.accept();

		await waitFor(() => messages.some((m) => m.type === 'time'));
		const time = messages.find((m) => m.type === 'time')!;
		// The handle isn't a registered caller here, so no minutes are burned yet.
		expect(time.remaining).toBe(DAILY_MINUTES_BUDGET);
		ws.close();
	});

	it("answers TIME'S UP when the daily budget is already spent", async () => {
		await registerCaller(env.DIALER_DB, 'TIMEDOUT', 'password', null, NOW);
		await env.DIALER_DB.prepare('UPDATE callers SET minutes_today = ?2 WHERE handle = ?1')
			.bind('TIMEDOUT', DAILY_MINUTES_BUDGET)
			.run();

		const res = await boardStub('spent-board').fetch(upgradeRequest('TIMEDOUT'));
		expect(res.status).toBe(403);
		expect(await res.text()).toContain("TIME'S UP");
	});

	it('flushes at least one used minute to D1 when the caller disconnects', async () => {
		await registerCaller(env.DIALER_DB, 'FLUSHED', 'password', null, NOW);
		const stub = boardStub('flush-board');
		const res = await stub.fetch(upgradeRequest('FLUSHED'));
		const ws = res.webSocket!;
		ws.accept();
		ws.close();

		await waitFor(async () => {
			const row = await env.DIALER_DB.prepare('SELECT minutes_today FROM callers WHERE handle = ?1')
				.bind('FLUSHED')
				.first<{ minutes_today: number }>();
			return (row?.minutes_today ?? 0) >= 1;
		});
	});

	it('broadcasts node chat to every caller and drops rapid-fire lines', async () => {
		const stub = boardStub('chat-board');
		const resA = await stub.fetch(upgradeRequest('TALKER'));
		const resB = await stub.fetch(upgradeRequest('LISTENER'));
		const wsA = resA.webSocket!;
		const wsB = resB.webSocket!;
		const heard: { type: string; handle?: string; text?: string }[] = [];
		wsB.addEventListener('message', (event) => {
			heard.push(JSON.parse(event.data as string));
		});
		wsA.accept();
		wsB.accept();

		wsA.send(JSON.stringify({ type: 'chat', text: '  anyone   seen the scanlog?  ' }));
		wsA.send(JSON.stringify({ type: 'chat', text: 'second line inside the cooldown' }));

		await waitFor(() => heard.some((m) => m.type === 'chat'));
		const chats = heard.filter((m) => m.type === 'chat');
		expect(chats).toEqual([{ type: 'chat', handle: 'TALKER', text: 'anyone seen the scanlog?' }]);

		wsA.close();
		wsB.close();
	});

	it('ignores junk frames instead of crashing the node', async () => {
		const stub = boardStub('junk-board');
		const res = await stub.fetch(upgradeRequest('JUNKMAIL'));
		const ws = res.webSocket!;
		ws.accept();
		ws.send('not json at all');
		ws.send(JSON.stringify({ type: 'chat', text: 42 }));
		ws.send(JSON.stringify({ type: 'chat' }));
		// The node is still standing if status answers.
		expect((await stub.status()).online).toEqual(['JUNKMAIL']);
		ws.close();
	});
});

/** Poll an async condition instead of sleeping blind. */
async function waitFor(check: () => boolean | Promise<boolean>, tries = 40): Promise<void> {
	for (let i = 0; i < tries; i++) {
		if (await check()) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error('condition never came true');
}
