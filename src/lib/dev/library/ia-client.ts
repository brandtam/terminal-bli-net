import type { IAItem } from './types';

const VIDEO_FORMATS = new Set([
	'mpeg4',
	'h.264',
	'h.264 ia',
	'matroska',
	'mpeg2',
	'ogg video',
	'webm'
]);

export function isVideoFile(format: string | undefined): boolean {
	if (!format) return false;
	return VIDEO_FORMATS.has(format.toLowerCase());
}

/** Common language variants on IA. Keys are the canonical labels shown in the UI. */
const LANGUAGE_VARIANTS: Record<string, string[]> = {
	English: ['English', 'eng', 'en'],
	Spanish: ['Spanish', 'spa', 'es'],
	French: ['French', 'fra', 'fre', 'fr'],
	German: ['German', 'ger', 'deu', 'de'],
	Italian: ['Italian', 'ita', 'it'],
	Japanese: ['Japanese', 'jpn', 'ja'],
	Portuguese: ['Portuguese', 'por', 'pt']
};

export const LANGUAGES = ['', ...Object.keys(LANGUAGE_VARIANTS)] as const;
export type Language = (typeof LANGUAGES)[number];

export type SearchInput = {
	query: string;
	collections: string[];
	yearFrom: number | null;
	yearTo: number | null;
	rows: number;
	/** IA `language` field. Empty string = no filter. */
	language: string;
};

const SEARCH_FIELDS = [
	'identifier',
	'title',
	'year',
	'description',
	'licenseurl',
	'collection',
	'possible-copyright-status',
	'downloads'
];

export function buildSearchUrl(input: SearchInput): URL {
	const parts: string[] = [];
	if (input.query.trim()) parts.push(`(${input.query.trim()})`);
	if (input.collections.length === 1) parts.push(`collection:${input.collections[0]}`);
	else if (input.collections.length > 1)
		parts.push(`(${input.collections.map((c) => `collection:${c}`).join(' OR ')})`);
	if (input.yearFrom || input.yearTo) {
		const from = input.yearFrom ?? '*';
		const to = input.yearTo ?? '*';
		parts.push(`year:[${from} TO ${to}]`);
	}
	if (input.language.trim()) {
		// IA stores language inconsistently ("English" / "eng" / "en"). Match common variants
		// to avoid missing English uploads tagged only by ISO code (and vice versa).
		const variants = LANGUAGE_VARIANTS[input.language] ?? [input.language];
		parts.push(`(${variants.map((v) => `language:${v}`).join(' OR ')})`);
	}
	parts.push('mediatype:movies');
	const q = parts.join(' AND ');

	const url = new URL('https://archive.org/advancedsearch.php');
	url.searchParams.set('q', q);
	url.searchParams.set('output', 'json');
	url.searchParams.set('rows', String(Math.min(100, Math.max(1, input.rows))));
	url.searchParams.set('sort[]', 'downloads desc');
	for (const f of SEARCH_FIELDS) url.searchParams.append('fl[]', f);
	return url;
}

function buildProxySearchUrl(input: SearchInput): URL {
	const url = new URL('/api/dev/library/search', window.location.origin);
	if (input.query.trim()) url.searchParams.set('q', input.query.trim());
	for (const c of input.collections) url.searchParams.append('collection', c);
	if (input.yearFrom != null) url.searchParams.set('yearFrom', String(input.yearFrom));
	if (input.yearTo != null) url.searchParams.set('yearTo', String(input.yearTo));
	if (input.language) url.searchParams.set('language', input.language);
	url.searchParams.set('rows', String(input.rows));
	return url;
}

export async function searchArchive(input: SearchInput): Promise<IAItem[]> {
	const res = await fetch(buildProxySearchUrl(input));
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	const data = (await res.json()) as { response?: { docs?: IAItem[] } };
	return data.response?.docs ?? [];
}

export type IAMetadataFile = {
	name: string;
	source?: string;
	format?: string;
	length?: string | number;
};

export type IAMetadata = {
	files?: IAMetadataFile[];
};

export async function getItemMetadata(identifier: string): Promise<IAMetadata> {
	const res = await fetch(`/api/dev/library/metadata/${encodeURIComponent(identifier)}`);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	return (await res.json()) as IAMetadata;
}
