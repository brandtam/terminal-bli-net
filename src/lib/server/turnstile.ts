/**
 * Turnstile Gate — the proof-of-human check in front of the chat spend path.
 *
 * Cadence (PRD decision 10): validate a Cloudflare Turnstile token on the first
 * message of a session, then issue a short-lived (30 min) signed **session
 * token** so later messages aren't re-challenged. The gate runs before the Spend
 * Ledger, so automated floods never reach the money path.
 *
 * The session token is stateless: `"<expiryMs>.<hmac>"`, signed with
 * TURNSTILE_SECRET. There is no per-user identity (the site is anonymous) — the
 * token only proves "passed Turnstile within the last 30 min". Even a shared
 * token is bounded by the exact Daily Circuit Breaker, so this is safe.
 *
 * Fail-open when unconfigured: with no TURNSTILE_SECRET (dev), the gate admits
 * everything, so local development needs no Turnstile keys.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SESSION_TTL_MS = 30 * 60 * 1000;
const SESSION_PREFIX = 'chat-session';
const ALGO = { name: 'HMAC', hash: 'SHA-256' } as const;
const SIG_BYTES = 24;

// ---------------------------------------------------------------------------
// Crypto (mirrors the HMAC pattern in email-composer.ts)
// ---------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
	const bin = [...bytes].map((byte) => String.fromCharCode(byte)).join('');
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret: string, payload: string): Promise<string> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', enc.encode(secret), ALGO, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
	return bytesToBase64Url(new Uint8Array(sig).slice(0, SIG_BYTES));
}

/** Constant-time compare of two equal-length strings. */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Session token
// ---------------------------------------------------------------------------

/** Mint a signed session token valid for 30 minutes from `now`. */
export async function issueSessionToken(secret: string, now: Date): Promise<string> {
	const expiry = now.getTime() + SESSION_TTL_MS;
	const sig = await sign(secret, `${SESSION_PREFIX}:${expiry}`);
	return `${expiry}.${sig}`;
}

/** True iff `token` is a well-formed, correctly signed, unexpired session token. */
export async function verifySessionToken(
	secret: string,
	token: string,
	now: Date
): Promise<boolean> {
	const dot = token.indexOf('.');
	if (dot <= 0) return false;
	const expiryStr = token.slice(0, dot);
	const sig = token.slice(dot + 1);

	const expiry = Number(expiryStr);
	if (!Number.isFinite(expiry) || now.getTime() >= expiry) return false;

	const expected = await sign(secret, `${SESSION_PREFIX}:${expiry}`);
	return timingSafeEqual(sig, expected);
}

// ---------------------------------------------------------------------------
// Turnstile verification
// ---------------------------------------------------------------------------

interface SiteverifyResponse {
	success?: boolean;
}

/** Validate a Turnstile token with Cloudflare's siteverify endpoint. */
export async function verifyTurnstileToken(
	secret: string,
	token: string,
	remoteIp: string | undefined,
	fetchImpl: typeof fetch = fetch
): Promise<boolean> {
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	if (remoteIp) body.append('remoteip', remoteIp);

	try {
		const response = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
		if (!response.ok) return false;
		const data = (await response.json()) as SiteverifyResponse;
		return data.success === true;
	} catch (err) {
		console.error('[turnstile] siteverify failed', err);
		return false;
	}
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export interface ChatGateInput {
	/** Fresh Turnstile token from the widget (first message of a session). */
	turnstileToken?: string;
	/** Previously issued session token (subsequent messages). */
	sessionToken?: string;
	/** Caller IP, forwarded to siteverify when available. */
	remoteIp?: string;
}

export type ChatGateResult = { ok: true; issuedSessionToken?: string } | { ok: false };

/**
 * Decide whether a chat request may proceed to the spend path.
 *
 * - No secret configured → admit (dev fail-open).
 * - Valid session token → admit, no new token needed.
 * - Valid Turnstile token → admit and mint a fresh session token.
 * - Otherwise → refuse; the client must run the challenge and retry.
 */
export async function evaluateChatGate(
	secret: string | undefined,
	input: ChatGateInput,
	now: Date,
	fetchImpl: typeof fetch = fetch
): Promise<ChatGateResult> {
	if (!secret) return { ok: true };

	if (input.sessionToken && (await verifySessionToken(secret, input.sessionToken, now))) {
		return { ok: true };
	}

	if (
		input.turnstileToken &&
		(await verifyTurnstileToken(secret, input.turnstileToken, input.remoteIp, fetchImpl))
	) {
		return { ok: true, issuedSessionToken: await issueSessionToken(secret, now) };
	}

	return { ok: false };
}
