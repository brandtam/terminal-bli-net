/// <reference types="@cloudflare/workers-types" />
/**
 * Nightly Dialer sweep (architecture item 6) — dispatched from
 * src/worker/cron.ts at 05:00 UTC. Every step is idempotent and individually
 * try/caught so one failure never starves the rest.
 *
 * PR 1 ships steps 4-5. The moderation steps land with the app:
 *   1. LLM re-audit of the day's content (skip when the seam is down)
 *   2. hard-delete flagged/soft-deleted rows (R2 object first, then row, then
 *      orphan sweep)
 *   3. per-board canon-voiced sysop cleanup post when anything was deleted
 *   6. trim scores to the top 10 per board
 */
import { epochSeconds } from './auth';
import type { DialerEnv } from './env';

export async function dialerNightly(env: Pick<DialerEnv, 'DIALER_DB'>): Promise<void> {
	const db = env.DIALER_DB;

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
		await db
			.prepare('DELETE FROM sessions WHERE expires_at <= ?1')
			.bind(epochSeconds(new Date()))
			.run();
	} catch (err) {
		console.error('[dialer cron] session prune failed', err);
	}
}
