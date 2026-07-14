/// <reference types="@cloudflare/workers-types" />
/**
 * Nightly Dialer sweep (architecture item 6) — dispatched from
 * src/worker/cron.ts at 05:00 UTC ("the sysop cleans up overnight"). Every
 * step is idempotent and individually try/caught so one failure never starves
 * the rest.
 *
 *   1. re-audit still-hidden content through the moderation seam (skip the
 *      rest of the batch the moment the seam reports itself down)
 *   2. hard-delete soft-deleted rows — R2 object first, then the D1 row —
 *      then collect R2 orphans
 *   3. post a canon-voiced sysop cleanup note on each board that lost content
 *   4. reset the daily budgets (connect minutes, upload count)
 *   5. prune expired sessions
 *   6. trim door-game scores to the top 10 per board
 *
 * Step 1 resolves every flag it can (visible or soft-deleted); step 2 only
 * ever removes what moderation (or a caller) already condemned — a hidden row
 * the seam couldn't judge stays hidden for tomorrow's sweep, never published,
 * never destroyed (PRD: fail closed, not open).
 */
import { epochSeconds } from './auth';
import { grantUploadCredits, setFileVisible, softDeleteFile } from './files';
import { moderateText } from './moderation';
import { SCORES_KEPT } from './scores';
import type { DialerEnv } from './env';
import type { PublicBoard } from './boards';

/** Cap the nightly LLM bill no matter what got queued while the seam was down. */
const REAUDIT_MAX_ROWS = 200;
/** An R2 object younger than this may be a mid-flight upload, not an orphan. */
const ORPHAN_MIN_AGE_S = 60 * 60;

/** Voice + home section for the nightly sysop note, per board. */
const SYSOP_NOTES: Record<PublicBoard, { sysop: string; section: string; body: string }> = {
	'rusty-diskette': {
		sysop: 'CAPT.VECTOR',
		section: 'general',
		body: 'took out the trash. -- CV'
	},
	'night-circuit': {
		sysop: 'MAINFRAME.MARY',
		section: 'late-shift',
		body: 'Removed some noise from the line. Carry on.'
	},
	foundry: {
		sysop: 'SLAG',
		section: 'the-floor',
		body: 'SWEPT THE FLOOR OVERNIGHT\nWHAT WAS ON IT IS GONE\nKEEP IT CLEAN AND I STAY OUT OF YOUR WAY'
	}
};

type CronEnv = Pick<
	DialerEnv,
	'DIALER_DB' | 'DIALER_FILES' | 'ANTHROPIC_API_KEY' | 'DIALER_MODERATION_MODEL'
>;

export async function dialerNightly(env: CronEnv): Promise<void> {
	const db = env.DIALER_DB;
	const now = new Date();

	// Step 1 — re-audit content still hidden behind flagged=1 (the seam was
	// down when it was written). OK → visible (uploads earn their credits
	// here, exactly once); REJECT → soft-deleted for step 2.
	try {
		await reauditFlagged(env, now);
	} catch (err) {
		console.error('[dialer cron] moderation re-audit failed', err);
	}

	// Step 2 — hard-delete everything soft-deleted, R2 object before D1 row,
	// then collect R2 orphans (upload crashed between put and insert).
	const cleanedBoards = new Set<string>();
	try {
		await hardDelete(env, cleanedBoards);
	} catch (err) {
		console.error('[dialer cron] hard delete failed', err);
	}

	// Step 3 — the sysop mentions the cleanup, in voice, where it happened.
	try {
		await postSysopNotes(db, cleanedBoards, now);
	} catch (err) {
		console.error('[dialer cron] sysop note failed', err);
	}

	// Step 4 — reset the daily budgets (connect minutes, upload count).
	try {
		await db
			.prepare(
				'UPDATE callers SET minutes_today = 0, uploads_today = 0 WHERE minutes_today <> 0 OR uploads_today <> 0'
			)
			.run();
	} catch (err) {
		console.error('[dialer cron] daily budget reset failed', err);
	}

	// Step 5 — prune expired sessions.
	try {
		await db.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(epochSeconds(now)).run();
	} catch (err) {
		console.error('[dialer cron] session prune failed', err);
	}

	// Step 6 — trim door scores to the table the fiction shows.
	try {
		await db
			.prepare(
				`DELETE FROM scores WHERE rowid IN (
				   SELECT rowid FROM (
				     SELECT rowid, ROW_NUMBER() OVER (
				       PARTITION BY board ORDER BY score DESC, created_at ASC
				     ) AS rank FROM scores
				   ) WHERE rank > ${SCORES_KEPT}
				 )`
			)
			.run();
	} catch (err) {
		console.error('[dialer cron] score trim failed', err);
	}
}

