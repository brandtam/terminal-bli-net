/**
 * Typed client for /api/dialer/* with the LOCAL MODE degradation contract
 * (docs/adr/0008): any network failure or 5xx means the trunk is unreachable
 * and the caller drops to canon-only content — never a soft-lock. 401 means
 * the line answered but the session is no good; other 4xx carry an in-fiction
 * refusal message straight from the route.
 */
import { getTurnstileToken } from '$lib/turnstile-client';

export type Session = { handle: string; token: string; expiresAt: number };

/** A topic as the board serves it — canon and community through one shape. */
export type LiveTopic = {
	id: number;
	slug: string | null;
	section: string;
	title: string;
	author: string;
	createdAt: number;
	postCount: number;
	lastPostAt: number;
	canon: boolean;
	pinned: boolean;
};

export type LivePost = {
	id: number;
	author: string;
	body: string;
	createdAt: number;
	canon: boolean;
};

export type ApiError =
	| { kind: 'local' } // no line: network failure, 503, any 5xx
	| { kind: 'no-carrier' } // 401: bad login or dead session
	| { kind: 'refused'; message: string }; // other 4xx, message is in-fiction

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

/** A line that answers nothing for this long is dead air, not a slow host.
 * The abort lands in the catch below → LOCAL MODE, so a stalled request can
 * never strand a caller on a wait screen. */
export const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(
	path: string,
	init: { method?: string; token?: string; body?: unknown } = {}
): Promise<ApiResult<T>> {
	// A plain AbortController + setTimeout (not AbortSignal.timeout) so fake
	// timers can drive the deadline in tests. The signal also covers the body
	// read, so the timer lives until the response is fully consumed.
	const abort = new AbortController();
	const deadline = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
	try {
		let response: Response;
		try {
			response = await fetch(`/api/dialer/${path}`, {
				method: init.method ?? 'GET',
				headers: {
					...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
					...(init.token ? { Authorization: `Bearer ${init.token}` } : {})
				},
				...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
				signal: abort.signal
			});
		} catch {
			return { ok: false, error: { kind: 'local' } };
		}

		if (response.ok) {
			try {
				return { ok: true, value: (await response.json()) as T };
			} catch {
				return { ok: false, error: { kind: 'local' } };
			}
		}
		if (response.status === 401) return { ok: false, error: { kind: 'no-carrier' } };
		if (response.status >= 500) return { ok: false, error: { kind: 'local' } };

		let message = 'REFUSED';
		try {
			message = ((await response.json()) as { message?: string }).message ?? message;
		} catch {
			// keep the fallback
		}
		return { ok: false, error: { kind: 'refused', message } };
	} finally {
		clearTimeout(deadline);
	}
}

/**
 * Is the trunk live, and does the stored session still hold? Ride the topics
 * route — the exact surface this call will use (deliberately not the
 * DO-backed status route: under plain `pnpm dev` D1 answers but same-worker
 * DOs cannot, and boards work fine there). 200 = line + session good, 401 =
 * line good (log in), anything else (503 kill switch, network, 404 for a
 * system with no live board) = LOCAL MODE. Fired during the handshake so the
 * answer is ready by CONNECT.
 */
export async function probeLine(
	board: string,
	token: string | undefined
): Promise<'session' | 'login' | 'local'> {
	const result = await request(`boards/${board}/topics`, { token });
	if (result.ok) return token ? 'session' : 'login';
	return result.error.kind === 'no-carrier' ? 'login' : 'local';
}

export function login(handle: string, password: string): Promise<ApiResult<Session>> {
	return request('auth/login', { method: 'POST', body: { handle, password } });
}

/**
 * Claim a handle. Solves a Turnstile challenge first when the site key is
 * configured (same seam as the chat gate); a challenge that won't load is
 * sent without a token and left to the server's verdict.
 */
export async function register(
	handle: string,
	password: string,
	questionnaire: Record<string, string>,
	turnstileSiteKey: string | undefined
): Promise<ApiResult<Session>> {
	let turnstileToken: string | null = null;
	try {
		turnstileToken = await getTurnstileToken(turnstileSiteKey);
	} catch {
		// unreachable challenge — the register route decides what that means
	}
	return request('auth/register', {
		method: 'POST',
		body: {
			handle,
			password,
			questionnaire,
			...(turnstileToken ? { turnstileToken } : {})
		}
	});
}

export async function fetchTopics(board: string, token: string): Promise<ApiResult<LiveTopic[]>> {
	const result = await request<{ topics: LiveTopic[] }>(`boards/${board}/topics`, { token });
	return result.ok ? { ok: true, value: result.value.topics } : result;
}

export async function fetchPosts(
	board: string,
	topicId: number,
	token: string
): Promise<ApiResult<LivePost[]>> {
	const result = await request<{ posts: LivePost[] }>(`boards/${board}/topics/${topicId}/posts`, {
		token
	});
	return result.ok ? { ok: true, value: result.value.posts } : result;
}

export function submitTopic(
	board: string,
	token: string,
	input: { section: string; title: string; body: string }
): Promise<ApiResult<{ topicId: number; postId: number }>> {
	return request(`boards/${board}/topics`, { method: 'POST', token, body: input });
}

export function submitReply(
	board: string,
	topicId: number,
	token: string,
	body: string
): Promise<ApiResult<{ postId: number }>> {
	return request(`boards/${board}/topics/${topicId}/posts`, {
		method: 'POST',
		token,
		body: { body }
	});
}
