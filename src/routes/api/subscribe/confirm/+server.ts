import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

interface ReminderServicePlatform {
	env: {
		REMINDER_SERVICE?: Fetcher;
	};
}

async function upstreamErrorMessage(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { error?: unknown };
		if (typeof body.error === 'string' && body.error.trim()) return body.error;
	} catch {
		// Keep the generic message for non-JSON worker responses.
	}
	return 'Reminder service rejected the confirmation';
}

async function confirmSubscription(
	url: URL,
	platform: ReminderServicePlatform | undefined
): Promise<Response> {
	const token = url.searchParams.get('token') ?? '';
	if (!TOKEN_RE.test(token)) {
		throw error(400, 'confirmation token is invalid');
	}

	if (!platform?.env?.REMINDER_SERVICE) {
		throw error(503, 'Reminder service is not configured');
	}

	const upstreamUrl = new URL('https://reminder.internal/confirm');
	upstreamUrl.searchParams.set('token', token);
	const upstream = await platform.env.REMINDER_SERVICE.fetch(upstreamUrl, { method: 'POST' });

	if (!upstream.ok) {
		throw error(
			upstream.status >= 500 ? 502 : upstream.status,
			await upstreamErrorMessage(upstream)
		);
	}

	return new Response('Subscription confirmed. You will receive reminders for subscribed shows.', {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}

export const GET: RequestHandler = async ({ url, platform }) => confirmSubscription(url, platform);
export const POST: RequestHandler = async ({ url, platform }) => confirmSubscription(url, platform);
