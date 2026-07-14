import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPublicBoard } from '$lib/server/dialer/boards';
import { asString, dialerEnv, requireSession } from '$lib/server/dialer/guard';
import {
	createTopic,
	listTopics,
	setPostVisible,
	softDeletePost,
	BODY_MAX_CHARS,
	TITLE_MAX_CHARS,
	TITLE_MIN_CHARS
} from '$lib/server/dialer/topics';
import { moderateText } from '$lib/server/dialer/moderation';

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

	const now = new Date();
	const result = await createTopic(
		env.DIALER_DB,
		params.board,
		handle,
		{ section: asString(body.section), title: asString(body.title), body: asString(body.body) },
		now,
		true // hidden until moderation clears it — never fail open
	);
	if (!result.ok) {
		if (result.reason === 'invalid-section') throw error(400, 'NO SUCH SECTION');
		if (result.reason === 'invalid-title')
			throw error(400, `TITLE MUST BE ${TITLE_MIN_CHARS}-${TITLE_MAX_CHARS} CHARS`);
		if (result.reason === 'invalid-body')
			throw error(400, `SAY SOMETHING (UNDER ${BODY_MAX_CHARS} CHARS)`);
		throw error(429, 'ONE POST A MINUTE. THE DRIVE IS OLD.');
	}

	const verdict = await moderateText(
		env,
		'new BBS topic (title, then body)',
		`${asString(body.title)}\n${asString(body.body)}`
	);
	if (verdict === 'reject') {
		await softDeletePost(env.DIALER_DB, result.postId, now);
		throw error(403, 'THE SYSOP HAS SUSPENDED POSTING PRIVILEGES FOR THIS MESSAGE.');
	}
	if (verdict === 'ok') await setPostVisible(env.DIALER_DB, result.postId);
	// Seam down: the post stays hidden for the nightly re-audit; `held` lets the
	// client explain in-fiction ("the sysop reviews new messages overnight").
	return json(
		{ topicId: result.topicId, postId: result.postId, held: verdict === 'unavailable' },
		{ status: 201 }
	);
};
