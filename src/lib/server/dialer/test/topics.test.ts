import { env } from './env';
import { describe, it, expect } from 'vitest';
import { systemById } from '../../../apps/dialer/content';
import { registerCaller } from '../auth';
import {
	createPost,
	createTopic,
	listPosts,
	listTopics,
	BODY_MAX_CHARS,
	POST_COOLDOWN_S
} from '../topics';

const NOW = new Date('2026-07-12T12:00:00Z');

// Storage is shared across tests (no pool isolation): every test registers
// its own unique handle, and tests that assert over a whole board use the
// boards without canon seeds (night-circuit, foundry) as scratch space.
// rusty-diskette carries the seeded canon from migration 0003.

function later(seconds: number): Date {
	return new Date(NOW.getTime() + seconds * 1000);
}

async function caller(handle: string): Promise<string> {
	const result = await registerCaller(env.DIALER_DB, handle, 'password', null, NOW);
	if (!result.ok) throw new Error(`test caller ${handle} not registered`);
	return result.handle;
}

describe('canon seed (migration 0003)', () => {
	it('lists Rusty Diskette canon topics pinned-first in fiction order', async () => {
		const topics = await listTopics(env.DIALER_DB, 'rusty-diskette');
		const canon = topics.filter((t) => t.canon);
		expect(canon.length).toBeGreaterThanOrEqual(7);
		expect(topics.slice(0, canon.length).every((t) => t.pinned)).toBe(true);
		// Parity with LOCAL MODE: the pinned block lists in the content
		// module's authored order (pinned_rank), exactly as canonTopics()
		// projects it offline — not by created_at, which the fiction never
		// wrote monotonically.
		const fictionOrder = systemById('rusty-diskette')!.sections.flatMap((s) =>
			s.topics.map((t) => t.slug)
		);
		expect(canon.map((t) => t.slug)).toEqual(fictionOrder);
		const halloween = canon.find((t) => t.slug === 'halloween-87');
		expect(halloween?.postCount).toBe(3);
		expect(halloween?.author).toBe('CAPT.VECTOR');
		expect(halloween?.section).toBe('general');
	});

	it('serves canon post bodies with their markup intact', async () => {
		const topics = await listTopics(env.DIALER_DB, 'rusty-diskette');
		const grapevine = topics.find((t) => t.slug === 'night-circuit');
		expect(grapevine).toBeDefined();
		const posts = await listPosts(env.DIALER_DB, 'rusty-diskette', grapevine!.id);
		expect(posts?.[0].canon).toBe(true);
		expect(posts?.[0].body).toContain('{*W}555-8008{/}'); // breadcrumb #1, colored
	});

	it('replying to a canon topic threads under it and bumps its activity', async () => {
		const handle = await caller('THREADER');
		const before = await listTopics(env.DIALER_DB, 'rusty-diskette');
		const halloween = before.find((t) => t.slug === 'halloween-87')!;

		const reply = await createPost(
			env.DIALER_DB,
			'rusty-diskette',
			halloween.id,
			handle,
			'the monitor graveyard needs flicker. leave one CRT plugged in.',
			NOW
		);
		expect(reply.ok).toBe(true);

		const posts = await listPosts(env.DIALER_DB, 'rusty-diskette', halloween.id);
		expect(posts?.at(-1)?.author).toBe('THREADER');
		expect(posts?.at(-1)?.canon).toBe(false);

		const after = await listTopics(env.DIALER_DB, 'rusty-diskette');
		const bumped = after.find((t) => t.slug === 'halloween-87')!;
		expect(bumped.postCount).toBe(halloween.postCount + 1);
		expect(bumped.lastPostAt).toBeGreaterThan(halloween.lastPostAt);
		expect(bumped.pinned).toBe(true); // still pinned, still first block
	});
});

