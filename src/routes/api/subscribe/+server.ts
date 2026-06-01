import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateChatTimezone } from '$lib/server/chat-session';
import { loadPublicContentCatalog } from '$lib/server/content-catalog';

const MAX_SUBSCRIPTIONS = 50;
const DEFAULT_SUBSCRIBE_RATE_LIMIT_PER_HOUR = 5;

interface SubscribePayload {
	email: string;
	timezone: string;
	shows: string[];
}

interface SubscribeRouteEnv {
	KV: KVNamespace;
	REMINDER_SERVICE?: Fetcher;
	REMINDER_SUBSCRIBE_RATE_LIMIT_PER_HOUR?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateEmail(raw: unknown): string {
	if (typeof raw !== 'string') {
		throw error(400, 'email is required');
	}
	const email = raw.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw error(400, 'email is invalid');
	}
	return email;
}

function validateShows(raw: unknown): string[] {
	if (!Array.isArray(raw)) {
		throw error(400, 'shows must be an array');
	}
	const shows = raw.map((show) => (typeof show === 'string' ? show.trim() : '')).filter(Boolean);
	if (shows.length === 0) {
		throw error(400, 'shows must include at least one show');
	}
	if (shows.length > MAX_SUBSCRIPTIONS) {
		throw error(400, `shows exceeds max of ${MAX_SUBSCRIPTIONS}`);
	}
	return [...new Set(shows)];
}

function parseSubscribePayload(raw: unknown): SubscribePayload {
	if (!isRecord(raw)) {
		throw error(400, 'Request body must be a JSON object');
	}

	let timezone: string;
	try {
		timezone = validateChatTimezone(raw.timezone);
	} catch (err) {
		throw error(400, err instanceof Error ? err.message : 'timezone is invalid');
	}

	return {
		email: validateEmail(raw.email),
		timezone,
		shows: validateShows(raw.shows)
	};
}

function validateKnownShows(shows: string[]): void {
	const catalog = loadPublicContentCatalog();
	const knownShowSlugs = new Set(catalog.groups.map((show) => show.slug));
	for (const show of shows) {
		if (!knownShowSlugs.has(show)) {
			throw error(400, `show "${show}" not found`);
		}
	}
}

function subscribeRateLimitKey(ip: string, now: Date = new Date()): string {
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(now.getUTCDate()).padStart(2, '0');
	const hh = String(now.getUTCHours()).padStart(2, '0');
	return `subscribe-rate:${ip}:${yyyy}-${mm}-${dd}-${hh}`;
}

function secondsUntilNextHour(now: Date = new Date()): number {
	const nextHour = new Date(now);
	nextHour.setUTCMinutes(0, 0, 0);
	nextHour.setUTCHours(nextHour.getUTCHours() + 1);
	return Math.ceil((nextHour.getTime() - now.getTime()) / 1000);
}

function resolveSubscribeRateLimit(raw: string | undefined): number {
	if (!raw) return DEFAULT_SUBSCRIBE_RATE_LIMIT_PER_HOUR;
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SUBSCRIBE_RATE_LIMIT_PER_HOUR;
	return parsed;
}

async function enforceSubscribeRateLimit(env: SubscribeRouteEnv, ip: string): Promise<void> {
	const limit = resolveSubscribeRateLimit(env.REMINDER_SUBSCRIBE_RATE_LIMIT_PER_HOUR);
	if (limit === 0) return;

	const key = subscribeRateLimitKey(ip);
	const raw = await env.KV.get(key);
	const parsedCurrent = raw ? Number.parseInt(raw, 10) : 0;
	const current = Number.isFinite(parsedCurrent) && parsedCurrent >= 0 ? parsedCurrent : 0;
	if (current >= limit) {
		throw error(
			429,
			`Rate limit exceeded (${limit} subscription attempts/hour). Please wait and try again.`
		);
	}

	await env.KV.put(key, String(current + 1), { expirationTtl: secondsUntilNextHour() });
}

export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
	const env = platform?.env;
	if (!env?.REMINDER_SERVICE) {
		throw error(503, 'Reminder service is not configured');
	}
	if (!env.KV) {
		throw error(503, 'Subscription rate limit storage is not configured');
	}

	await enforceSubscribeRateLimit(env, getClientAddress());

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const payload = parseSubscribePayload(body);
	validateKnownShows(payload.shows);
	const upstream = await env.REMINDER_SERVICE.fetch('https://reminder.internal/subscribe', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!upstream.ok) {
		let message = 'Reminder service rejected the subscription';
		try {
			const upstreamBody = (await upstream.json()) as { error?: unknown };
			if (typeof upstreamBody.error === 'string') message = upstreamBody.error;
		} catch {
			// Keep the generic message when the service returns non-JSON.
		}
		throw error(upstream.status >= 500 ? 502 : upstream.status, message);
	}

	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			'content-type': upstream.headers.get('content-type') ?? 'application/json'
		}
	});
};
