/// <reference types="@cloudflare/workers-types" />
/**
 * The Autodialer's one-block-a-day gate (PRD: "one sweep block/day ... THE
 * PHONE COMPANY NOTICES"). The sweep itself is pure client theater — this
 * just stamps callers.last_sweep_at atomically so redials, reloads, and
 * parallel tabs can't mint a second block before the day rolls over.
 *
 * "Day" matches the nightly cron's clock: it rolls at 05:00 UTC (midnight
 * Eastern, the fiction's timezone), same moment the budgets reset.
 */
import { epochSeconds } from './auth';

const DAY_S = 24 * 60 * 60;
const ROLLOVER_UTC_HOUR = 5;

/** Epoch seconds of the most recent 05:00 UTC — the current fiction-day's start. */
export function sweepDayStart(now: Date): number {
	const nowS = epochSeconds(now);
	const utcMidnight = nowS - (nowS % DAY_S);
	const rollover = utcMidnight + ROLLOVER_UTC_HOUR * 3600;
	return nowS >= rollover ? rollover : rollover - DAY_S;
}

/** Claim today's sweep block. False = already swept tonight. */
export async function claimDailySweep(db: D1Database, handle: string, now: Date): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE callers SET last_sweep_at = ?2
			 WHERE handle = ?1 AND is_canon = 0
			   AND (last_sweep_at IS NULL OR last_sweep_at < ?3)`
		)
		.bind(handle, epochSeconds(now), sweepDayStart(now))
		.run();
	return result.meta.changes === 1;
}
