import { error, json } from '@sveltejs/kit';
import { buildSearchUrl } from '$lib/dev/library/ia-client';
import type { RequestHandler } from './$types';

type IADoc = { collection?: string | string[]; [k: string]: unknown };
type IAResponse = { response?: { docs?: IADoc[] } };

/** IA returns user-favorite collections (fav-*) as part of `collection`. They bloat payloads (~10x) and we never use them. */
function stripFavCollections(data: IAResponse): IAResponse {
	const docs = data.response?.docs;
	if (!docs) return data;
	for (const d of docs) {
		if (Array.isArray(d.collection)) {
			d.collection = d.collection.filter((c) => !c.startsWith('fav-'));
		}
	}
	return data;
}

async function fetchWithRetry(url: URL, fetchFn: typeof fetch): Promise<Response> {
	for (let i = 0; i < 2; i++) {
		try {
			const res = await fetchFn(url);
			if (res.ok || res.status < 500) return res;
		} catch {
			// fall through to retry
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	return fetchFn(url);
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	if (!import.meta.env.DEV) throw error(403, 'Dev-only endpoint');

	const collections = url.searchParams.getAll('collection');
	const yearFromRaw = url.searchParams.get('yearFrom');
	const yearToRaw = url.searchParams.get('yearTo');
	const rowsRaw = url.searchParams.get('rows');

	const iaUrl = buildSearchUrl({
		query: url.searchParams.get('q') ?? '',
		collections,
		yearFrom: yearFromRaw ? parseInt(yearFromRaw, 10) : null,
		yearTo: yearToRaw ? parseInt(yearToRaw, 10) : null,
		rows: rowsRaw ? parseInt(rowsRaw, 10) : 25,
		language: url.searchParams.get('language') ?? ''
	});

	const res = await fetchWithRetry(iaUrl, fetch);
	if (!res.ok) throw error(res.status, `Internet Archive: ${res.statusText}`);
	const data = (await res.json()) as IAResponse;
	return json(stripFavCollections(data));
};
