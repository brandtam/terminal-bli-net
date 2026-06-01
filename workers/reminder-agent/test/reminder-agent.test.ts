import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createEmailActionToken } from '../../../src/lib/server/email-composer';
import type { PublicContentCatalog } from '../../../src/lib/server/content-catalog';
import type { ReminderAgent } from '../src/index';

// Keep in sync with the value provided to the pool in vitest.config.ts.
const SECRET = 'test-secret';

interface SubscriberRow {
	email: string;
	status: string;
	timezone: string;
	show_subscriptions: string;
	pending_timezone: string | null;
	pending_shows: string | null;
	confirmation_token: string;
	confirmation_sent_at: string | null;
}

type Stub = ReturnType<typeof env.REMINDER_AGENT.getByName>;

// Each test gets its own named Durable Object instance, so their SQLite storage
// is independent regardless of test ordering (matches the Cloudflare docs pattern
// of one idFromName per test).
function agent(instance: string): Stub {
	return env.REMINDER_AGENT.getByName(instance);
}

// Read a subscriber row straight from the DO's SQLite storage so we assert on
// stored state, not on what a method chose to return.
function readSubscriber(stub: Stub, email: string): Promise<SubscriberRow | undefined> {
	return runInDurableObject(
		stub,
		(_instance, state) =>
			state.storage.sql
				.exec<SubscriberRow>('SELECT * FROM subscribers WHERE email = ?', email)
				.toArray()[0]
	);
}

// Backdate the confirmation timestamp so a follow-up subscribe() isn't swallowed
// by the resend throttle — simulates an edit made well after the first one.
function ageConfirmation(stub: Stub, email: string): Promise<unknown> {
	return runInDurableObject(stub, (_instance, state) =>
		state.storage.sql.exec(
			"UPDATE subscribers SET confirmation_sent_at = datetime('now', '-1 hour') WHERE email = ?",
			email
		)
	);
}

describe('ReminderAgent subscription lifecycle', () => {
	it('records a pending subscriber and stages the requested edit', async () => {
		const stub = agent('lifecycle-pending');
		await stub.subscribe('new@example.com', 'America/New_York', ['seinfeld']);

		const row = await readSubscriber(stub, 'new@example.com');
		expect(row?.status).toBe('pending');
		expect(row?.pending_timezone).toBe('America/New_York');
		expect(row?.pending_shows).toBe(JSON.stringify(['seinfeld']));
		expect(row?.confirmation_token).toMatch(/^[A-Za-z0-9_-]{32}$/);
		// Nothing is live yet — the live columns hold defaults until confirmation.
		expect(row?.show_subscriptions).toBe('[]');
	});

	it('promotes the pending edit to live and activates on confirm', async () => {
		const stub = agent('lifecycle-confirm');
		await stub.subscribe('confirm@example.com', 'America/New_York', ['seinfeld']);
		const pending = await readSubscriber(stub, 'confirm@example.com');

		expect(await stub.confirmSubscription(pending!.confirmation_token)).toBe(true);

		const active = await readSubscriber(stub, 'confirm@example.com');
		expect(active?.status).toBe('active');
		expect(active?.timezone).toBe('America/New_York');
		expect(active?.show_subscriptions).toBe(JSON.stringify(['seinfeld']));
		expect(active?.pending_timezone).toBeNull();
		expect(active?.pending_shows).toBeNull();
		// Token is cleared so the link can't be replayed.
		expect(active?.confirmation_token).toBe('');
	});

	it('keeps an active subscriber live when their address is re-submitted', async () => {
		const stub = agent('lifecycle-resubscribe');
		// Establish an active subscriber.
		await stub.subscribe('victim@example.com', 'America/New_York', ['seinfeld']);
		const first = await readSubscriber(stub, 'victim@example.com');
		await stub.confirmSubscription(first!.confirmation_token);
		await ageConfirmation(stub, 'victim@example.com');

		// Someone (the subscriber editing, or an attacker) re-submits the address.
		await stub.subscribe('victim@example.com', 'America/Los_Angeles', ['mash']);

		const row = await readSubscriber(stub, 'victim@example.com');
		// Still active, still receiving the originally-confirmed shows...
		expect(row?.status).toBe('active');
		expect(row?.timezone).toBe('America/New_York');
		expect(row?.show_subscriptions).toBe(JSON.stringify(['seinfeld']));
		// ...with the new edit staged but not yet live.
		expect(row?.pending_timezone).toBe('America/Los_Angeles');
		expect(row?.pending_shows).toBe(JSON.stringify(['mash']));
	});

	it('rejects a confirmation token after it has been used', async () => {
		const stub = agent('lifecycle-replay');
		await stub.subscribe('replay@example.com', 'UTC', ['seinfeld']);
		const { confirmation_token } = (await readSubscriber(stub, 'replay@example.com'))!;

		expect(await stub.confirmSubscription(confirmation_token)).toBe(true);
		expect(await stub.confirmSubscription(confirmation_token)).toBe(false);
	});

	it('throttles repeat confirmation sends for the same address', async () => {
		const stub = agent('lifecycle-throttle');
		await stub.subscribe('flood@example.com', 'UTC', ['seinfeld']);
		const first = await readSubscriber(stub, 'flood@example.com');

		// Immediate re-submit, inside the throttle window, is a no-op: no new token,
		// no re-staged edit (and so no second confirmation email).
		await stub.subscribe('flood@example.com', 'America/Los_Angeles', ['mash']);
		const second = await readSubscriber(stub, 'flood@example.com');

		expect(second?.confirmation_token).toBe(first?.confirmation_token);
		expect(second?.pending_shows).toBe(JSON.stringify(['seinfeld']));
	});

	it('unsubscribes by the HMAC-signed reply address', async () => {
		const stub = agent('lifecycle-unsub');
		await stub.subscribe('bye@example.com', 'UTC', ['seinfeld']);
		const { confirmation_token } = (await readSubscriber(stub, 'bye@example.com'))!;
		await stub.confirmSubscription(confirmation_token);

		const token = await createEmailActionToken('unsubscribe:bye@example.com', SECRET);
		expect(await stub.unsubscribeBySignedAddress(`unsub+${token}@bli.net`)).toBe(true);
		expect(await readSubscriber(stub, 'bye@example.com')).toBeUndefined();

		// A bogus address is rejected and removes nothing.
		expect(await stub.unsubscribeBySignedAddress('unsub+not-a-real-token@bli.net')).toBe(false);
	});
});

