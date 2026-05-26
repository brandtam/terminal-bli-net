import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

interface Episode {
	season: number;
	episode: number;
	title: string;
	year: string;
	premise: string;
}

interface Meta {
	slug: string;
	name: string;
	episodes: Episode[];
}

function loadAllMetas(): Meta[] {
	const botsDir = resolve(process.cwd(), 'bots'); // eslint-disable-line no-undef
	const dirs = readdirSync(botsDir).filter((d) => statSync(join(botsDir, d)).isDirectory());
	return dirs.map((d) => JSON.parse(readFileSync(join(botsDir, d, '_meta.json'), 'utf-8')));
}

describe('episode catalog validation', () => {
	const metas = loadAllMetas();

	it('every show has a non-empty episodes array', () => {
		for (const meta of metas) {
			expect(meta.episodes, `${meta.slug} missing episodes`).toBeDefined();
			expect(Array.isArray(meta.episodes), `${meta.slug} episodes is not an array`).toBe(true);
			expect(meta.episodes.length, `${meta.slug} has no episodes`).toBeGreaterThan(0);
		}
	});

	it('every episode has all required fields', () => {
		for (const meta of metas) {
			for (const ep of meta.episodes) {
				expect(ep).toHaveProperty('season');
				expect(ep).toHaveProperty('episode');
				expect(ep).toHaveProperty('title');
				expect(ep).toHaveProperty('year');
				expect(ep).toHaveProperty('premise');
			}
		}
	});

	it('season and episode are positive integers', () => {
		for (const meta of metas) {
			for (const ep of meta.episodes) {
				expect(
					Number.isInteger(ep.season),
					`${meta.slug} "${ep.title}" season is not integer`
				).toBe(true);
				expect(ep.season, `${meta.slug} "${ep.title}" season <= 0`).toBeGreaterThan(0);
				expect(
					Number.isInteger(ep.episode),
					`${meta.slug} "${ep.title}" episode is not integer`
				).toBe(true);
				expect(ep.episode, `${meta.slug} "${ep.title}" episode <= 0`).toBeGreaterThan(0);
			}
		}
	});

	it('premise is at least 20 characters', () => {
		for (const meta of metas) {
			for (const ep of meta.episodes) {
				expect(
					ep.premise.length,
					`${meta.slug} "${ep.title}" premise too short (${ep.premise.length} chars)`
				).toBeGreaterThanOrEqual(20);
			}
		}
	});
});
