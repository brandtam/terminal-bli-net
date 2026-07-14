import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPublicBoard } from '$lib/server/dialer/boards';
import { asString, dialerEnv, requireSession } from '$lib/server/dialer/guard';
import {
	createPost,
	listPosts,
	setPostVisible,
	softDeletePost,
	BODY_MAX_CHARS
} from '$lib/server/dialer/topics';
import { moderateText } from '$lib/server/dialer/moderation';

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

	const now = new Date();
	const result = await createPost(
		env.DIALER_DB,
		params.board,
		topicId(params.topic),
		handle,
		asString(body.body),
		now,
		true // hidden until moderation clears it — never fail open
	);
	if (!result.ok) {
		if (result.reason === 'no-topic') throw error(404, 'NO SUCH TOPIC');
		if (result.reason === 'invalid-body')
			throw error(400, `SAY SOMETHING (UNDER ${BODY_MAX_CHARS} CHARS)`);
		throw error(429, 'ONE POST A MINUTE. THE DRIVE IS OLD.');
	}

	const verdict = await moderateText(env, 'BBS post', asString(body.body));
	if (verdict === 'reject') {
		await softDeletePost(env.DIALER_DB, result.postId, now);
		throw error(403, 'THE SYSOP HAS SUSPENDED POSTING PRIVILEGES FOR THIS MESSAGE.');
	}
	if (verdict === 'ok') await setPostVisible(env.DIALER_DB, result.postId);
	return json({ postId: result.postId, held: verdict === 'unavailable' }, { status: 201 });
};
