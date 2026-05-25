import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Subscribe endpoint — currently disabled.
 *
 * ReminderAgent is a Durable Object that can't run on Cloudflare Pages
 * (adapter-cloudflare doesn't export DO classes). This endpoint will be
 * re-enabled once the DO is deployed as a separate Worker with a service
 * binding.
 */
export const POST: RequestHandler = async () => {
	throw error(501, 'Subscriptions are not yet available');
};
