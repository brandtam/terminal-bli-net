import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loginCaller } from '$lib/server/dialer/auth';
import { mintSession } from '$lib/server/dialer/session';
import { dialerEnv } from '$lib/server/dialer/guard';

interface LoginBody {
	handle?: string;
	password?: string;
}

/**
 * Log in with handle + password. Every failure — unknown handle, bad
 * password, canon handle, brute-force lock — answers the same 401 NO CARRIER,
 * so nothing about an account leaks. Success mints a fresh session token.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const env = dialerEnv(platform);

	let body: LoginBody;
	try {
		body = (await request.json()) as LoginBody;
	} catch {
		throw error(400, 'BAD REQUEST');
	}

	const now = new Date();
	const result = await loginCaller(env.DIALER_DB, body.handle ?? '', body.password ?? '', now);
	if (!result.ok) throw error(401, 'NO CARRIER');

	const session = await mintSession(env.DIALER_DB, result.handle, now);
	return json({ handle: result.handle, token: session.token, expiresAt: session.expiresAt });
};