async function reauditFlagged(env: CronEnv, now: Date): Promise<void> {
	const db = env.DIALER_DB;

	const posts = await db
		.prepare(
			`SELECT p.id, p.body, t.board FROM posts p JOIN topics t ON t.id = p.topic_id
			 WHERE p.flagged = 1 AND p.canon = 0 AND p.deleted_at IS NULL
			 ORDER BY p.created_at ASC LIMIT ${REAUDIT_MAX_ROWS}`
		)
		.all<{ id: number; body: string; board: string }>();
	const files = await db
		.prepare(
			`SELECT id, name, body_text, uploader FROM files
			 WHERE flagged = 1 AND canon = 0 AND deleted_at IS NULL
			 ORDER BY created_at ASC LIMIT ${REAUDIT_MAX_ROWS}`
		)
		.all<{ id: string; name: string; body_text: string | null; uploader: string }>();

	for (const post of posts.results) {
		const verdict = await moderateText(env, 'BBS post (nightly re-audit)', post.body);
		if (verdict === 'unavailable') return; // seam still down — tomorrow, then
		if (verdict === 'ok') {
			await db.prepare('UPDATE posts SET flagged = 0 WHERE id = ?1').bind(post.id).run();
		} else {
			await db
				.prepare('UPDATE posts SET deleted_at = ?2 WHERE id = ?1')
				.bind(post.id, epochSeconds(now))
				.run();
		}
	}

	for (const file of files.results) {
		// Images re-audit by filename only — pixels are bounded by the dither check.
		const verdict = await moderateText(
			env,
			'BBS file upload (nightly re-audit)',
			`${file.name}\n${file.body_text ?? ''}`
		);
		if (verdict === 'unavailable') return;
		if (verdict === 'ok') {
			await setFileVisible(db, file.id);
			await grantUploadCredits(db, file.uploader);
		} else {
			await softDeleteFile(db, file.id, now);
		}
	}
}

async function hardDelete(env: CronEnv, cleanedBoards: Set<string>): Promise<void> {
	const db = env.DIALER_DB;

	// Files: R2 object first, then the row — a crash leaves an orphan object
	// for the sweep below, never a dangling D1 pointer.
	const deadFiles = await db
		.prepare('SELECT id, board, r2_key FROM files WHERE deleted_at IS NOT NULL AND canon = 0')
		.all<{ id: string; board: string; r2_key: string | null }>();
	for (const file of deadFiles.results) {
		if (file.r2_key) await env.DIALER_FILES.delete(file.r2_key);
		await db.prepare('DELETE FROM files WHERE id = ?1').bind(file.id).run();
		cleanedBoards.add(file.board);
	}

	// Posts, then topics a deletion left empty (community topics only — a
	// canon topic lists even at zero posts and is never deleted).
	const deadPostBoards = await db
		.prepare(
			`SELECT DISTINCT t.board FROM posts p JOIN topics t ON t.id = p.topic_id
			 WHERE p.deleted_at IS NOT NULL AND p.canon = 0`
		)
		.all<{ board: string }>();
	for (const row of deadPostBoards.results) cleanedBoards.add(row.board);
	await db.prepare('DELETE FROM posts WHERE deleted_at IS NOT NULL AND canon = 0').run();
	await db
		.prepare(
			`DELETE FROM topics WHERE canon = 0
			 AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.topic_id = topics.id)`
		)
		.run();

	// Orphan sweep: R2 objects no files row points at. Skip anything fresh —
	// it may be an upload that hasn't reached its D1 insert yet.
	const cutoff = Date.now() - ORPHAN_MIN_AGE_S * 1000;
	let cursor: string | undefined;
	do {
		const listing: R2Objects = await env.DIALER_FILES.list({ cursor });
		for (const object of listing.objects) {
			if (object.uploaded.getTime() > cutoff) continue;
			const row = await db
				.prepare('SELECT 1 FROM files WHERE r2_key = ?1')
				.bind(object.key)
				.first();
			if (!row) await env.DIALER_FILES.delete(object.key);
		}
		cursor = listing.truncated ? listing.cursor : undefined;
	} while (cursor);
}

async function postSysopNotes(
	db: D1Database,
	cleanedBoards: Set<string>,
	now: Date
): Promise<void> {
	const nowS = epochSeconds(now);
	for (const board of cleanedBoards) {
		const note = SYSOP_NOTES[board as PublicBoard];
		if (!note) continue;
		// The housekeeping topic is canon-authored but unpinned; first cleanup
		// creates it, later ones thread under it.
		await db
			.prepare(
				`INSERT INTO topics (board, section, slug, title, author, created_at, canon, pinned)
				 SELECT ?1, ?2, 'housekeeping', 'HOUSEKEEPING', ?3, ?4, 1, 0
				 WHERE NOT EXISTS (SELECT 1 FROM topics WHERE board = ?1 AND slug = 'housekeeping')`
			)
			.bind(board, note.section, note.sysop, nowS)
			.run();
		await db
			.prepare(
				`INSERT INTO posts (topic_id, author, body, created_at, canon)
				 SELECT id, ?2, ?3, ?4, 1 FROM topics WHERE board = ?1 AND slug = 'housekeeping'`
			)
			.bind(board, note.sysop, note.body, nowS)
			.run();
	}
}
