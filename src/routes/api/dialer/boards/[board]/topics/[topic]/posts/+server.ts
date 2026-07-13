import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPublicBoard } from '$lib/server/dialer/boards';
import { asString, dialerEnv, requireSession } from '$lib/server/dialer/guard';
import { createPost, listPosts, BODY_MAX_CHARS } from '$lib/server/dialer/topics';

/** Parse the [topic] segment; anything non-numeric is simply no topic. */
function topicId(raw: string): number {
	return /^\d+$/.test(raw) ? Number(raw) : -1;
}

/** A topic's thread, canon and community posts interleaved by date. */
export const GET: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	await requireSession(env, request);
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	const posts = await listPosts(env.DIALER_DB, params.board, topicId(params.topic));
	if (posts === null) throw error(404, 'NO SUCH TOPIC');
	return json({ posts });
};

interface ReplyBody {
	body?: unknown;
}

/** Reply to a topic. Refusals answer in-fiction. */
export const POST: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	const handle = await requireSession(env, request);
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	let body: ReplyBody;
	try {
		body = (await request.json()) as ReplyBody;
	} catch {
		throw error(400, 'BAD REQUEST');
	}

	const result = await createPost(
		env.DIALER_DB,
		params.board,
		topicId(params.topic),
		handle,
		asString(body.body),
		new Date()
	);
	if (!result.ok) {
		if (result.reason === 'no-topic') throw error(404, 'NO SUCH TOPIC');
		if (result.reason === 'invalid-body')
			throw error(400, `SAY SOMETHING (UNDER ${BODY_MAX_CHARS} CHARS)`);
		throw error(429, 'ONE POST A MINUTE. THE DRIVE IS OLD.');
	}
	return json({ postId: result.postId }, { status: 201 });
};
