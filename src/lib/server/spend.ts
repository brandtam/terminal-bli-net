/// <reference types="@cloudflare/workers-types" />

/**
 * Spend control / kill-switch module.
 *
 * Tracks monthly token spend, per-IP hourly rate limits, and per-session
 * message caps via Cloudflare KV.  When the monthly spend crosses the hard
 * cap the kill switch activates until the 1st of the next calendar month.
 */

// ---------------------------------------------------------------------------
// Cost constants
// ---------------------------------------------------------------------------

/**
 * Dollars per token.  We count every token at the *output* rate because
 * output tokens dominate cost for chat workloads.
 *
 * Claude 3.5 Haiku output pricing: $1.25 / 1 000 000 tokens.
 */
const DOLLARS_PER_TOKEN = 1.25 / 1_000_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpendConfig {
	kv: KVNamespace;
	/** Hard monthly spend cap in USD (default $50). */
	monthlyCap: number;
	/** Max messages per IP per clock-hour (default 30). */
	rateLimitPerHour: number;
	/** Max messages per session lifetime (default 50). */
	sessionCap: number;
}

export interface CanRespondResult {
	allowed: boolean;
	reason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "spend:2026-05" */
export function monthlySpendKey(now: Date = new Date()): string {
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `spend:${yyyy}-${mm}`;
}

/** "rate:203.0.113.42:2026-05-23-14" */
export function rateLimitKey(ip: string, now: Date = new Date()): string {
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(now.getUTCDate()).padStart(2, '0');
	const hh = String(now.getUTCHours()).padStart(2, '0');
	return `rate:${ip}:${yyyy}-${mm}-${dd}-${hh}`;
}

/**
 * Seconds remaining until the top of the next UTC hour.
 * Used as the TTL for per-IP rate limit keys so they auto-expire.
 */
function secondsUntilNextHour(now: Date = new Date()): number {
	const nextHour = new Date(now);
	nextHour.setUTCMinutes(0, 0, 0);
	nextHour.setUTCHours(nextHour.getUTCHours() + 1);
	return Math.ceil((nextHour.getTime() - now.getTime()) / 1000);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the request should be allowed to proceed.
 *
 * Checks are evaluated in this order (cheapest first):
 *   1. Per-session message cap
 *   2. Monthly spend kill-switch
 *   3. Per-IP hourly rate limit
 */
export async function canRespond(
	config: SpendConfig,
	ip: string,
	sessionId: string,
	sessionMessageCount: number
): Promise<CanRespondResult> {
	// 1. Session cap (no KV call needed)
	if (sessionMessageCount >= config.sessionCap) {
		return {
			allowed: false,
			reason: `Session message limit reached (${config.sessionCap} messages). Please start a new session.`
		};
	}

	// 2. Monthly spend kill-switch
	const spendRaw = await config.kv.get(monthlySpendKey());
	const currentSpend = spendRaw ? parseFloat(spendRaw) : 0;
	if (currentSpend >= config.monthlyCap) {
		return {
			allowed: false,
			reason: `Monthly spend cap ($${config.monthlyCap}) reached. Service resumes on the 1st of next month.`
		};
	}

	// 3. Per-IP hourly rate limit
	const rateRaw = await config.kv.get(rateLimitKey(ip));
	const currentRate = rateRaw ? parseInt(rateRaw, 10) : 0;
	if (currentRate >= config.rateLimitPerHour) {
		return {
			allowed: false,
			reason: `Rate limit exceeded (${config.rateLimitPerHour} messages/hour). Please wait and try again.`
		};
	}

	return { allowed: true };
}

/**
 * Increment the per-IP rate counter for the current clock-hour.
 * Call this when a message is accepted (before or after the LLM responds).
 */
export async function recordMessage(kv: KVNamespace, ip: string): Promise<void> {
	const key = rateLimitKey(ip);
	const raw = await kv.get(key);
	const count = raw ? parseInt(raw, 10) : 0;
	const ttl = secondsUntilNextHour();
	await kv.put(key, String(count + 1), { expirationTtl: ttl });
}

/**
 * Record tokens consumed after a response has been generated.
 * Converts the token count to USD and adds it to the monthly spend counter.
 */
export async function recordTokens(kv: KVNamespace, tokenCount: number): Promise<void> {
	const key = monthlySpendKey();
	const raw = await kv.get(key);
	const current = raw ? parseFloat(raw) : 0;
	const cost = tokenCount * DOLLARS_PER_TOKEN;
	await kv.put(key, String(current + cost));
}

/**
 * Return the current monthly spend in USD.
 */
export async function getMonthlySpend(kv: KVNamespace): Promise<number> {
	const raw = await kv.get(monthlySpendKey());
	return raw ? parseFloat(raw) : 0;
}
