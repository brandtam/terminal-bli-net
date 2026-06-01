import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

const VALID_TOKEN = '0123456789abcdefghijklmnopqrstuv';

function makeService(response: Response): Fetcher {
	return {
		fetch: vi.fn().mockResolvedValue(response)
	} as unknown as Fetcher;
}

function makeEvent(token: string, service?: Fetcher) {
	return {
		url: new URL(`http://localhost/api/subscribe/confirm?token=${token}`),
		platform: {
			env: {
				...(service ? { REMINDER_SERVICE: service } : {})
			}
		}
	} as Parameters<typeof GET>[0];
}

describe('GET /api/subscribe/confirm', () => {
	it('confirms subscriptions through the Reminder Worker service binding', async () => {
		const service = makeService(Response.json({ ok: true, status: 'active' }));

		const response = await GET(makeEvent(VALID_TOKEN, service));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe(
			'Subscription confirmed. You will receive reminders for subscribed shows.'
		);
		expect(service.fetch).toHaveBeenCalledWith(
			new URL(`https://reminder.internal/confirm?token=${VALID_TOKEN}`),
			{ method: 'POST' }
		);
	});

	it('rejects malformed tokens before calling the Reminder Worker', async () => {
		const service = makeService(Response.json({ ok: true }));

		await expect(GET(makeEvent('bad-token', service))).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'confirmation token is invalid'
			}
		});

		expect(service.fetch).not.toHaveBeenCalled();
	});

	it('returns 503 when the service binding is not configured', async () => {
		await expect(GET(makeEvent(VALID_TOKEN))).rejects.toMatchObject({
			status: 503,
			body: {
				message: 'Reminder service is not configured'
			}
		});
	});

	it('surfaces unknown confirmation tokens from the Reminder Worker', async () => {
		const service = makeService(
			Response.json({ error: 'confirmation token not found' }, { status: 404 })
		);

		await expect(GET(makeEvent(VALID_TOKEN, service))).rejects.toMatchObject({
			status: 404,
			body: {
				message: 'confirmation token not found'
			}
		});
	});

	it('maps Reminder Worker failures to a bad gateway response', async () => {
		const service = makeService(Response.json({ error: 'worker failed' }, { status: 500 }));

		await expect(GET(makeEvent(VALID_TOKEN, service))).rejects.toMatchObject({
			status: 502,
			body: {
				message: 'worker failed'
			}
		});
	});
});
