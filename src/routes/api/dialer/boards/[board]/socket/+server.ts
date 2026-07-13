import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPublicBoard } from '$lib/server/dialer/boards';
import { dialerEnv, withBoardNode } from '$lib/server/dialer/guard';
import { validateSession } from '$lib/server/dialer/session';

/**
 * WebSocket upgrade into a board's DialerBoardNode. The browser WebSocket API
 * can't set an Authorization header, so the session token rides `?token=`.
 * The route authenticates against D1, then forwards the upgrade with the
 * handle attached — the DO trusts X-Dialer-Handle from this hop only.
 */
export const GET: RequestHandler = async ({ params, request, url, platform }) => {
	const env = dialerEnv(platform);

	if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
		throw error(426, 'EXPECTED WEBSOCKET');
	}
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	const handle = await validateSession(
		env.DIALER_DB,
		url.searchParams.get('token') ?? '',
		new Date()
	);
	if (!handle) throw error(401, 'NO CARRIER');

	const headers = new Headers(request.headers);
	headers.set('X-Dialer-Handle', handle);
	const node = env.DIALER_BOARD_NODE.get(env.DIALER_BOARD_NODE.idFromName(params.board));
	return withBoardNode(() => node.fetch(new Request(request, { headers })));
};
