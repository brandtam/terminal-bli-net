/**
 * Entry for the test worker (test/wrangler.jsonc `main`) — exports the DO
 * class so miniflare can host it. Tests drive everything through bindings;
 * the default fetch handler is never the subject.
 */
export { DialerBoardNode } from '../board-node';

export default {
	fetch(): Response {
		return new Response('dialer test worker', { status: 404 });
	}
};
