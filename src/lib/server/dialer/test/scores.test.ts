import { env } from './env';
import { describe, it, expect } from 'vitest';
import { registerCaller } from '../auth';
import { listScores, submitScore, SCORES_KEPT } from '../scores';
import { claimDailySweep, sweepDayStart } from '../sweep';
import { dialerNightly } from '../cron';

const NOW = new Date('2026-07-12T12:00:00Z');

// Storage is shared across tests (no pool isolation): unique handles, and the
// score tests use per-test board names — the scores table has no FK on board.

async function caller(handle: string): Promise<string> {
	const result = await registerCaller(env.DIALER_DB, handle, 'password', null, NOW);
	if (!result.ok) throw new Error(`test caller ${handle} not registered`);
	return result.handle;
}

describe('door-game scores', () => {
	it('lists each handle once, best run first', async () => {
		const a = await caller('DOOR-A');
		const b = await caller('DOOR-B');
		await submitScore(env.DIALER_DB, 'score-board-1', a, 616, NOW);
		await submitScore(env.DIALER_DB, 'score-board-1', a, 400, NOW);
		await submitScore(env.DIALER_DB, 'score-board-1', b, 500, NOW);

		const scores = await listScores(env.DIALER_DB, 'score-board-1');
		expect(scores.map((s) => [s.handle, s.score])).toEqual([
			['DOOR-A', 616],
			['DOOR-B', 500]
		]);
	});

	it('refuses scores outside the believable range', async () => {
		const handle = await caller('DOOR-CHEAT');
		expect(await submitScore(env.DIALER_DB, 'score-board-2', handle, 0, NOW)).toEqual({
			ok: false,
			reason: 'invalid-score'
		});
		expect(await submitScore(env.DIALER_DB, 'score-board-2', handle, 1e9, NOW)).toEqual({
			ok: false,
			reason: 'invalid-score'
		});
		expect(await submitScore(env.DIALER_DB, 'score-board-2', handle, 6.16, NOW)).toEqual({
			ok: false,
			reason: 'invalid-score'
		});
	});

	it('the nightly sweep trims each board to the top rows', async () => {
		const handle = await caller('DOOR-FLOOD');
		for (let i = 1; i <= SCORES_KEPT + 5; i++) {
			await submitScore(env.DIALER_DB, 'score-board-3', handle, 100 + i, NOW);
		}
		await dialerNightly({ DIALER_DB: env.DIALER_DB, DIALER_FILES: env.DIALER_FILES });

		const rows = await env.DIALER_DB.prepare(
			'SELECT score FROM scores WHERE board = ?1 ORDER BY score DESC'
		)
			.bind('score-board-3')
			.all<{ score: number }>();
		expect(rows.results).toHaveLength(SCORES_KEPT);
		expect(rows.results[0].score).toBe(100 + SCORES_KEPT + 5);
	});
});

describe('the autodialer sweep claim', () => {
	it('grants one block a night, atomically', async () => {
		const handle = await caller('SWEEPER-1');
		expect(await claimDailySweep(env.DIALER_DB, handle, NOW)).toBe(true);
		expect(await claimDailySweep(env.DIALER_DB, handle, NOW)).toBe(false);
	});

	it('rolls over at 05:00 UTC, the same clock as the nightly cron', () => {
		const before = new Date('2026-07-12T04:59:00Z');
		const after = new Date('2026-07-12T05:01:00Z');
		expect(sweepDayStart(after)).toBe(Date.UTC(2026, 6, 12, 5) / 1000);
		expect(sweepDayStart(before)).toBe(Date.UTC(2026, 6, 11, 5) / 1000);
	});

	it('a new fiction-day reopens the block', async () => {
		const handle = await caller('SWEEPER-2');
		const lastNight = new Date('2026-07-11T23:00:00Z');
		expect(await claimDailySweep(env.DIALER_DB, handle, lastNight)).toBe(true);
		// 05:00 UTC passed between the two calls.
		expect(await claimDailySweep(env.DIALER_DB, handle, NOW)).toBe(true);
	});
});
