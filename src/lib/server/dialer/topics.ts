/// <reference types="@cloudflare/workers-types" />
/**
 * Message boards — the D1 store behind /api/dialer/boards/[board]/topics*.
 * Canon rows (seeded by the content migrations, `canon=1 pinned=1`) and real
 * callers' rows live in the same tables and come back through the same
 * queries; the only write paths are createTopic/createPost, so seeded canon
 * content is immutable by construction. Kit-free, like auth.ts — routes stay
 * thin.
 *
 * Rate limit (PRD "rate limits as fiction"): one post a minute per handle,
 * enforced as an atomic claim on callers.last_post_at so concurrent requests
 * can't both win.
 */
import { epochSeconds } from './auth';
import { BOARD_SECTIONS, type PublicBoard } from './boards';

export const TITLE_MIN_CHARS = 2;
export const TITLE_MAX_CHARS = 40;
export const BODY_MAX_CHARS = 4000;
export const POST_COOLDOWN_S = 60;

export interface TopicSummary {
	id: number;
	slug: string | null;
	section: string;
	title: string;
	author: string;
	createdAt: number;
	postCount: number;
	lastPostAt: number;
	canon: boolean;
	pinned: boolean;
}

export interface PostView {
	id: number;
	author: string;
	body: string;
	createdAt: number;
	canon: boolean;
}

export type WriteFailure = 'invalid-section' | 'invalid-title' | 'invalid-body' | 'cooldown';
export type CreateTopicResult =
	| { ok: true; topicId: number; postId: number }
	| { ok: false; reason: WriteFailure };
export type CreatePostResult =
	| { ok: true; postId: number }
	| { ok: false; reason: WriteFailure | 'no-topic' };

/**
 * Topics on a board: pinned canon first in fiction order, then community
 * topics by latest activity. A community topic whose every post has been
 * moderated away disappears with them; canon topics always list.
 */
export async function listTopics(db: D1Database, board: PublicBoard): Promise<TopicSummary[]> {
	const rows = await db
		.prepare(
			`SELECT t.id, t.slug, t.section, t.title, t.author, t.created_at,
			        COUNT(p.id) AS post_count,
			        COALESCE(MAX(p.created_at), t.created_at) AS last_post_at,
			        t.canon, t.pinned
			 FROM topics t
			 LEFT JOIN posts p ON p.topic_id = t.id AND p.deleted_at IS NULL AND p.flagged = 0
			 WHERE t.board = ?1
			 GROUP BY t.id
			 HAVING t.canon = 1 OR COUNT(p.id) > 0
			 ORDER BY t.pinned DESC,
			          CASE WHEN t.pinned = 1 THEN t.pinned_rank END ASC,
			          last_post_at DESC`
		)
		.bind(board)
		.all<{
			id: number;
			slug: string | null;
			section: string;
			title: string;
			author: string;
			created_at: number;
			post_count: number;
			last_post_at: number;
			canon: number;
			pinned: number;
		}>();

	return rows.results.map((r) => ({
		id: r.id,
		slug: r.slug,
		section: r.section,
		title: r.title,
		author: r.author,
		createdAt: r.created_at,
		postCount: r.post_count,
		lastPostAt: r.last_post_at,
		canon: r.canon === 1,
		pinned: r.pinned === 1
	}));
}

/** A topic's readable posts in thread order, or null if the topic isn't on this board. */
export async function listPosts(
	db: D1Database,
	board: PublicBoard,
	topicId: number
): Promise<PostView[] | null> {
	const topic = await db
		.prepare('SELECT id FROM topics WHERE id = ?1 AND board = ?2')
		.bind(topicId, board)
		.first();
	if (!topic) return null;

	const rows = await db
		.prepare(
			`SELECT id, author, body, created_at, canon FROM posts
			 WHERE topic_id = ?1 AND deleted_at IS NULL AND flagged = 0
			 ORDER BY created_at ASC, id ASC`
		)
		.bind(topicId)
		.all<{ id: number; author: string; body: string; created_at: number; canon: number }>();

	return rows.results.map((r) => ({
		id: r.id,
		author: r.author,
		body: r.body,
		createdAt: r.created_at,
		canon: r.canon === 1
	}));
}

/**
 * Start a topic with its first post. One transaction — no topic without a
 * post. `hidden` inserts the post flagged (invisible): the route holds every
 * community write behind the moderation verdict and flips it visible on OK —
 * an all-flagged community topic doesn't list, so the topic hides with it.
 */