describe('ReminderAgent delivery', () => {
	// A minimal catalog with Seinfeld airing in slot 21 (10:30 UTC).
	const catalog: PublicContentCatalog = {
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
			}
		],
		bots: [
			{
				id: 'george',
				group: 'seinfeld',
				name: 'George Costanza',
				occupation: 'Importer/exporter',
				image: '',
				greeting: 'Yeah?',
				bio: ''
			}
		],
		channels: [
			{
				slug: 'ch-comedy',
				name: 'Comedy',
				number: 6,
				network: 'CHATR',
				schedule: Array.from({ length: 48 }, (_, index) =>
					index === 21 ? { showSlug: 'seinfeld', season: 5, episode: 14 } : null
				)
			}
		]
	};

	// Run a block inside the DO with its catalog fetch stubbed. The test runner and
	// the Durable Object are separate isolates, so the fetch override has to happen
	// inside the DO context — that's what runInDurableObject gives us.
	function withStubbedCatalog<T>(stub: Stub, fn: (instance: ReminderAgent) => Promise<T>) {
		return runInDurableObject(stub, async (instance) => {
			const realFetch = globalThis.fetch;
			globalThis.fetch = (async () =>
				new Response(JSON.stringify(catalog), {
					headers: { 'content-type': 'application/json' }
				})) as typeof fetch;
			try {
				return await fn(instance);
			} finally {
				globalThis.fetch = realFetch;
			}
		});
	}

	async function seedActiveSubscriber(stub: Stub, email: string, timezone: string): Promise<void> {
		await stub.subscribe(email, timezone, ['seinfeld']);
		const { confirmation_token } = (await readSubscriber(stub, email))!;
		await stub.confirmSubscription(confirmation_token);
	}

	it('sends a due reminder once and dedups repeat scans of the same slot', async () => {
		const stub = agent('delivery-dedup');
		await seedActiveSubscriber(stub, 'fan@example.com', 'UTC');

		// 10:00 UTC + 30 min lead lands the reminder in the 10:30 slot (index 21).
		const when = new Date('2026-01-04T10:00:00Z');
		const counts = await withStubbedCatalog(stub, async (instance) => ({
			first: await instance.deliverDueReminders(when),
			// A second scan of the same slot delivers nothing — the send is recorded.
			second: await instance.deliverDueReminders(when)
		}));
		expect(counts.first).toBe(1);
		expect(counts.second).toBe(0);

		const sent = await runInDurableObject(stub, (_instance, state) =>
			state.storage.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM sent_reminders').one()
		);
		expect(sent.n).toBe(1);
	});

	it('does not send when no subscribed show airs in the target slot', async () => {
		const stub = agent('delivery-miss');
		await seedActiveSubscriber(stub, 'fan@example.com', 'UTC');

		// 09:00 UTC + 30 min = 09:30 slot, where Seinfeld is not scheduled.
		const sent = await withStubbedCatalog(stub, (instance) =>
			instance.deliverDueReminders(new Date('2026-01-04T09:00:00Z'))
		);
		expect(sent).toBe(0);
	});
});
