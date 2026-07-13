import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	APPS,
	APP_BY_ID,
	CATEGORIES,
	CAT_COLORS,
	STORE_CATALOG_OMISSIONS,
	shelfLineup
} from './store-data';
import { APP_LIBRARY } from '$lib/terminalos/apps/app-library';
import { MANIFESTS } from '$lib/terminalos/apps/manifests';

/**
 * The box-art glyphs the store's PixelIcon actually draws, read out of the
 * component source so this can't drift from the real set. A store block naming
 * an unknown boxIcon would render a blank splash panel.
 */
function knownBoxIcons(): Set<string> {
	const src = readFileSync(fileURLToPath(new URL('./PixelIcon.svelte', import.meta.url)), 'utf8');
	const names = [...src.matchAll(/name\s*===\s*'([^']+)'/g)].map((m) => m[1]);
	expect(names.length).toBeGreaterThan(0);
	return new Set(names);
}

describe('store catalog', () => {
	it('has 13 apps', () => {
		expect(APPS).toHaveLength(13);
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

	it('requires a manifest store block (or an explicit omission) on every released non-system app', () => {
		// The drift guard: the catalog derives from manifests, so a released store
		// app with no `store` block silently vanishes from the shelves. Assert on
		// the manifests directly — being sellable means declaring the listing.
		const omissionIds = new Set(Object.keys(STORE_CATALOG_OMISSIONS));
		const sellable = MANIFESTS.filter((m) => !m.isSystem && m.status === 'released');

		for (const m of sellable) {
			expect(
				m.store !== undefined || omissionIds.has(m.id),
				`${m.id} is released but has no manifest store block and no omission entry`
			).toBe(true);
		}
	});

	it('never puts a store block on a system app', () => {
		for (const m of MANIFESTS.filter((x) => x.isSystem)) {
			expect(m.store, `${m.id} is a system app and must not carry a store listing`).toBeUndefined();
		}
	});

	it('names a real box-art glyph on every store block', () => {
		const known = knownBoxIcons();
		for (const app of APPS) {
			expect(
				known.has(app.icon),
				`${app.id} boxIcon '${app.icon}' is not a store PixelIcon glyph`
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
