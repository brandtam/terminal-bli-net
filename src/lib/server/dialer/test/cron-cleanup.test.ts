import { env } from './env';
import { describe, it, expect } from 'vitest';
import { registerCaller } from '../auth';
import { createTopic, listTopics, setPostVisible, softDeletePost } from '../topics';
import { setFileVisible, softDeleteFile, uploadTextFile } from '../files';
import { dialerNightly } from '../cron';

const NOW = new Date('2026-07-12T12:00:00Z');
const CRON_ENV = { DIALER_DB: env.DIALER_DB, DIALER_FILES: env.DIALER_FILES };

// No DIALER_MODERATION=live in the test env, so the re-audit step is skipped
// and flagged rows stay put — which is itself the behavior these tests pin
// (held content waits for a live flip, never publishes or dies unjudged).
// Hard delete and the sysop note need no LLM.

async function caller(handle: string): Promise<string> {
	const result = await registerCaller(env.DIALER_DB, handle, 'password', null, NOW);
	if (!result.ok) throw new Error(`test caller ${handle} not registered`);
	return result.handle;
}

describe('nightly hard delete', () => {
	it('removes soft-deleted posts, their empty topics, and posts the sysop note', async () => {
		const handle = await caller('CONDEMNED');
		const topic = await createTopic(
			env.DIALER_DB,
			'night-circuit',
			handle,
			{ section: 'late-shift', title: 'GOING AWAY', body: 'this one gets removed tonight' },
			NOW
		);
		if (!topic.ok) throw new Error('topic not created');
		await softDeletePost(env.DIALER_DB, topic.postId, NOW);

		await dialerNightly(CRON_ENV);

		const posts = await env.DIALER_DB.prepare('SELECT id FROM posts WHERE id = ?1')
			.bind(topic.postId)
			.first();
		expect(posts).toBeNull();
		const topics = await env.DIALER_DB.prepare('SELECT id FROM topics WHERE id = ?1')
			.bind(topic.topicId)
			.first();
		expect(topics).toBeNull();

		// The sysop mentioned it, in voice, in the housekeeping topic.
		const listed = await listTopics(env.DIALER_DB, 'night-circuit');
		const housekeeping = listed.find((t) => t.slug === 'housekeeping');
		expect(housekeeping?.author).toBe('MAINFRAME.MARY');
		expect(housekeeping?.canon).toBe(true);
	});

	it('deletes a soft-deleted file R2-first and collects nothing that is still live', async () => {
		const handle = await caller('FILEDOOM');
		const upload = await uploadTextFile(
			env.DIALER_DB,
			'foundry',
			handle,
			{ name: 'DOOMED.TXT', kind: 'txt', body: 'gone by morning' },
			NOW
		);
		if (!upload.ok) throw new Error('upload failed');
		await setFileVisible(env.DIALER_DB, upload.id);
		await softDeleteFile(env.DIALER_DB, upload.id, NOW);

		// A live R2 object with a matching row must survive the orphan sweep.
		const keeper = await uploadTextFile(
			env.DIALER_DB,
			'foundry',
			handle,
			{ name: 'KEEPER.TXT', kind: 'txt', body: 'still here' },
			NOW
		);
		if (!keeper.ok) throw new Error('keeper upload failed');
		await setFileVisible(env.DIALER_DB, keeper.id);

		await dialerNightly(CRON_ENV);

		expect(
			await env.DIALER_DB.prepare('SELECT id FROM files WHERE id = ?1').bind(upload.id).first()
		).toBeNull();
		expect(
			await env.DIALER_DB.prepare('SELECT id FROM files WHERE id = ?1').bind(keeper.id).first()
		).not.toBeNull();
	});

	it('leaves seam-down flagged posts hidden but intact (fail closed, not deleted)', async () => {
		const handle = await caller('HELDPOST');
		const topic = await createTopic(
			env.DIALER_DB,
			'foundry',
			handle,
			{ section: 'the-floor', title: 'HELD FOR REVIEW', body: 'the seam was down for this one' },
			NOW,
			true // hidden — exactly what the route does when moderation is unavailable
		);
		if (!topic.ok) throw new Error('topic not created');

		await dialerNightly(CRON_ENV);

		const row = await env.DIALER_DB.prepare('SELECT flagged, deleted_at FROM posts WHERE id = ?1')
			.bind(topic.postId)
			.first<{ flagged: number; deleted_at: number | null }>();
		expect(row?.flagged).toBe(1);
		expect(row?.deleted_at).toBeNull();

		// Still invisible to readers.
		const listed = await listTopics(env.DIALER_DB, 'foundry');
		expect(listed.find((t) => t.id === topic.topicId)).toBeUndefined();
	});
});

describe('hidden writes (flag-on-write)', () => {
	it('a hidden post lists only after moderation clears it', async () => {
		const handle = await caller('CLEARED');
		const topic = await createTopic(
			env.DIALER_DB,
			'foundry',
			handle,
			{ section: 'demo-den', title: 'WAITING ROOM', body: 'hold me until the verdict' },
			NOW,
			true
		);
		if (!topic.ok) throw new Error('topic not created');

		let listed = await listTopics(env.DIALER_DB, 'foundry');
		expect(listed.find((t) => t.id === topic.topicId)).toBeUndefined();

		await setPostVisible(env.DIALER_DB, topic.postId);
		listed = await listTopics(env.DIALER_DB, 'foundry');
		expect(listed.find((t) => t.id === topic.topicId)?.title).toBe('WAITING ROOM');
	});
});
