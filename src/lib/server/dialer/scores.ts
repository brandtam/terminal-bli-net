/// <reference types="@cloudflare/workers-types" />
/**
 * Door-game high scores — the table behind /api/dialer/boards/[board]/scores.
 * Per-board top 10, best run per handle (a real door table, not a spam feed);
 * the nightly cron trims the long tail. Scores arrive from the client machine
 * on a win, so the server bounds them to a sane range and otherwise trusts
 * the fiction — it's a three-room dungeon, not a tournament.
 */
import { epochSeconds } from './auth';

export const SCORE_MIN = 1;
export const SCORE_MAX = 32_767;
export const SCORES_KEPT = 10;

export interface ScoreEntry {
	handle: string;
	score: number;
	createdAt: number;
}

export type SubmitScoreResult = { ok: true } | { ok: false; reason: 'invalid-score' };

/** The board's top 10: one entry per handle (their best, earliest run wins ties). */
export async function listScores(db: D1Database, board: string): Promise<ScoreEntry[]> {
	const rows = await db
		.prepare(
			`SELECT handle, MAX(score) AS score, MIN(created_at) AS created_at FROM scores
			 WHERE board = ?1
			 GROUP BY handle
			 ORDER BY score DESC, created_at ASC
			 LIMIT ${SCORES_KEPT}`
		)
		.bind(board)
		.all<{ handle: string; score: number; created_at: number }>();
	return rows.results.map((r) => ({ handle: r.handle, score: r.score, createdAt: r.created_at }));
}

export async function submitScore(
	db: D1Database,
	board: string,
	handle: string,
	score: number,
	now: Date
): Promise<SubmitScoreResult> {
	if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) {
		return { ok: false, reason: 'invalid-score' };
	}
	await db
		.prepare('INSERT INTO scores (board, handle, score, created_at) VALUES (?1, ?2, ?3, ?4)')
		.bind(board, handle, score, epochSeconds(now))
		.run();
	return { ok: true };
}
