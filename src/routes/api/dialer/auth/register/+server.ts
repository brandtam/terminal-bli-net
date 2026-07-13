import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyTurnstileTokenResult } from '$lib/server/turnstile';
import { registerCaller } from '$lib/server/dialer/auth';
import { mintSession } from '$lib/server/dialer/session';
import { dialerEnv } from '$lib/server/dialer/guard';

interface RegisterBody {
	handle?: string;
	password?: string;
	turnstileToken?: string;
	questionnaire?: unknown;
}

/**
 * Claim a handle. Turnstile-gated (same seam and same fail-open semantics as
 * the chat gate: no secret configured → admit; siteverify unreachable → admit
 * and log). Registration grants the 3 starter ratio credits and answers with a
 * fresh session token.
 */
export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
	const env = dialerEnv(platform);

	let body: RegisterBody;
	try {
		body = (await request.json()) as RegisterBody;
	} catch {
		throw error(400, 'BAD REQUEST');
	}

	if (env.TURNSTILE_SECRET) {
		const verdict = await verifyTurnstileTokenResult(
			env.TURNSTILE_SECRET,
			body.turnstileToken ?? '',
			getClientAddress()
		);
		if (verdict === 'invalid') throw error(403, 'REGISTRATION REFUSED');
		if (verdict === 'unavailable') {
			console.error('[dialer] turnstile siteverify unavailable; admitting registration');
		}
	}

	const now = new Date();
	const result = await registerCaller(
		env.DIALER_DB,
		body.handle ?? '',
		body.password ?? '',
		body.questionnaire === undefined ? null : JSON.stringify(body.questionnaire),
		now
	);

	if (!result.ok) {
		if (result.reason === 'taken') throw error(409, 'HANDLE ALREADY IN USE');
		if (result.reason === 'invalid-password') throw error(400, 'PASSWORD MUST BE 4-64 CHARS');
		if (result.reason === 'invalid-questionnaire') throw error(400, 'QUESTIONNAIRE TOO LONG');
		throw error(400, 'HANDLE MUST BE 2-16 CHARS: A-Z 0-9 . -');
	}

	const session = await mintSession(env.DIALER_DB, result.handle, now);
	return json({ handle: result.handle, token: session.token, expiresAt: session.expiresAt });
};
