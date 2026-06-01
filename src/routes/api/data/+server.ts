import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPublicContentCatalog } from '$lib/server/content-catalog';

export const GET: RequestHandler = async () => {
	return json(loadPublicContentCatalog());
};
