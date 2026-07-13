import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPublicBoard } from '$lib/server/dialer/boards';
import { asString, dialerEnv, requireSession } from '$lib/server/dialer/guard';
import {
	createTopic,
	listTopics,
	BODY_MAX_CHARS,
	TITLE_MAX_CHARS,
	TITLE_MIN_CHARS
} from '$lib/server/dialer/topics';

/** The board's topic index: pinned canon first, then community by activity. */
export const GET: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	await requireSession(env, request);
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	return json({ topics: await listTopics(env.DIALER_DB, params.board) });
};

interface NewTopicBody {
	section?: unknown;
	title?: unknown;
	body?: unknown;
}

/** Start a topic (with its first post). Refusals answer in-fiction. */
export const POST: RequestHandler = async ({ params, request, platform }) => {
	const env = dialerEnv(platform);
	const handle = await requireSession(env, request);
	if (!isPublicBoard(params.board)) throw error(404, 'NO SUCH BOARD');

	let body: NewTopicBody;
	try {
		body = (await request.json()) as NewTopicBody;
	} catch {
		throw error(400, 'BAD REQUEST');
	}

	const result = await createTopic(
		env.DIALER_DB,
		params.board,
		handle,
		{ section: asString(body.section), title: asString(body.title), body: asString(body.body) },
		new Date()
	);
	if (!result.ok) {
		if (result.reason === 'invalid-section') throw error(400, 'NO SUCH SECTION');
		if (result.reason === 'invalid-title')
			throw error(400, `TITLE MUST BE ${TITLE_MIN_CHARS}-${TITLE_MAX_CHARS} CHARS`);
		if (result.reason === 'invalid-body')
			throw error(400, `SAY SOMETHING (UNDER ${BODY_MAX_CHARS} CHARS)`);
		throw error(429, 'ONE POST A MINUTE. THE DRIVE IS OLD.');
	}
	return json({ topicId: result.topicId, postId: result.postId }, { status: 201 });
};
