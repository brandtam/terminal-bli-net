import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dialerEnv, requireSession } from '$lib/server/dialer/guard';
import { downloadFile, refundDownloadCredit } from '$lib/server/dialer/files';

/**
 * Download a file — one ratio credit, canon or community alike (that's the
 * economy the fiction runs on; registration seeds exactly enough for the
 * chain). Text comes back as JSON for the terminal; images stream from R2.
 */
export const GET: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	const handle = await requireSession(env, request);

	const result = await downloadFile(env.DIALER_DB, params.id, handle);
	if (!result.ok) {
		if (result.reason === 'no-file') throw error(404, 'NO SUCH FILE');
		throw error(403, 'RATIO CHECK FAILED. UPLOAD 1 TO UNLOCK 3. -- THE MGMT');
	}

	if (result.file.kind !== 'png') {
		return json({ file: result.file, body: result.bodyText ?? '' });
	}

	const object = result.r2Key ? await env.DIALER_FILES.get(result.r2Key) : null;
	if (!object) {
		// Metadata without a body (interrupted delete) — undo the spent credit.
		await refundDownloadCredit(env.DIALER_DB, handle);
		throw error(404, 'NO SUCH FILE');
	}
	return new Response(object.body, {
		headers: {
			'Content-Type': 'image/png',
			'Content-Length': String(object.size),
			'X-Dialer-File': JSON.stringify(result.file)
		}
	});
};
