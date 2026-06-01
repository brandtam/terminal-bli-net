import { describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { loadPublicContentCatalog } from '$lib/server/content-catalog';

vi.mock('$lib/server/content-catalog', () => ({
	loadPublicContentCatalog: vi.fn()
}));

vi.mocked(loadPublicContentCatalog).mockReturnValue({
	groups: [
		{
			slug: 'seinfeld',
			name: 'Seinfeld',
			description: '',
			setting: '',
			era: '',
			image: '',
			active: true,
			episodes: []
		},
		{
			slug: 'mash',
			name: 'M*A*S*H',
			description: '',
			setting: '',
			era: '',
			image: '',
			active: true,
			episodes: []
		}
	],
	bots: [],
	channels: []
});

function makeKv(currentValue?: string): KVNamespace {
	const store = new Map<string, string>();
	return {
		get: vi.fn(async (key: string) => currentValue ?? store.get(key) ?? null),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
		})
	} as unknown as KVNamespace;
}

function makeEvent(body: unknown, service?: Fetcher, kv: KVNamespace = makeKv()) {
	return {
		request: new Request('http://localhost/api/subscribe', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		platform: {
			env: {
				KV: kv,
				REMINDER_SUBSCRIBE_RATE_LIMIT_PER_HOUR: '2',
				...(service ? { REMINDER_SERVICE: service } : {})
			}
		},
		getClientAddress: () => '203.0.113.10'
	} as Parameters<typeof POST>[0];
}

function makeRawEvent(body: string, service?: Fetcher, kv: KVNamespace = makeKv()) {
	return {
		request: new Request('http://localhost/api/subscribe', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body
		}),
		platform: {
			env: {
				KV: kv,
				REMINDER_SUBSCRIBE_RATE_LIMIT_PER_HOUR: '2',
				...(service ? { REMINDER_SERVICE: service } : {})
			}
		},
		getClientAddress: () => '203.0.113.10'
	} as Parameters<typeof POST>[0];
}

function makeService(response: Response): Fetcher {
	return {
		fetch: vi.fn().mockResolvedValue(response)
	} as unknown as Fetcher;
}

describe('POST /api/subscribe', () => {
	it('validates and forwards subscriptions to the Reminder Worker service binding', async () => {
		const service = makeService(Response.json({ ok: true }));

		const response = await POST(
			makeEvent(
				{
					email: ' Fan@Example.COM ',
					timezone: 'America/New_York',
					shows: ['seinfeld', 'seinfeld', 'mash']
				},
				service
			)
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(service.fetch).toHaveBeenCalledTimes(1);

		const [url, init] = vi.mocked(service.fetch).mock.calls[0];
		expect(url).toBe('https://reminder.internal/subscribe');
		expect(init?.method).toBe('POST');
		expect(JSON.parse(String(init?.body))).toEqual({
			email: 'fan@example.com',
			timezone: 'America/New_York',
			shows: ['seinfeld', 'mash']
		});
	});

	it('records subscription attempts in KV before forwarding to the Reminder Worker', async () => {
		const service = makeService(Response.json({ ok: true }));
		const kv = makeKv();

		await POST(
			makeEvent({ email: 'fan@example.com', timezone: 'UTC', shows: ['seinfeld'] }, service, kv)
		);

		expect(kv.get).toHaveBeenCalledWith(expect.stringMatching(/^subscribe-rate:203\.0\.113\.10:/));
		expect(kv.put).toHaveBeenCalledWith(
			expect.stringMatching(/^subscribe-rate:203\.0\.113\.10:/),
			'1',
			expect.objectContaining({ expirationTtl: expect.any(Number) })
		);
	});

	it('returns 503 when the service binding is not configured', async () => {
		await expect(
			POST(makeEvent({ email: 'fan@example.com', timezone: 'UTC', shows: ['seinfeld'] }))
		).rejects.toMatchObject({
			status: 503
		});
	});

	it('rejects invalid subscription payloads before calling the Reminder Worker', async () => {
		const service = makeService(Response.json({ ok: true }));

		await expect(
			POST(makeEvent({ email: 'bad', timezone: 'UTC', shows: ['seinfeld'] }, service))
		).rejects.toMatchObject({
			status: 400
		});

		expect(service.fetch).not.toHaveBeenCalled();
	});

	it('rejects invalid JSON before calling the Reminder Worker', async () => {
		const service = makeService(Response.json({ ok: true }));

		await expect(POST(makeRawEvent('{nope', service))).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'Invalid JSON body'
			}
		});

		expect(service.fetch).not.toHaveBeenCalled();
	});

	it('rejects invalid timezones before calling the Reminder Worker', async () => {
		const service = makeService(Response.json({ ok: true }));

		await expect(
			POST(
				makeEvent({ email: 'fan@example.com', timezone: 'Mars/Base', shows: ['seinfeld'] }, service)
			)
		).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'timezone "Mars/Base" is invalid'
			}
		});

		expect(service.fetch).not.toHaveBeenCalled();
	});

	it('rejects unknown shows before calling the Reminder Worker', async () => {
		const service = makeService(Response.json({ ok: true }));

		await expect(
			POST(makeEvent({ email: 'fan@example.com', timezone: 'UTC', shows: ['unknown'] }, service))
		).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'show "unknown" not found'
			}
		});

		expect(service.fetch).not.toHaveBeenCalled();
	});

	it('rate limits subscription attempts before calling the Reminder Worker', async () => {
		const service = makeService(Response.json({ ok: true }));
		const kv = makeKv('2');

		await expect(
			POST(
				makeEvent({ email: 'fan@example.com', timezone: 'UTC', shows: ['seinfeld'] }, service, kv)
			)
		).rejects.toMatchObject({
			status: 429,
			body: {
				message: 'Rate limit exceeded (2 subscription attempts/hour). Please wait and try again.'
			}
		});

		expect(kv.put).not.toHaveBeenCalled();
		expect(service.fetch).not.toHaveBeenCalled();
	});

	it('treats malformed rate-limit counters as zero', async () => {
		const service = makeService(Response.json({ ok: true }));
		const kv = makeKv('not-a-number');

		await POST(
			makeEvent({ email: 'fan@example.com', timezone: 'UTC', shows: ['seinfeld'] }, service, kv)
		);

		expect(kv.put).toHaveBeenCalledWith(
			expect.stringMatching(/^subscribe-rate:203\.0\.113\.10:/),
			'1',
			expect.objectContaining({ expirationTtl: expect.any(Number) })
		);
	});

	it('surfaces Reminder Worker validation errors', async () => {
		const service = makeService(
			Response.json({ error: 'shows must include at least one show' }, { status: 400 })
		);

		await expect(
			POST(makeEvent({ email: 'fan@example.com', timezone: 'UTC', shows: ['seinfeld'] }, service))
		).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'shows must include at least one show'
			}
		});
	});

	it('maps Reminder Worker failures to a bad gateway response', async () => {
		const service = makeService(Response.json({ error: 'worker failed' }, { status: 500 }));

		await expect(
			POST(makeEvent({ email: 'fan@example.com', timezone: 'UTC', shows: ['seinfeld'] }, service))
		).rejects.toMatchObject({
			status: 502,
			body: {
				message: 'worker failed'
			}
		});
	});
});
