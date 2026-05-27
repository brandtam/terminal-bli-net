import { describe, it, expect } from 'vitest';
import { APPS, APP_BY_ID, CATEGORIES, CAT_COLORS, shelfLineup } from './store-data';
import { APP_LIBRARY } from '$lib/terminalos/apps/app-library';

describe('store catalog', () => {
	it('has 11 apps', () => {
		expect(APPS).toHaveLength(11);
	});

	it('every app has required fields', () => {
		for (const app of APPS) {
			expect(app.id).toBeTruthy();
			expect(app.cat).toMatch(/^(GAMES|PROD|ENT)$/);
			expect(app.title).toBeTruthy();
			expect(app.pub).toBeTruthy();
			expect(app.tagline).toBeTruthy();
			expect(app.icon).toBeTruthy();
			expect(app.back).toBeTruthy();
			expect(app.inside.length).toBeGreaterThan(0);
			expect(app.reqs).toBeTruthy();
		}
	});

	it('APP_BY_ID has an entry for every app', () => {
		for (const app of APPS) {
			expect(APP_BY_ID[app.id]).toBe(app);
		}
	});

	it('every store app ID has a matching AppLibrary entry', () => {
		const libraryIds = new Set(APP_LIBRARY.map((a) => a.id));
		for (const app of APPS) {
			expect(libraryIds.has(app.id)).toBe(true);
		}
	});

	it('no system apps appear in the store catalog', () => {
		const systemIds = APP_LIBRARY.filter((a) => a.visibility === 'system').map((a) => a.id);
		const storeIds = new Set(APPS.map((a) => a.id));
		for (const id of systemIds) {
			expect(storeIds.has(id)).toBe(false);
		}
	});
});

describe('categories', () => {
	it('has three categories', () => {
		expect(Object.keys(CATEGORIES)).toHaveLength(3);
		expect(CATEGORIES.games).toBeDefined();
		expect(CATEGORIES.business).toBeDefined();
		expect(CATEGORIES.ent).toBeDefined();
	});

	it('every category app ID exists in the APPS array', () => {
		const appIds = new Set(APPS.map((a) => a.id));
		for (const cat of Object.values(CATEGORIES)) {
			for (const id of cat.appIds) {
				expect(appIds.has(id)).toBe(true);
			}
		}
	});

	it('every app belongs to exactly one category', () => {
		const allCatAppIds = Object.values(CATEGORIES).flatMap((c) => c.appIds);
		const storeAppIds = APPS.map((a) => a.id);
		for (const id of storeAppIds) {
			const count = allCatAppIds.filter((x) => x === id).length;
			expect(count).toBe(1);
		}
	});

	it('CAT_COLORS has entries matching app cat values', () => {
		const cats = new Set(APPS.map((a) => a.cat));
		for (const cat of cats) {
			expect(CAT_COLORS[cat]).toBeDefined();
			expect(CAT_COLORS[cat].band).toBeTruthy();
			expect(CAT_COLORS[cat].splash).toBeTruthy();
			expect(CAT_COLORS[cat].trim).toBeTruthy();
		}
	});
});

describe('shelfLineup', () => {
	it('returns the exact category apps when count matches', () => {
		const lineup = shelfLineup('games', 4);
		expect(lineup).toHaveLength(4);
		expect(lineup.map((a) => a.id)).toEqual(['tetra', 'solitaire', 'minesweep', 'zorquest']);
	});

	it('pads with staff picks to fill requested count', () => {
		const lineup = shelfLineup('games', 6);
		expect(lineup).toHaveLength(6);
		const staffPicks = lineup.filter((a) => a.sticker === 'STAFF_PICK');
		expect(staffPicks.length).toBeGreaterThan(1);
	});

	it('never returns fewer than the category has', () => {
		const lineup = shelfLineup('business', 6);
		expect(lineup).toHaveLength(6);
	});

	it('works for a category with no staff picks', () => {
		const lineup = shelfLineup('business', 6);
		expect(lineup).toHaveLength(6);
		expect(lineup.every((a) => a != null)).toBe(true);
	});
});
