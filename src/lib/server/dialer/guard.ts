/**
 * Route-side guards for /api/dialer/*. This module imports @sveltejs/kit, so
 * only +server.ts files may use it — the worker entry graph (cron dispatch, DO
 * barrel) stays on env.ts and friends.
 */
import { error } from '@sveltejs/kit';
import { isForcedLocal, type DialerEnv } from './env';
import { validateSession } from './session';

/**
 * The Dialer env, or a 503 that sends clients into LOCAL MODE — either the
 * bindings are missing (plain `pnpm dev`, no cloud resources) or the
 * DIALER_FORCE_LOCAL kill switch is on.
 */
export function dialerEnv(platform: Readonly<App.Platform> | undefined): DialerEnv {
	const env = platform?.env;
	if (!env?.DIALER_DB || isForcedLocal(env)) {
		throw error(503, 'LOCAL MODE — LINE NOISE ON THE TRUNK');
	}
	return env;
}

/**
 * Run a DialerBoardNode interaction, degrading failures to the in-fiction 503.
 * The namespace binding exists wherever the config loads, but invoking it can
 * still fail — most notably under plain `pnpm dev`, where getPlatformProxy
 * cannot host same-worker DO classes (docs/adr/0008 amendment). Clients treat
 * the 503 as LOCAL MODE; the real error goes to the log.
 */
export async function withBoardNode<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (err) {
		console.error('[dialer] board node unavailable', err);
		throw error(503, 'LOCAL MODE — LINE NOISE ON THE TRUNK');
	}
}

/** The authenticated handle behind `Authorization: Bearer <token>`, or 401. */
export async function requireSession(
	env: DialerEnv,
	request: Request,
	now: Date = new Date()
): Promise<string> {
	const auth = request.headers.get('Authorization') ?? '';
	const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
	const handle = token ? await validateSession(env.DIALER_DB, token, now) : null;
	if (!handle) throw error(401, 'NO CARRIER');
	return handle;
}
