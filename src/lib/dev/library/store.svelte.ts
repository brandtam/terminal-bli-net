import { getContext, setContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { classify, KINDS, type KindKey } from './classify';
import { getItemMetadata, isVideoFile, searchArchive, type Language } from './ia-client';
import {
	extractYear,
	firstSentence,
	parseEpisodeName,
	parseSE,
	seriesKey,
	slugify,
	smartShowNameFromTitle
} from './parsers';
import type {
	Classified,
	Cluster,
	Episode,
	ExpandedFile,
	Expansion,
	IAItem,
	SaveResult,
	SearchStatus,
	ShowInput
} from './types';

type AutoFillSource = {
	name: string;
	description?: string;
};

const MAX_ID_LEN = 60;

/** Append `-2`, `-3`, … until the id isn't already taken. Adds to `taken` on return. */
function uniqueId(base: string, taken: Set<string>): string {
	const trimmed = base.slice(0, MAX_ID_LEN);
	if (!taken.has(trimmed)) {
		taken.add(trimmed);
		return trimmed;
	}
	for (let n = 2; ; n++) {
		const suffix = `-${n}`;
		const candidate = `${base.slice(0, MAX_ID_LEN - suffix.length)}${suffix}`;
		if (!taken.has(candidate)) {
			taken.add(candidate);
			return candidate;
		}
	}
}

/**
 * Central reactive store for the /dev/library importer.
 *
 * Lives in a `.svelte.ts` module as a class with `$state` fields so the
 * proxy identity survives Vite/Svelte HMR module swaps — the page imports
 * a stable instance via context, never a freshly-rebound module signal.
 */
export class LibraryStore {
	query = $state('');
	kind = $state<KindKey>('any');
	yearFrom = $state<number | null>(null);
	yearTo = $state<number | null>(null);
	rows = $state(25);
	safeOnly = $state(true);
	language = $state<Language>('English');

	results = $state<IAItem[]>([]);
	status = $state<SearchStatus>({ msg: '', kind: '' });

	expanding = $state<Record<string, Expansion>>({});

	showId = $state('');
	showName = $state('');
	showYears = $state('');
	showDesc = $state('');
	episodes = $state<Episode[]>([]);

	saving = $state(false);
	saveResult = $state<SaveResult | null>(null);
	importFlash = $state('');

	tagged: Classified[] = $derived(this.results.map((item) => ({ item, ...classify(item) })));

	shownResults: Classified[] = $derived(
		this.safeOnly ? this.tagged.filter((t) => t.tier === 'clear') : this.tagged
	);

	resultSummary = $derived.by(() => {
		if (this.results.length === 0) return '';
		const clear = this.tagged.filter((t) => t.tier === 'clear').length;
		const total = this.tagged.length;
		return `${this.shownResults.length} shown · ${total} total · ${clear} clear · ${total - clear} unverified`;
	});

	/** Archive IDs already in the episodes list as standalone items (no archiveFile). */
	addedArchiveIds: SvelteSet<string> = $derived.by(() => {
		const s = new SvelteSet<string>();
		for (const e of this.episodes) if (!e.archiveFile) s.add(e.archiveId);
		return s;
	});

	/** Groups of 3+ results that look like episodes of the same series. */
	clusters: Cluster[] = $derived.by(() => {
		const added = this.addedArchiveIds;
		const groups = new SvelteMap<string, IAItem[]>();
		for (const t of this.shownResults) {
			const key = seriesKey(t.item.title || '');
			if (!key) continue;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(t.item);
		}
		const out: Cluster[] = [];
		for (const [key, items] of groups) {
			if (items.length < 3) continue;
			items.sort((a, b) => {
				const aSE = parseSE(a.title || '');
				const bSE = parseSE(b.title || '');
				if (aSE && bSE) return aSE.s - bSE.s || aSE.e - bSE.e;
				return (a.title || '').localeCompare(b.title || '');
			});
			let addedCount = 0;
			for (const it of items) if (added.has(it.identifier)) addedCount++;
			out.push({
				key,
				name: smartShowNameFromTitle(items[0].title || '') || key,
				items,
				addedCount,
				allAdded: addedCount === items.length
			});
		}
		out.sort((a, b) => b.items.length - a.items.length);
		return out;
	});

	clusteredIds: SvelteSet<string> = $derived.by(() => {
		const s = new SvelteSet<string>();
		for (const c of this.clusters) for (const it of c.items) s.add(it.identifier);
		return s;
	});

	flatResults: Classified[] = $derived(
		this.shownResults.filter((t) => !this.clusteredIds.has(t.item.identifier))
	);

	derivedYears = $derived.by(() => {
		if (this.showYears.trim()) return this.showYears.trim();
		const ys = this.episodes.map((e) => e.year).filter((y) => y > 0);
		if (ys.length === 0) return '????';
		const min = Math.min(...ys);
		const max = Math.max(...ys);
		return min === max ? String(min) : `${min}–${max}`;
	});

	canSave = $derived(
		this.episodes.length > 0 && this.showId.trim().length > 0 && this.showName.trim().length > 0
	);

	private autofillShow(source: AutoFillSource) {
		if (this.episodes.length > 0) return;
		const guess = smartShowNameFromTitle(source.name);
		if (!this.showName) this.showName = guess;
		if (!this.showId) this.showId = slugify(guess);
		if (!this.showDesc) this.showDesc = firstSentence(source.description) || '';
	}

	private isStandaloneDuplicate(archiveId: string): boolean {
		return this.episodes.some((e) => e.archiveId === archiveId && !e.archiveFile);
	}

	private isFileDuplicate(archiveId: string, fileName: string): boolean {
		return this.episodes.some((e) => e.archiveId === archiveId && e.archiveFile === fileName);
	}

	private appendEpisodes(toAdd: Episode[], flashMsg: string) {
		if (toAdd.length === 0) return;
		// Defense in depth: the keyed {#each ep (ep.id)} block in the page silently freezes
		// reactive updates on a duplicate key. Catch producer bugs here so the user sees a
		// real error instead of a confusing "added N episodes" flash with an empty list.
		const existing = new Set(this.episodes.map((e) => e.id));
		for (const ep of toAdd) {
			if (existing.has(ep.id)) {
				this.saveResult = { ok: false, msg: `Internal: duplicate episode id "${ep.id}"` };
				return;
			}
			existing.add(ep.id);
		}
		this.episodes.push(...toAdd);
		this.saveResult = null;
		this.flash(flashMsg);
	}

	flash(msg: string) {
		this.importFlash = msg;
	}

	async search() {
		const selectedKind = KINDS[this.kind];
		const cols = [...selectedKind.collections];
		if (!this.query.trim() && cols.length === 0) {
			this.status = { msg: 'Enter a query or pick a kind.', kind: 'error' };
			return;
		}
		this.status = { msg: 'Searching…', kind: 'loading' };
		try {
			this.results = await searchArchive({
				query: this.query,
				collections: cols,
				yearFrom: this.yearFrom,
				yearTo: this.yearTo,
				rows: this.rows,
				language: this.language
			});
			this.status = { msg: '', kind: '' };
		} catch (err) {
			this.results = [];
			this.status = { msg: `Search failed: ${(err as Error).message}`, kind: 'error' };
		}
	}

	async handleAdd(item: IAItem) {
		if (this.isStandaloneDuplicate(item.identifier)) return;

		this.expanding[item.identifier] = { loading: true };
		try {
			const metadata = await getItemMetadata(item.identifier);
			const files: ExpandedFile[] = (metadata.files ?? [])
				.filter((f) => f.source === 'original' && isVideoFile(f.format))
				.map((f) => {
					const parsed = parseEpisodeName(f.name);
					const lenNum =
						typeof f.length === 'number'
							? f.length
							: typeof f.length === 'string'
								? parseFloat(f.length)
								: undefined;
					return {
						name: f.name,
						title: parsed.title,
						season: parsed.season,
						episode: parsed.episode,
						durationSec: lenNum && !Number.isNaN(lenNum) ? lenNum : undefined
					};
				})
				.sort(
					(a, b) => a.season - b.season || a.episode - b.episode || a.name.localeCompare(b.name)
				);

			if (files.length <= 1) {
				delete this.expanding[item.identifier];
				this.addSingleEpisode(item);
			} else {
				this.expanding[item.identifier] = {
					loading: false,
					files,
					selected: new SvelteSet(files.map((f) => f.name))
				};
				this.autofillShow({ name: item.title || item.identifier, description: item.description });
			}
		} catch (err) {
			this.expanding[item.identifier] = {
				loading: false,
				error: (err as Error).message
			};
		}
	}

	private addSingleEpisode(item: IAItem) {
		const title = item.title || item.identifier;
		const showSlug = slugify(this.showId || 'show');
		const id =
			`${showSlug}-${slugify(item.identifier || title) || `ep-${this.episodes.length + 1}`}`.slice(
				0,
				MAX_ID_LEN
			);
		this.autofillShow({ name: title, description: item.description });
		this.appendEpisodes(
			[
				{
					id,
					title,
					year: extractYear(item),
					archiveId: item.identifier,
					description: firstSentence(item.description) || 'No description available.'
				}
			],
			`Added "${title}"`
		);
	}

	importCluster(cluster: Cluster) {
		this.autofillShow({
			name: cluster.name,
			description: cluster.items[0]?.description
		});
		const showSlug = slugify(this.showId || cluster.name) || 'show';
		const toAdd: Episode[] = [];
		const taken = new Set(this.episodes.map((e) => e.id));
		for (const item of cluster.items) {
			if (this.isStandaloneDuplicate(item.identifier)) continue;
			const se = parseSE(item.title || '');
			const idSuffix = se
				? `s${String(se.s).padStart(2, '0')}e${String(se.e).padStart(2, '0')}`
				: slugify(item.identifier) || `ep-${this.episodes.length + toAdd.length + 1}`;
			toAdd.push({
				id: uniqueId(`${showSlug}-${idSuffix}`, taken),
				title: item.title || item.identifier,
				year: extractYear(item),
				archiveId: item.identifier,
				description: firstSentence(item.description) || 'No description available.'
			});
		}
		this.appendEpisodes(
			toAdd,
			`Added ${toAdd.length} episode${toAdd.length === 1 ? '' : 's'} from "${cluster.name}"`
		);
	}

	addExpandedEpisodes(item: IAItem) {
		const exp = this.expanding[item.identifier];
		if (!exp?.files || !exp.selected) return;

		const itemYear = extractYear(item);
		const showSlug =
			slugify(this.showId || smartShowNameFromTitle(item.title || item.identifier)) || 'show';
		const toAdd: Episode[] = [];

		for (const f of exp.files) {
			if (!exp.selected.has(f.name)) continue;
			if (this.isFileDuplicate(item.identifier, f.name)) continue;
			const sePrefix =
				f.episode > 0
					? `s${String(f.season).padStart(2, '0')}e${String(f.episode).padStart(2, '0')}`
					: slugify(f.title) || `ep-${toAdd.length + 1}`;
			toAdd.push({
				id: `${showSlug}-${sePrefix}`.slice(0, MAX_ID_LEN),
				title: f.episode > 0 ? `S${f.season}E${f.episode} — ${f.title}` : f.title,
				year: itemYear,
				archiveId: item.identifier,
				archiveFile: f.name,
				description: ''
			});
		}

		this.appendEpisodes(
			toAdd,
			`Added ${toAdd.length} episode${toAdd.length === 1 ? '' : 's'} from "${item.title || item.identifier}"`
		);
		this.cancelExpansion(item.identifier);
	}

	toggleFile(itemId: string, fileName: string) {
		const exp = this.expanding[itemId];
		if (!exp?.selected) return;
		if (exp.selected.has(fileName)) exp.selected.delete(fileName);
		else exp.selected.add(fileName);
	}

	selectAll(itemId: string, value: boolean) {
		const exp = this.expanding[itemId];
		if (!exp?.files) return;
		exp.selected = value ? new SvelteSet(exp.files.map((f) => f.name)) : new SvelteSet();
	}

	cancelExpansion(itemId: string) {
		delete this.expanding[itemId];
	}

	removeEpisode(i: number) {
		this.episodes.splice(i, 1);
		this.saveResult = null;
	}

	clearAll() {
		if (this.episodes.length && !confirm('Clear all episodes and show metadata?')) return;
		this.reset();
	}

	private reset() {
		this.episodes.length = 0;
		this.showId = '';
		this.showName = '';
		this.showYears = '';
		this.showDesc = '';
		this.saveResult = null;
	}

	private buildPayload(): ShowInput {
		return {
			id: this.showId.trim(),
			name: this.showName.trim(),
			years: this.derivedYears,
			description: this.showDesc.trim() || 'Add a description.',
			episodes: $state.snapshot(this.episodes) as Episode[]
		};
	}

	async removeShow(id: string, name: string): Promise<boolean> {
		if (!confirm(`Remove "${name}" from the VCR library?\n\nThis edits vcr-data.ts directly.`))
			return false;
		try {
			const res = await fetch(`/api/dev/library/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			const body = (await res.json().catch(() => ({}))) as { message?: string };
			if (!res.ok) {
				this.saveResult = { ok: false, msg: body.message || `Remove failed: ${res.status}` };
				return false;
			}
			this.saveResult = { ok: true, msg: `Removed "${name}" from vcr-data.ts` };
			return true;
		} catch (err) {
			this.saveResult = { ok: false, msg: `Remove failed: ${(err as Error).message}` };
			return false;
		}
	}

	async save() {
		if (!this.canSave || this.saving) return;
		this.saving = true;
		this.saveResult = null;
		try {
			const res = await fetch('/api/dev/library', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(this.buildPayload())
			});
			const body = (await res.json().catch(() => ({}))) as { message?: string };
			if (!res.ok) {
				this.saveResult = { ok: false, msg: body.message || `Save failed: ${res.status}` };
				return;
			}
			const savedName = this.showName;
			const count = this.episodes.length;
			this.reset();
			this.saveResult = {
				ok: true,
				msg: `Saved "${savedName}" (${count} episode${count === 1 ? '' : 's'}) to vcr-data.ts`
			};
		} catch (err) {
			this.saveResult = { ok: false, msg: `Save failed: ${(err as Error).message}` };
		} finally {
			this.saving = false;
		}
	}
}

const LIBRARY_STORE = Symbol('library-store');

export function setLibraryStore(): LibraryStore {
	const store = new LibraryStore();
	setContext(LIBRARY_STORE, store);
	return store;
}

export function getLibraryStore(): LibraryStore {
	const store = getContext<LibraryStore | undefined>(LIBRARY_STORE);
	if (!store) throw new Error('LibraryStore not set — call setLibraryStore() in the page first');
	return store;
}
