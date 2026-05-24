import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env) {
		throw error(500, 'Platform bindings not available');
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	const { email, timezone, shows } = body as {
		email?: string;
		timezone?: string;
		shows?: string[];
	};

	if (!email || !EMAIL_RE.test(email)) {
		throw error(400, 'A valid email address is required');
	}

	if (!timezone || typeof timezone !== 'string') {
		throw error(400, 'A timezone string is required');
	}

	if (!shows || !Array.isArray(shows) || shows.length === 0) {
		throw error(400, 'At least one show subscription is required');
	}

	const id = platform.env.REMINDER_AGENT.idFromName('singleton');
	const stub = platform.env.REMINDER_AGENT.get(id);

	await (stub as unknown as { subscribe: (e: string, tz: string, s: string[]) => Promise<void> })
		.subscribe(email, timezone, shows);

	return json({ ok: true });
};
