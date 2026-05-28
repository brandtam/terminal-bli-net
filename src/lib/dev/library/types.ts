export type IAItem = {
	identifier: string;
	title?: string;
	year?: string | number;
	description?: string;
	licenseurl?: string;
	collection?: string | string[];
	'possible-copyright-status'?: string;
};

export type Episode = {
	id: string;
	title: string;
	year: number;
	archiveId: string;
	archiveFile?: string;
	description: string;
};

export type ShowInput = {
	id: string;
	name: string;
	years: string;
	description: string;
	episodes: Episode[];
};

export type Tier = 'clear' | 'unknown';

export type Classified = {
	item: IAItem;
	tier: Tier;
	reason: string;
};

export type Kind = {
	label: string;
	collections: string[];
	note?: string;
};

export type Cluster = {
	key: string;
	name: string;
	items: IAItem[];
	addedCount: number;
	allAdded: boolean;
};

export type ExpandedFile = {
	name: string;
	title: string;
	season: number;
	episode: number;
	durationSec?: number;
};

export type Expansion = {
	loading: boolean;
	error?: string;
	files?: ExpandedFile[];
	selected?: Set<string>; // SvelteSet at runtime — typed loose so consumers don't import svelte/reactivity
};

export type SearchStatus = {
	msg: string;
	kind: '' | 'error' | 'loading' | 'ok';
};

export type SaveResult = {
	ok: boolean;
	msg: string;
};