describe('community topics', () => {
	it('creates a topic with its first post and lists it after the canon block', async () => {
		const handle = await caller('FOUNDER');
		const created = await createTopic(
			env.DIALER_DB,
			'foundry',
			handle,
			{ section: 'the-floor', title: 'ANYONE ELSE ON THIRD SHIFT?', body: 'just me and the hum.' },
			NOW
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const topics = await listTopics(env.DIALER_DB, 'foundry');
		const mine = topics.find((t) => t.id === created.topicId);
		expect(mine).toMatchObject({
			slug: null,
			section: 'the-floor',
			title: 'ANYONE ELSE ON THIRD SHIFT?',
			author: 'FOUNDER',
			postCount: 1,
			canon: false,
			pinned: false
		});

		const posts = await listPosts(env.DIALER_DB, 'foundry', created.topicId);
		expect(posts).toHaveLength(1);
		expect(posts?.[0].body).toBe('just me and the hum.');
	});

	it('orders community topics by latest activity', async () => {
		const a = await caller('EARLY.BIRD');
		const b = await caller('NIGHT.OWL');
		const first = await createTopic(
			env.DIALER_DB,
			'night-circuit',
			a,
			{ section: 'late-shift', title: 'QUIET NIGHT', body: 'anyone up?' },
			NOW
		);
		const second = await createTopic(
			env.DIALER_DB,
			'night-circuit',
			b,
			{ section: 'late-shift', title: 'LOUDER NIGHT', body: 'always.' },
			later(120)
		);
		if (!first.ok || !second.ok) throw new Error('setup failed');

		// A reply to the older topic moves it back on top.
		const replied = await createPost(
			env.DIALER_DB,
			'night-circuit',
			first.topicId,
			b,
			'up. always up.',
			later(300)
		);
		expect(replied.ok).toBe(true);

		const topics = await listTopics(env.DIALER_DB, 'night-circuit');
		const ids = topics.map((t) => t.id);
		expect(ids.indexOf(first.topicId)).toBeLessThan(ids.indexOf(second.topicId));
	});

	it('validates section, title, and body', async () => {
		const handle = await caller('SLOPPY');
		const db = env.DIALER_DB;
		const bad = (section: string, title: string, body: string): ReturnType<typeof createTopic> =>
			createTopic(db, 'foundry', handle, { section, title, body }, NOW);

		expect(await bad('no-such-section', 'FINE TITLE', 'fine body')).toEqual({
			ok: false,
			reason: 'invalid-section'
		});
		expect(await bad('demo-den', 'X', 'fine body')).toEqual({
			ok: false,
			reason: 'invalid-title'
		});
		expect(await bad('demo-den', 'T'.repeat(41), 'fine body')).toEqual({
			ok: false,
			reason: 'invalid-title'
		});
		expect(await bad('demo-den', 'FINE TITLE', '   ')).toEqual({
			ok: false,
			reason: 'invalid-body'
		});
		expect(await bad('demo-den', 'FINE TITLE', 'x'.repeat(BODY_MAX_CHARS + 1))).toEqual({
			ok: false,
			reason: 'invalid-body'
		});
	});

	it('normalizes CRLF and strips control characters from bodies', async () => {
		const handle = await caller('TIDY');
		const created = await createTopic(
			env.DIALER_DB,
			'foundry',
			handle,
			{
				section: 'demo-den',
				title: 'LINE ENDINGS',
				body: 'one\r\ntwo\rthree\ttabbed\u0007bell'
			},
			NOW
		);
		if (!created.ok) throw new Error('setup failed');
		const posts = await listPosts(env.DIALER_DB, 'foundry', created.topicId);
		expect(posts?.[0].body).toBe('one\ntwo\nthree tabbedbell');
	});

	it('refuses replies to topics that are not on the named board', async () => {
		const handle = await caller('LOST');
		const topics = await listTopics(env.DIALER_DB, 'rusty-diskette');
		const result = await createPost(
			env.DIALER_DB,
			'foundry',
			topics[0].id,
			handle,
			'wrong number',
			NOW
		);
		expect(result).toEqual({ ok: false, reason: 'no-topic' });
		expect(await createPost(env.DIALER_DB, 'foundry', 999999, handle, 'void', NOW)).toEqual({
			ok: false,
			reason: 'no-topic'
		});
	});
});

describe('the one-post-a-minute cooldown', () => {
	it('applies across topic creation and replies alike', async () => {
		const handle = await caller('RAPIDFIRE');
		const first = await createTopic(
			env.DIALER_DB,
			'foundry',
			handle,
			{ section: 'old-iron', title: 'FIRST OF TWO', body: 'one' },
			NOW
		);
		expect(first.ok).toBe(true);
		if (!first.ok) return;

		// Ten seconds later, both write paths refuse.
		expect(
			await createPost(env.DIALER_DB, 'foundry', first.topicId, handle, 'two', later(10))
		).toEqual({ ok: false, reason: 'cooldown' });
		expect(
			await createTopic(
				env.DIALER_DB,
				'foundry',
				handle,
				{ section: 'old-iron', title: 'TOO SOON', body: 'two' },
				later(10)
			)
		).toEqual({ ok: false, reason: 'cooldown' });

		// The minute passes; posting works again.
		const again = await createPost(
			env.DIALER_DB,
			'foundry',
			first.topicId,
			handle,
			'two, patiently',
			later(POST_COOLDOWN_S + 1)
		);
		expect(again.ok).toBe(true);
	});

	it('a refused post burns nothing — the original slot still stands', async () => {
		const handle = await caller('PATIENT');
		const first = await createTopic(
			env.DIALER_DB,
			'foundry',
			handle,
			{ section: 'old-iron', title: 'SLOT MATH', body: 'one' },
			NOW
		);
		if (!first.ok) throw new Error('setup failed');
		await createPost(env.DIALER_DB, 'foundry', first.topicId, handle, 'refused', later(30));
		// 61s after the FIRST post (not the refused one) the slot is free.
		const again = await createPost(
			env.DIALER_DB,
			'foundry',
			first.topicId,
			handle,
			'made it',
			later(POST_COOLDOWN_S + 1)
		);
		expect(again.ok).toBe(true);
	});

	it('canon handles can never claim a posting slot', async () => {
		const topics = await listTopics(env.DIALER_DB, 'rusty-diskette');
		const result = await createPost(
			env.DIALER_DB,
			'rusty-diskette',
			topics[0].id,
			'CAPT.VECTOR',
			'the fiction does not post through the API',
			NOW
		);
		expect(result).toEqual({ ok: false, reason: 'cooldown' });
	});
});

describe('moderation visibility', () => {
	it('flagged and deleted posts vanish from threads and counts', async () => {
		const handle = await caller('MODERATED');
		const created = await createTopic(
			env.DIALER_DB,
			'foundry',
			handle,
			{ section: 'demo-den', title: 'SOON GONE', body: 'the only post' },
			NOW
		);
		if (!created.ok) throw new Error('setup failed');

		await env.DIALER_DB.prepare('UPDATE posts SET flagged = 1 WHERE id = ?1')
			.bind(created.postId)
			.run();

		const posts = await listPosts(env.DIALER_DB, 'foundry', created.topicId);
		expect(posts).toEqual([]);
		// A community topic with no visible posts disappears with them.
		const topics = await listTopics(env.DIALER_DB, 'foundry');
		expect(topics.find((t) => t.id === created.topicId)).toBeUndefined();
	});
});
