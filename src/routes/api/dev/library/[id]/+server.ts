import { error, json } from '@sveltejs/kit';
import { removeShowBlock, ShowBlockNotFoundError } from '$lib/dev/library/emit-show';
import type { RequestHandler } from './$types';

const VCR_DATA_PATH = 'src/lib/apps/vcr/vcr-data.ts';

export const DELETE: RequestHandler = async ({ params }) => {
	if (!import.meta.env.DEV) throw error(403, 'Dev-only endpoint');

	const fs = await import(/* @vite-ignore */ 'node:fs/promises');
	const path = await import(/* @vite-ignore */ 'node:path');
	const file = path.resolve(process.cwd(), VCR_DATA_PATH);

	const current = await fs.readFile(file, 'utf8');
	let updated: string;
	try {
		updated = removeShowBlock(current, params.id);
	} catch (err) {
		if (err instanceof ShowBlockNotFoundError) throw error(404, err.message);
		throw error(500, (err as Error).message);
	}

	await fs.writeFile(file, updated, 'utf8');
	return json({ ok: true, removedId: params.id, path: VCR_DATA_PATH });
};
