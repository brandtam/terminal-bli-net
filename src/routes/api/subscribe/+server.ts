import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env) {
		throw error(500, 'Platform bindings not available');
	}

	const body = (await request.json()) as { email: string; timezone: string; shows: string[] };
	const { email, timezone, shows } = body;

	if (!email || typeof email !== 'string' || !email.includes('@')) {
		throw error(400, 'Invalid email address');
	}

	if (!shows || !Array.isArray(shows) || shows.length === 0) {
		throw error(400, 'Must subscribe to at least one show');
	}

	try {
		const id = platform.env.REMINDER_AGENT.idFromName('singleton');
		const stub = platform.env.REMINDER_AGENT.get(id);
		const response = await stub.fetch(new Request('https://internal/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, timezone: timezone || 'America/New_York', shows })
		}));

		if (!response.ok) {
			throw error(response.status, await response.text());
		}

		return json({ ok: true });
	} catch (e) {
		throw error(500, `Subscription failed: ${e}`);
	}
};
