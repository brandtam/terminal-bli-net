import type { IAItem, Kind, Tier } from './types';

export const KNOWN_SAFE = new Set([
	'prelinger',
	'classic_cartoons',
	'computerchronicles',
	'sabucat',
	'academic_films',
	'opensource_movies'
]);

export type KindKey =
	| 'any'
	| 'tv'
	| 'movie'
	| 'cartoon'
	| 'doc'
	| 'educational'
	| 'commercials'
	| 'cc'
	| 'computerchronicles';

export const KINDS: Record<KindKey, Kind> = {
	any: { label: 'Anything', collections: [] },
	tv: {
		label: 'TV shows',
		collections: ['classic_tv', 'classic_tv_movies', 'classictvads'],
		note: 'mostly user-submitted — verify each'
	},
	movie: {
		label: 'Movies (feature films)',
		collections: ['feature_films', 'classic_movies', 'silent_films']
	},
	cartoon: {
		label: 'Cartoons / Animation',
		collections: ['classic_cartoons', 'animationandcartoons']
	},
	doc: {
		label: 'Documentaries',
		collections: ['documentary_films', 'documentaries']
	},
	educational: {
		label: 'Educational / Industrial',
		collections: ['prelinger', 'academic_films', 'ephemera']
	},
	commercials: {
		label: 'Commercials',
		collections: ['sabucat', 'classic_tv_commercials']
	},
	cc: {
		label: 'Open / CC video',
		collections: ['opensource_movies']
	},
	computerchronicles: {
		label: 'Computer Chronicles',
		collections: ['computerchronicles']
	}
};

export function classify(item: IAItem): { tier: Tier; reason: string } {
	const license = item.licenseurl || '';
	const cstatus = item['possible-copyright-status'] || '';
	const cols = Array.isArray(item.collection) ? item.collection : [item.collection].filter(Boolean);

	if (cstatus === 'NOT_IN_COPYRIGHT') return { tier: 'clear', reason: 'public domain' };
	if (license.includes('creativecommons.org') || license.includes('publicdomain')) {
		return { tier: 'clear', reason: 'licensed' };
	}
	const safe = cols.find((c) => c && KNOWN_SAFE.has(c));
	if (safe) return { tier: 'clear', reason: `collection: ${safe}` };
	return { tier: 'unknown', reason: 'no license metadata' };
}
