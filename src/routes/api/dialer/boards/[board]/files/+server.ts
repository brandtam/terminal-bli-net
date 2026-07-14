import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPublicBoard } from '$lib/server/dialer/boards';
import { asString, dialerEnv, requireSession } from '$lib/server/dialer/guard';
import {
	IMAGE_MAX_BYTES,
	grantUploadCredits,
	listFiles,
	setFileVisible,
	softDeleteFile,
	uploadImageFile,
	uploadTextFile,
	UPLOADS_PER_DAY
} from '$lib/server/dialer/files';
import { moderateText } from '$lib/server/dialer/moderation';

/** The board's file area: canon in authored order first, then community uploads. */
export const GET: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	await requireSession(env, request);
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	return json({ files: await listFiles(env.DIALER_DB, params.board) });
};

interface UploadBody {
	name?: unknown;
	kind?: unknown;
	body?: unknown;
	/** PNG bytes, base64 — already dithered by the client; the server verifies. */
	dataBase64?: unknown;
}

/**
 * Upload a file. Writes land hidden, then moderation decides: OK → visible
 * (and the ratio credits are earned), REJECT → refused in-fiction, seam down
 * → stays hidden for the nightly re-audit (never fail open). Refusals answer
 * in-fiction throughout.
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	const handle = await requireSession(env, request);
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');
	const board = params.board;

	let body: UploadBody;
	try {
		body = (await request.json()) as UploadBody;
	} catch {
		throw error(400, 'BAD REQUEST');
	}

	const now = new Date();
	const kind = asString(body.kind);
	const name = asString(body.name);

	const result =
		kind === 'png'
			? await uploadImageFile(
					env.DIALER_DB,
					env.DIALER_FILES,
					board,
					handle,
					{ name, bytes: decodePngBase64(asString(body.dataBase64)) },
					now
				)
			: await uploadTextFile(
					env.DIALER_DB,
					board,
					handle,
					{ name, kind, body: asString(body.body) },
					now
				);

	if (!result.ok) {
		if (result.reason === 'invalid-name') throw error(400, 'FILENAME MUST BE 8.3 STYLE (A-Z 0-9)');
		if (result.reason === 'invalid-kind') throw error(400, 'TXT, MD, OR PNG. THIS IS A MODEM.');
		if (result.reason === 'invalid-body') throw error(400, 'FILE FAILED INSPECTION');
		if (result.reason === 'duplicate-name') throw error(409, 'A FILE BY THAT NAME IS ALREADY HERE');
		throw error(429, `${UPLOADS_PER_DAY} UPLOADS A DAY. THE DRIVE IS ONLY 40 MEGS.`);
	}

	// Flag-on-write: the row exists hidden; the verdict decides what happens next.
	const subject = kind === 'png' ? name : `${name}\n${asString(body.body)}`;
	const verdict = await moderateText(env, 'BBS file upload', subject);
	if (verdict === 'reject') {
		await softDeleteFile(env.DIALER_DB, result.id, now);
		throw error(403, 'THE SYSOP HAS SUSPENDED POSTING PRIVILEGES FOR THIS MESSAGE.');
	}
	if (verdict === 'ok') {
		await setFileVisible(env.DIALER_DB, result.id);
		await grantUploadCredits(env.DIALER_DB, handle);
	}
	return json({ fileId: result.id, held: verdict === 'unavailable' }, { status: 201 });
};

/** Base64 → bytes, bounded before decode so a huge payload dies cheap. */
function decodePngBase64(data: string): Uint8Array {
	// 64 KB of PNG is ~88 KB of base64; anything bigger can't pass verification.
	if (data.length === 0 || data.length > Math.ceil((IMAGE_MAX_BYTES * 4) / 3) + 4) {
		return new Uint8Array(0);
	}
	try {
		return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
	} catch {
		return new Uint8Array(0);
	}
}
