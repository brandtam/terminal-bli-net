import { describe, it, expect } from 'vitest';
import {
	APPS,
	APP_BY_ID,
	CATEGORIES,
	CAT_COLORS,
	STORE_CATALOG_OMISSIONS,
	shelfLineup
} from './store-data';
import { APP_LIBRARY } from '$lib/terminalos/apps/app-library';

describe('store catalog', () => {
	it('has 12 apps', () => {
		expect(APPS).toHaveLength(12);
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

	it('has unique app ids so APP_BY_ID cannot mask duplicates', () => {
		const ids = APPS.map((app) => app.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('every store app ID has a matching AppLibrary entry', () => {
		// Store-catalog ids are plain strings; probe them against the library by
		// string identity (a Set<AppId>.has() would reject the wider string).
		const libraryIds = new Set<string>(APP_LIBRARY.map((a) => a.id));
		for (const app of APPS) {
			expect(libraryIds.has(app.id)).toBe(true);
		}
	});

	it('no system apps appear in the store catalog', () => {
		const systemIds = APP_LIBRARY.filter((a) => a.isSystem).map((a) => a.id);
		const storeIds = new Set(APPS.map((a) => a.id));
		for (const id of systemIds) {
			expect(storeIds.has(id)).toBe(false);
		}
	});

	it('represents every sellable released app or explicitly omits it with a reason', () => {
		const storeIds = new Set(APPS.map((app) => app.id));
		const omissionIds = new Set(Object.keys(STORE_CATALOG_OMISSIONS));
		const sellable = APP_LIBRARY.filter((app) => !app.isSystem && app.status === 'released');

		for (const app of sellable) {
			expect(
				storeIds.has(app.id) || omissionIds.has(app.id),
				`${app.id} is released but missing from Computer Store data and omissions`
			).toBe(true);
		}
	});

	it('keeps store omissions explicit and valid', () => {
		const libraryIds = new Set<string>(APP_LIBRARY.map((app) => app.id));
		const storeIds = new Set(APPS.map((app) => app.id));

		for (const [id, reason] of Object.entries(STORE_CATALOG_OMISSIONS)) {
			const app = APP_LIBRARY.find((item) => item.id === id);
			expect(libraryIds.has(id), `${id} omission must refer to a catalog app`).toBe(true);
			expect(app?.isSystem, `${id} omission must not refer to a system app`).toBe(false);
			expect(storeIds.has(id), `${id} must not be both represented and omitted`).toBe(false);
			expect(reason.trim(), `${id} omission needs a reason`).not.toBe('');
		}
	});

	it('hides deprecated apps or lists them as explicit omissions', () => {
		const storeIds = new Set(APPS.map((app) => app.id));
		const omissionIds = new Set(Object.keys(STORE_CATALOG_OMISSIONS));
		const deprecated = APP_LIBRARY.filter((app) => !app.isSystem && app.status === 'deprecated');

		for (const app of deprecated) {
			expect(
				!storeIds.has(app.id) || omissionIds.has(app.id),
				`${app.id} is deprecated but still represented without an omission`
			).toBe(true);
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
