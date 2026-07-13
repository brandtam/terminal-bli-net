import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPublicBoard } from '$lib/server/dialer/boards';
import { dialerEnv, requireSession, withBoardNode } from '$lib/server/dialer/guard';

/** Board vitals from its DialerBoardNode: caller counter, last caller, who's online, busy. */
export const GET: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	await requireSession(env, request);

	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	const node = env.DIALER_BOARD_NODE.get(env.DIALER_BOARD_NODE.idFromName(params.board));
	return json(await withBoardNode(() => node.status()));
};
