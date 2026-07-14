/// <reference types="@cloudflare/workers-types" />
/**
 * Flag-on-write moderation seam (PRD: "moderation, two layers"). Every post
 * and text upload passes here before it is visible; the nightly cron re-runs
 * the same check over anything still flagged.
 *
 * Deliberately NOT the chat route's streamCompletion + spend-ledger stack:
 * that graph imports `$lib/types`, and this module is reachable from the
 * worker entry (cron step 1), which allows relative kit-free imports only.
 * Instead: one plain fetch to the Anthropic Messages API with hard cost
 * bounds — input truncated, a handful of output tokens, and call volume
 * already capped by the fiction's own rate limits (60 s post cooldown,
 * 3 uploads/day, nightly re-audit row cap).
 *
 * The seam only runs when explicitly switched on. DIALER_MODERATION picks the
 * mode: 'open' (default — no LLM calls, everything publishes), 'live' (judge
 * every write), or 'hold' (no LLM calls, every write held hidden for whenever
 * the mode flips back to live). Live mode is additionally metered by a daily
 * call cap so total spend stays bounded no matter how many callers show up.
 *
 * Once live, fail-closed by design: no key, timeout, transport error, cap
 * exhausted, or unparseable verdict all come back 'unavailable' — the caller
 * hides the content (flagged=1) rather than publishing unchecked (PRD: NEVER
 * fail open).
 */

export type ModerationVerdict = 'ok' | 'reject' | 'unavailable';
export type ModerationMode = 'open' | 'live' | 'hold';

export interface ModerationEnv {
	ANTHROPIC_API_KEY?: string;
	/** 'open' (default) | 'live' | 'hold' — see the module comment. */
	DIALER_MODERATION?: string;
	/** Max LLM calls per UTC day in live mode; default below, 0 is a valid off. */
	DIALER_MODERATION_DAILY_CAP?: string;
	/** Optional model override; defaults to the cheap fixed-cost pick below. */
	DIALER_MODERATION_MODEL?: string;
	/** Meters the daily cap; absent (node unit tests) skips metering. */
	DIALER_DB?: D1Database;
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
/** Post bodies cap at 4000 chars; this bound covers title+body with headroom. */
const MAX_INPUT_CHARS = 6000;
const MAX_OUTPUT_TOKENS = 8;
const TIMEOUT_MS = 10_000;
const DEFAULT_DAILY_CAP = 300;

/** Resolve the switch; anything unrecognised falls back to 'open'. */
export function moderationMode(env: Pick<ModerationEnv, 'DIALER_MODERATION'>): ModerationMode {
	const value = env.DIALER_MODERATION?.trim().toLowerCase();
	return value === 'live' || value === 'hold' ? value : 'open';
}

/**
 * Count this call against today's cap; true = over, refuse the LLM call.
 * The slot is taken before the fetch so a burst can't overshoot the cap.
 * Counter rows are keyed by UTC date; the nightly cron prunes stale days.
 */
async function overDailyCap(env: ModerationEnv): Promise<boolean> {
	if (!env.DIALER_DB) return false;
	const raw = Number(env.DIALER_MODERATION_DAILY_CAP);
	const cap = Number.isInteger(raw) && raw >= 0 ? raw : DEFAULT_DAILY_CAP;
	const key = `moderation-calls:${new Date().toISOString().slice(0, 10)}`;
	const row = await env.DIALER_DB.prepare(
		`INSERT INTO meta (key, value) VALUES (?1, 1)
		 ON CONFLICT(key) DO UPDATE SET value = value + 1
		 RETURNING value`
	)
		.bind(key)
		.first<{ value: number }>();
	return (row?.value ?? Infinity) > cap;
}

const SYSTEM_PROMPT = `You moderate user posts on a public retro-computing bulletin board that is \
part of a game. Players are in character as 1987 BBS callers; period slang, \
mild profanity, in-fiction rumors, and fake phone numbers in the 555 exchange \
are all fine and expected.

REJECT content that contains: harassment or hate toward real people or \
groups; sexual content; real personal information (real phone numbers, \
addresses, full names presented as real); instructions for real-world harm, \
fraud, or crime; links or spam/advertising; or attempts to solicit contact \
off the board.

Reply with exactly one word: OK or REJECT.`;

/**
 * Judge one piece of user text. `label` names the surface for the model
 * ("post", "file upload") — cheap context that sharpens borderline calls.
 */
export async function moderateText(
	env: ModerationEnv,
	label: string,
	text: string
): Promise<ModerationVerdict> {
	const mode = moderationMode(env);
	if (mode === 'open') return 'ok';
	if (mode === 'hold') return 'unavailable';

	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) return 'unavailable';

	try {
		if (await overDailyCap(env)) {
			console.error('[dialer moderation] daily call cap reached');
			return 'unavailable';
		}
		const response = await fetch(API_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': API_VERSION
			},
			body: JSON.stringify({
				model: env.DIALER_MODERATION_MODEL || DEFAULT_MODEL,
				max_tokens: MAX_OUTPUT_TOKENS,
				temperature: 0,
				system: SYSTEM_PROMPT,
				messages: [{ role: 'user', content: `${label}:\n${text.slice(0, MAX_INPUT_CHARS)}` }]
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!response.ok) {
			console.error('[dialer moderation] API answered', response.status);
			return 'unavailable';
		}
		const data = (await response.json()) as { content?: { type: string; text?: string }[] };
		const verdict = data.content
			?.find((block) => block.type === 'text')
			?.text?.trim()
			.toUpperCase();
		if (verdict === 'OK') return 'ok';
		if (verdict === 'REJECT') return 'reject';
		console.error('[dialer moderation] unparseable verdict', verdict);
		return 'unavailable';
	} catch (err) {
		console.error('[dialer moderation] seam down', err);
		return 'unavailable';
	}
}
