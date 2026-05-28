import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	if (!import.meta.env.DEV) throw error(403, 'Dev-only endpoint');
	const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(params.identifier)}`);
	if (!res.ok) throw error(res.status, `Internet Archive: ${res.statusText}`);
	return json(await res.json());
};
