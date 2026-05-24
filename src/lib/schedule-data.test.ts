import { describe, it, expect } from 'vitest';
import { validateOverlapInvariant } from './schedule';
import type { GroupMeta } from './types';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

function loadAllGroups(): GroupMeta[] {
	const botsDir = resolve(process.cwd(), 'bots');
	const dirs = readdirSync(botsDir).filter((d) => statSync(join(botsDir, d)).isDirectory());
	return dirs.map((d) => JSON.parse(readFileSync(join(botsDir, d, '_meta.json'), 'utf-8')));
}

describe('schedule overlap invariant (live data)', () => {
	it('all 6 groups are active', () => {
		const groups = loadAllGroups();
		expect(groups).toHaveLength(6);
		expect(groups.every((g) => g.active)).toBe(true);
	});

	it('at least one show is on-air at every hour of the week', () => {
		const groups = loadAllGroups();
		const result = validateOverlapInvariant(groups);
		if (!result.valid) {
			console.error(
				'Schedule gaps:',
				result.gaps.map((g) => `${g.day} ${g.hour}:00`)
			);
		}
		expect(result.valid).toBe(true);
		expect(result.gaps).toHaveLength(0);
	});

	it('each group has at least 3 schedule slots', () => {
		const groups = loadAllGroups();
		for (const g of groups) {
			expect(g.schedule.length).toBeGreaterThanOrEqual(3);
		}
	});
});
