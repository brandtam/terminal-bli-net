import { MANIFESTS } from '$lib/terminalos/apps/manifests';
import type { StoreCategoryId, StoreSticker } from '$lib/terminalos/apps/app-manifest';

/**
 * The Computer Store catalog, DERIVED from the app manifests at module load.
 * The manifest is the single add-on contract: an app joins the store by
 * declaring a `store` block on its manifest entry (see app-manifest.ts), never
 * by editing this file. What lives here is only what can't sit per-app — the
 * category (aisle) display table and the box-art color scheme.
 */

export type StoreApp = {
	id: string;
	cat: 'GAMES' | 'PROD' | 'ENT';
	title: string;
	pub: string;
	tagline: string;
	icon: string;
	sticker?: StoreSticker;
	back: string;
	inside: string[];
	reqs: string;
};

export type StoreCategory = {
	id: string;
	label: string;
	color: string;
	tagline: string;
	/** Derived from manifests (store.category + shelfOrder), never hand-listed. */
	appIds: string[];
};

export type CategoryId = StoreCategoryId;

/**
 * Released non-system apps deliberately kept out of the store, id → reason.
 * The drift test requires every released store app to carry a manifest `store`
 * block or an entry here.
 */
export const STORE_CATALOG_OMISSIONS: Record<string, string> = {};

/** Aisle display metadata + which box color scheme the aisle's boxes use. */
const CATEGORY_META: Record<
	CategoryId,
	{ label: string; color: string; tagline: string; box: StoreApp['cat'] }
> = {
	games: { label: 'GAMES', color: '#5e3a8a', tagline: 'Adventure · Puzzle · Card', box: 'GAMES' },
	business: { label: 'BUSINESS', color: '#1e5fc8', tagline: 'Productivity · Tools', box: 'PROD' },
	ent: { label: 'ENTERTAINMENT', color: '#c92127', tagline: 'TV · Chat · Multimedia', box: 'ENT' }
};

const listed = MANIFESTS.filter((m) => m.store !== undefined).map((m) => ({
	manifest: m,
	store: m.store!
}));

/** Every store box, derived one-to-one from manifests with a `store` block. */
export const APPS: StoreApp[] = listed.map(({ manifest, store }) => ({
	id: manifest.id,
	cat: CATEGORY_META[store.category].box,
	// Box art is always caps; the title derives from the app's display name.
	title: manifest.name.toUpperCase(),
	pub: store.publisher,
	tagline: store.tagline,
	icon: store.boxIcon,
	sticker: store.sticker,
	back: store.back,
	inside: store.inside,
	reqs: store.reqs
}));

export const APP_BY_ID: Record<string, StoreApp> = APPS.reduce(
	(m, a) => {
		m[a.id] = a;
		return m;
	},
	{} as Record<string, StoreApp>
);

/** Aisle membership derived from store.category, shelfOrder then manifest order. */
function categoryAppIds(id: CategoryId): string[] {
	return listed
		.filter((l) => l.store.category === id)
		.sort((a, b) => (a.store.shelfOrder ?? 0) - (b.store.shelfOrder ?? 0))
		.map((l) => l.manifest.id);
}

export const CATEGORIES: Record<string, StoreCategory> = Object.fromEntries(
	(Object.keys(CATEGORY_META) as CategoryId[]).map((id) => {
		const { label, color, tagline } = CATEGORY_META[id];
		return [id, { id, label, color, tagline, appIds: categoryAppIds(id) }];
	})
);

export const CAT_COLORS: Record<string, { band: string; splash: string; trim: string }> = {
	GAMES: { band: '#5e3a8a', splash: '#d6c4f0', trim: '#3a1f5a' },
	PROD: { band: '#1e5fc8', splash: '#c8dffa', trim: '#103a82' },
	ENT: { band: '#c92127', splash: '#ffd0c0', trim: '#8a1218' }
};

/**
 * Builds a lineup of apps for a shelf, duplicating staff picks to fill
 * the requested count. Gives a real-store feel where popular titles
 * get more facings.
 */
export function shelfLineup(catId: CategoryId, count: number): StoreApp[] {
	const apps = CATEGORIES[catId].appIds.map((id) => APP_BY_ID[id]);
	const picks = apps.filter((a) => a.sticker === 'STAFF_PICK');
	const rest = apps.filter((a) => a.sticker !== 'STAFF_PICK');
	const out = [...apps];
	let i = 0;
	while (out.length < count && picks.length > 0) {
		out.push(picks[i % picks.length]);
		i++;
	}
	while (out.length < count) out.push(rest[0] || apps[0]);
	return out;
}
