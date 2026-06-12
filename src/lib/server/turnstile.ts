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

import { signHmacBase64Url, timingSafeEqual } from './hmac';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SESSION_TTL_MS = 30 * 60 * 1000;
const SESSION_PREFIX = 'chat-session';
const SIG_BYTES = 24;

async function sign(secret: string, payload: string): Promise<string> {
	return signHmacBase64Url(secret, payload, SIG_BYTES);
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

export type TurnstileVerificationResult = 'valid' | 'invalid' | 'unavailable';

async function verifyTurnstileTokenOnce(
	secret: string,
	token: string,
	remoteIp: string | undefined,
	fetchImpl: typeof fetch = fetch
): Promise<TurnstileVerificationResult> {
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	if (remoteIp) body.append('remoteip', remoteIp);

	try {
		const response = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
		if (!response.ok) return 'unavailable';
		const data = (await response.json()) as SiteverifyResponse;
		return data.success === true ? 'valid' : 'invalid';
	} catch (err) {
		console.error('[turnstile] siteverify failed', err);
		return 'unavailable';
	}
}

/** Validate a Turnstile token with Cloudflare's siteverify endpoint. */
export async function verifyTurnstileTokenResult(
	secret: string,
	token: string,
	remoteIp: string | undefined,
	fetchImpl: typeof fetch = fetch
): Promise<TurnstileVerificationResult> {
	const first = await verifyTurnstileTokenOnce(secret, token, remoteIp, fetchImpl);
	if (first !== 'unavailable') return first;
	return verifyTurnstileTokenOnce(secret, token, remoteIp, fetchImpl);
}

/** Boolean compatibility wrapper for callers that only need valid/invalid. */
export async function verifyTurnstileToken(
	secret: string,
	token: string,
	remoteIp: string | undefined,
	fetchImpl: typeof fetch = fetch
): Promise<boolean> {
	return (await verifyTurnstileTokenResult(secret, token, remoteIp, fetchImpl)) === 'valid';
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

	if (input.turnstileToken) {
		const tokenResult = await verifyTurnstileTokenResult(
			secret,
			input.turnstileToken,
			input.remoteIp,
			fetchImpl
		);
		if (tokenResult === 'valid') {
			return { ok: true, issuedSessionToken: await issueSessionToken(secret, now) };
		}
		if (tokenResult === 'unavailable') {
			console.error('[turnstile] siteverify unavailable; admitting token-bearing request');
			return { ok: true };
		}
	}

	return { ok: false };
}