export async function createTopic(
	db: D1Database,
	board: PublicBoard,
	author: string,
	input: { section: string; title: string; body: string },
	now: Date,
	hidden = false
): Promise<CreateTopicResult> {
	if (!BOARD_SECTIONS[board].includes(input.section)) {
		return { ok: false, reason: 'invalid-section' };
	}
	const title = cleanLine(input.title);
	if (title.length < TITLE_MIN_CHARS || title.length > TITLE_MAX_CHARS) {
		return { ok: false, reason: 'invalid-title' };
	}
	const body = cleanBody(input.body);
	if (!body) return { ok: false, reason: 'invalid-body' };

	const nowS = epochSeconds(now);
	if (!(await claimCooldown(db, author, nowS))) return { ok: false, reason: 'cooldown' };

	const [topicResult, postResult] = await db.batch([
		db
			.prepare(
				'INSERT INTO topics (board, section, title, author, created_at) VALUES (?1, ?2, ?3, ?4, ?5)'
			)
			.bind(board, input.section, title, author, nowS),
		db
			.prepare(
				'INSERT INTO posts (topic_id, author, body, created_at, flagged) VALUES (last_insert_rowid(), ?1, ?2, ?3, ?4)'
			)
			.bind(author, body, nowS, hidden ? 1 : 0)
	]);
	return {
		ok: true,
		topicId: topicResult.meta.last_row_id,
		postId: postResult.meta.last_row_id
	};
}

/** Reply to a topic. Replying to canon topics is the point — threads stay live. */
export async function createPost(
	db: D1Database,
	board: PublicBoard,
	topicId: number,
	author: string,
	rawBody: string,
	now: Date,
	hidden = false
): Promise<CreatePostResult> {
	const body = cleanBody(rawBody);
	if (!body) return { ok: false, reason: 'invalid-body' };

	const topic = await db
		.prepare('SELECT id FROM topics WHERE id = ?1 AND board = ?2')
		.bind(topicId, board)
		.first();
	if (!topic) return { ok: false, reason: 'no-topic' };

	const nowS = epochSeconds(now);
	if (!(await claimCooldown(db, author, nowS))) return { ok: false, reason: 'cooldown' };

	const result = await db
		.prepare(
			'INSERT INTO posts (topic_id, author, body, created_at, flagged) VALUES (?1, ?2, ?3, ?4, ?5)'
		)
		.bind(topicId, author, body, nowS, hidden ? 1 : 0)
		.run();
	return { ok: true, postId: result.meta.last_row_id };
}

/** Make a hidden post visible (moderation cleared it). */
export async function setPostVisible(db: D1Database, postId: number): Promise<void> {
	await db.prepare('UPDATE posts SET flagged = 0 WHERE id = ?1 AND canon = 0').bind(postId).run();
}

/** Soft-delete a post (moderation rejected it); the nightly sweep hard-deletes. */
export async function softDeletePost(db: D1Database, postId: number, now: Date): Promise<void> {
	await db
		.prepare('UPDATE posts SET deleted_at = ?2 WHERE id = ?1 AND canon = 0')
		.bind(postId, epochSeconds(now))
		.run();
}

/**
 * Atomically claim the poster's next posting slot. `changes === 0` means the
 * minute isn't up (or the handle is canon — canon never posts through the
 * API; a session for one can't exist, but the guard costs nothing).
 */
async function claimCooldown(db: D1Database, handle: string, nowS: number): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE callers SET last_post_at = ?2
			 WHERE handle = ?1 AND is_canon = 0
			   AND (last_post_at IS NULL OR last_post_at <= ?2 - ?3)`
		)
		.bind(handle, nowS, POST_COOLDOWN_S)
		.run();
	return result.meta.changes === 1;
}

/** One line of user text: control characters to spaces, whitespace collapsed. */
function cleanLine(raw: string): string {
	return (
		raw
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u001f\u007f]/g, ' ')
			.replace(/ {2,}/g, ' ')
			.trim()
	);
}

/**
 * A post body: newlines normalized and kept, tabs become spaces (the terminal
 * grid has no tab stops), every other control character stripped, trimmed.
 * Empty or oversized bodies come back '' (invalid).
 */
function cleanBody(raw: string): string {
	const body = raw
		.replace(/\r\n?/g, '\n')
		.replace(/\t/g, ' ')
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
		.trim();
	if (body.length === 0 || body.length > BODY_MAX_CHARS) return '';
	return body;
}
