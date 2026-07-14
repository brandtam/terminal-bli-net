import { env } from './env';
import { describe, it, expect } from 'vitest';
import { registerCaller, epochSeconds } from '../auth';
import { mintSession } from '../session';
import { dialerNightly } from '../cron';

const NOW = new Date('2026-07-12T12:00:00Z');

// Storage is shared across tests in this file (the current pool version has
// no per-test isolation), so every test registers its own unique handle.

describe('dialerNightly', () => {
	it('resets the daily budgets', async () => {
		await registerCaller(env.DIALER_DB, 'BUDGETEER', 'correct-horse', null, NOW);
		await env.DIALER_DB.prepare(
			'UPDATE callers SET minutes_today = 45, uploads_today = 3 WHERE handle = ?1'
		)
			.bind('BUDGETEER')
			.run();

		await dialerNightly({ DIALER_DB: env.DIALER_DB, DIALER_FILES: env.DIALER_FILES });

		const row = await env.DIALER_DB.prepare(
			'SELECT minutes_today, uploads_today, ratio_credits FROM callers WHERE handle = ?1'
		)
			.bind('BUDGETEER')
			.first<{ minutes_today: number; uploads_today: number; ratio_credits: number }>();
		expect(row?.minutes_today).toBe(0);
		expect(row?.uploads_today).toBe(0);
		// Ratio credits are an economy, not a daily budget — never reset.
		expect(row?.ratio_credits).toBe(3);
	});

	it('prunes expired sessions and keeps live ones', async () => {
		await registerCaller(env.DIALER_DB, 'PRUNED', 'correct-horse', null, NOW);
		const live = await mintSession(env.DIALER_DB, 'PRUNED', new Date());
		await env.DIALER_DB.prepare(
			'INSERT INTO sessions (token_hash, handle, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)'
		)
			.bind('stale-hash', 'PRUNED', epochSeconds(NOW) - 100, epochSeconds(new Date()) - 1)
			.run();

		await dialerNightly({ DIALER_DB: env.DIALER_DB, DIALER_FILES: env.DIALER_FILES });

		const rows = await env.DIALER_DB.prepare('SELECT token_hash FROM sessions WHERE handle = ?1')
			.bind('PRUNED')
			.all<{ token_hash: string }>();
		expect(rows.results.map((r) => r.token_hash)).not.toContain('stale-hash');
		expect(rows.results).toHaveLength(1);
		void live;
	});

	it('is idempotent', async () => {
		await registerCaller(env.DIALER_DB, 'REPEATER', 'correct-horse', null, NOW);
		await dialerNightly({ DIALER_DB: env.DIALER_DB, DIALER_FILES: env.DIALER_FILES });
		await dialerNightly({ DIALER_DB: env.DIALER_DB, DIALER_FILES: env.DIALER_FILES });
		const row = await env.DIALER_DB.prepare('SELECT minutes_today FROM callers WHERE handle = ?1')
			.bind('REPEATER')
			.first<{ minutes_today: number }>();
		expect(row?.minutes_today).toBe(0);
	});
});
