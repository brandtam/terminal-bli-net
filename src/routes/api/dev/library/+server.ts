import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { buildShowBlock } from '$lib/dev/library/emit-show';
import { ShowInputSchema } from '$lib/dev/library/payload-schema';
import type { RequestHandler } from './$types';

const SENTINEL = '\t// >>> /dev/library inserts new shows above this line <<<';
const VCR_DATA_PATH = 'src/lib/apps/vcr/vcr-data.ts';

export const POST: RequestHandler = async ({ request }) => {
	if (!import.meta.env.DEV) throw error(403, 'Dev-only endpoint');

	let payload: z.infer<typeof ShowInputSchema>;
	try {
		payload = ShowInputSchema.parse(await request.json());
	} catch (err) {
		const message =
			err instanceof z.ZodError ? err.issues.map((i) => i.message).join('; ') : 'Invalid payload';
		throw error(400, message);
	}

	const fs = await import(/* @vite-ignore */ 'node:fs/promises');
	const path = await import(/* @vite-ignore */ 'node:path');
	const file = path.resolve(process.cwd(), VCR_DATA_PATH);

	const current = await fs.readFile(file, 'utf8');

	if (!current.includes(SENTINEL)) {
		throw error(500, `Sentinel not found in ${VCR_DATA_PATH}. Cannot insert safely.`);
	}

	if (new RegExp(`\\bid:\\s*'${payload.id}'`).test(current)) {
		throw error(409, `A show with id "${payload.id}" already exists`);
	}

	const block = buildShowBlock(payload);
	await fs.writeFile(file, current.replace(SENTINEL, `${block}\n${SENTINEL}`), 'utf8');

	return json({
		ok: true,
		showId: payload.id,
		episodeCount: payload.episodes.length,
		path: VCR_DATA_PATH
	});
};
