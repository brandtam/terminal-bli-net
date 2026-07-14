import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dialerEnv, requireSession } from '$lib/server/dialer/guard';
import { claimDailySweep } from '$lib/server/dialer/sweep';

/**
 * Claim tonight's Autodialer block. The sweep itself runs client-side; this
 * stamp is what makes "one block a night" true across reloads and devices.
 * LOCAL MODE degrades to the client's own check (guard 503s before here).
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const env = dialerEnv(platform);
	const handle = await requireSession(env, request);

	if (!(await claimDailySweep(env.DIALER_DB, handle, new Date()))) {
		throw error(429, 'ONE SWEEP A NIGHT. THE PHONE COMPANY NOTICES.');
	}
	return json({ ok: true });
};
