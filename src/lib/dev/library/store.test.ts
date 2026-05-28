/**
 * Cluster import: two IA items can parse to the same `SxxExx` (e.g. SDTV + remastered uploads
 * of the same episode), which produces duplicate episode ids. The keyed {#each} block in the
 * page silently freezes reactive updates on a duplicate key — so the user sees "Added 23 episodes"
 * but EPISODES (0), an empty draft, and a disabled save button. Regression test for that path.
 */
import { describe, expect, test } from 'vitest';
import { LibraryStore } from './store.svelte';
import type { Cluster, IAItem } from './types';

function makeItem(id: string, title: string): IAItem {
	return { identifier: id, title, year: 1984, description: '' };
}

describe('LibraryStore.importCluster', () => {
	test('disambiguates duplicate SxxExx with -2, -3 suffixes', () => {
		const store = new LibraryStore();
		const items: IAItem[] = [
			makeItem('a', 'V The Series S01E11 The Rest'),
			makeItem('b', 'V The Series S01E11 The Rest (remastered)'),
			makeItem('c', 'V The Series S01E11 The Rest (sdtv)')
		];
		const cluster: Cluster = {
			key: 'v the series',
			name: 'V The Series',
			items,
			addedCount: 0,
			allAdded: false
		};
		store.importCluster(cluster);
		const ids = store.episodes.map((e) => e.id);
		expect(ids).toEqual(['v-the-series-s01e11', 'v-the-series-s01e11-2', 'v-the-series-s01e11-3']);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test('auto-fills show name and id from cluster name', () => {
		const store = new LibraryStore();
		store.importCluster({
			key: 'v',
			name: 'V The Series',
			items: [makeItem('a', 'V The Series S01E01')],
			addedCount: 0,
			allAdded: false
		});
		expect(store.showName).toBe('V The Series');
		expect(store.showId).toBe('v-the-series');
	});

	test('canSave becomes true after a successful cluster import', () => {
		const store = new LibraryStore();
		expect(store.canSave).toBe(false);
		store.importCluster({
			key: 'v',
			name: 'V The Series',
			items: [
				makeItem('a', 'V The Series S01E01'),
				makeItem('b', 'V The Series S01E02'),
				makeItem('c', 'V The Series S01E02') // duplicate SE
			],
			addedCount: 0,
			allAdded: false
		});
		expect(store.canSave).toBe(true);
		expect(store.episodes).toHaveLength(3);
	});
});
