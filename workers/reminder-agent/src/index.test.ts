/// <reference types="@cloudflare/workers-types" />
import { describe, expect, it, vi } from 'vitest';
import {
	handleEmail,
	handleConfirm,
	handleSubscribe,
	parseSubscribePayload,
	type ReminderWorkerEnv
} from './index';

vi.mock('agents', () => ({
	Agent: class {
		sql() {
			return [];
		}
		getSchedules() {
			return [];
		}
		async schedule() {
			return undefined;
		}
	},
	getAgentByName: vi.fn()
}));

function makeRequest(body: unknown, method = 'POST'): Request {
	return new Request('https://reminder.internal/subscribe', {
		method,
		headers: { 'content-type': 'application/json' },
		body: method === 'POST' ? JSON.stringify(body) : undefined
	});
}

function makeConfirmRequest(token: string, method = 'GET'): Request {
	return new Request(`https://reminder.internal/confirm?token=${token}`, { method });
}

describe('parseSubscribePayload', () => {
	it('normalizes email and deduplicates shows', () => {
		expect(
			parseSubscribePayload({
				email: ' FAN@Example.COM ',
				timezone: 'America/Los_Angeles',
				shows: ['seinfeld', 'mash', 'seinfeld']
			})
		).toEqual({
			email: 'fan@example.com',
			timezone: 'America/Los_Angeles',
			shows: ['seinfeld', 'mash']
		});
	});

	it('rejects invalid timezones', () => {
		expect(() =>
			parseSubscribePayload({
				email: 'fan@example.com',
				timezone: 'Mars/Base',
				shows: ['seinfeld']
			})
		).toThrow('timezone "Mars/Base" is invalid');
	});
});

describe('handleSubscribe', () => {
	it('stores subscriptions through the singleton ReminderAgent', async () => {
		const subscribe = vi.fn().mockResolvedValue(undefined);
		const response = await handleSubscribe(
			makeRequest({
				email: 'fan@example.com',
				timezone: 'UTC',
				shows: ['seinfeld']
			}),
			{} as ReminderWorkerEnv,
			async () => ({
				subscribe,
				confirmSubscription: vi.fn(),
				unsubscribeBySignedAddress: vi.fn()
			})
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, status: 'pending' });
		expect(subscribe).toHaveBeenCalledWith('fan@example.com', 'UTC', ['seinfeld']);
	});

	it('rejects non-POST requests', async () => {
		const response = await handleSubscribe(makeRequest({}, 'GET'), {} as ReminderWorkerEnv);

		expect(response.status).toBe(405);
		expect(await response.json()).toEqual({ error: 'Method not allowed' });
	});

	it('returns validation errors as JSON', async () => {
		const response = await handleSubscribe(
			makeRequest({
				email: 'fan@example.com',
				timezone: 'UTC',
				shows: []
			}),
			{} as ReminderWorkerEnv
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'shows must include at least one show' });
	});
});

describe('handleConfirm', () => {
	it('activates a pending subscription by token', async () => {
		const token = '0123456789abcdefghijklmnopqrstuv';
		const confirmSubscription = vi.fn().mockResolvedValue(true);
		const response = await handleConfirm(
			makeConfirmRequest(token),
			{} as ReminderWorkerEnv,
			async () => ({
				subscribe: vi.fn(),
				confirmSubscription,
				unsubscribeBySignedAddress: vi.fn()
			})
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, status: 'active' });
		expect(confirmSubscription).toHaveBeenCalledWith(token);
	});

	it('rejects malformed confirmation tokens before resolving the agent', async () => {
		const resolveAgent = vi.fn();
		const response = await handleConfirm(
			makeConfirmRequest('bad-token'),
			{} as ReminderWorkerEnv,
			resolveAgent
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'confirmation token is invalid' });
		expect(resolveAgent).not.toHaveBeenCalled();
	});

	it('returns 404 when the confirmation token is unknown', async () => {
		const response = await handleConfirm(
			makeConfirmRequest('0123456789abcdefghijklmnopqrstuv'),
			{} as ReminderWorkerEnv,
			async () => ({
				subscribe: vi.fn(),
				confirmSubscription: vi.fn().mockResolvedValue(false),
				unsubscribeBySignedAddress: vi.fn()
			})
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'confirmation token not found' });
	});
});

describe('handleEmail', () => {
	it('unsubscribes by signed address without passing the email message into the DO', async () => {
		const unsubscribeBySignedAddress = vi.fn().mockResolvedValue(true);
		const message = {
			to: 'unsub+0123456789abcdefghijklmnopqrstuv@bli.net',
			setReject: vi.fn()
		} as unknown as ForwardableEmailMessage;

		await handleEmail(message, {} as ReminderWorkerEnv, async () => ({
			subscribe: vi.fn(),
			confirmSubscription: vi.fn(),
			unsubscribeBySignedAddress
		}));

		expect(unsubscribeBySignedAddress).toHaveBeenCalledWith(
			'unsub+0123456789abcdefghijklmnopqrstuv@bli.net'
		);
		expect(message.setReject).not.toHaveBeenCalled();
	});

	it('rejects inbound unsubscribe emails with invalid signatures', async () => {
		const message = {
			to: 'unsub+bad@bli.net',
			setReject: vi.fn()
		} as unknown as ForwardableEmailMessage;

		await handleEmail(message, {} as ReminderWorkerEnv, async () => ({
			subscribe: vi.fn(),
			confirmSubscription: vi.fn(),
			unsubscribeBySignedAddress: vi.fn().mockResolvedValue(false)
		}));

		expect(message.setReject).toHaveBeenCalledWith('Invalid unsubscribe signature');
	});
});
