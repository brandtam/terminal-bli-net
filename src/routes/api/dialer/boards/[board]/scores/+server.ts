import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPublicBoard } from '$lib/server/dialer/boards';
import { dialerEnv, requireSession } from '$lib/server/dialer/guard';
import { listScores, submitScore } from '$lib/server/dialer/scores';

/** The board's door-game top 10 — best run per handle. */
export const GET: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	await requireSession(env, request);
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	return json({ scores: await listScores(env.DIALER_DB, params.board) });
};

interface ScoreBody {
	score?: unknown;
}

/** Bank a door-game win. */
export const POST: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	const handle = await requireSession(env, request);
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	let body: ScoreBody;
	try {
		body = (await request.json()) as ScoreBody;
	} catch {
		throw error(400, 'BAD REQUEST');
	}

	const score = typeof body.score === 'number' ? body.score : NaN;
	const result = await submitScore(env.DIALER_DB, params.board, handle, score, new Date());
	if (!result.ok) throw error(400, 'THE SCOREKEEPER DOES NOT BELIEVE YOU');
	return json({ scores: await listScores(env.DIALER_DB, params.board) }, { status: 201 });
};
