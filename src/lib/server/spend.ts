/// <reference types="@cloudflare/workers-types" />

/**
 * Spend control / kill-switch module.
 *
 * Tracks per-provider monthly token spend and per-IP hourly rate limits via
 * Cloudflare KV. Provider budgets are soft fallback controls: once a provider
 * reaches its monthly cap, callers should skip it and try the next provider.
 */

import type { LlmProvider, LlmTokenUsage } from '$lib/types';

// ---------------------------------------------------------------------------
// Cost constants
// ---------------------------------------------------------------------------

export interface ModelPricing {
	input: number;
	output: number;
	cacheCreationInput?: number;
	cacheReadInput?: number;
}

/**
 * USD per 1M tokens. Unknown models intentionally fail loud so spend accounting
 * cannot silently drift when MODEL is changed.
 */
export const MODEL_PRICING_USD_PER_MILLION: Record<string, ModelPricing> = {
	'gpt-4o-mini': { input: 0.15, cacheReadInput: 0.075, output: 0.6 },
	'gpt-4o': { input: 2.5, cacheReadInput: 1.25, output: 10 },
	'gpt-4.1-mini': { input: 0.4, cacheReadInput: 0.1, output: 1.6 },
	'gpt-4.1': { input: 2, cacheReadInput: 0.5, output: 8 },
	'claude-haiku-4-5-20251001': {
		input: 1,
		output: 5,
		cacheCreationInput: 1.25,
		cacheReadInput: 0.1
	},
	'claude-sonnet-4-6': {
		input: 3,
		output: 15,
		cacheCreationInput: 3.75,
		cacheReadInput: 0.3
	},
	'claude-3-5-haiku-20241022': {
		input: 0.8,
		output: 4,
		cacheCreationInput: 1,
		cacheReadInput: 0.08
	}
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpendConfig {
	kv: KVNamespace;
	/** Max messages per IP per clock-hour (default 30). */
	rateLimitPerHour: number;
}

export interface CanRespondResult {
	allowed: boolean;
	reason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "spend:openai:2026-05" */
export function monthlySpendKey(provider: LlmProvider, now: Date = new Date()): string {
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `spend:${provider}:${yyyy}-${mm}`;
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
 * This is only a request throttle. Per-provider budget gates are checked by
 * the shared LLM client so it can fall back provider-by-provider.
 */
export async function canRespond(config: SpendConfig, ip: string): Promise<CanRespondResult> {
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
 * Call this when a message is accepted.
 */
export async function recordMessage(kv: KVNamespace, ip: string): Promise<void> {
	const rateKey = rateLimitKey(ip);
	const rateRaw = await kv.get(rateKey);
	const rateCount = rateRaw ? parseInt(rateRaw, 10) : 0;
	const ttl = secondsUntilNextHour();

	await kv.put(rateKey, String(rateCount + 1), { expirationTtl: ttl });
}

export function getModelPricing(model: string): ModelPricing {
	const pricing = MODEL_PRICING_USD_PER_MILLION[model];
	if (!pricing) {
		throw new Error(`No token pricing configured for model "${model}"`);
	}
	return pricing;
}

export function calculateTokenCostUsd(usage: LlmTokenUsage): number {
	const pricing = getModelPricing(usage.model);
	return (
		(usage.inputTokens * pricing.input) / 1_000_000 +
		(usage.outputTokens * pricing.output) / 1_000_000 +
		((usage.cacheCreationInputTokens ?? 0) * (pricing.cacheCreationInput ?? pricing.input * 1.25)) /
			1_000_000 +
		((usage.cacheReadInputTokens ?? 0) * (pricing.cacheReadInput ?? pricing.input * 0.1)) /
			1_000_000
	);
}

/**
 * Record tokens consumed after a response has been generated.
 * Converts the token count to USD and adds it to the monthly spend counter.
 */
export async function recordTokens(kv: KVNamespace, usage: LlmTokenUsage): Promise<number> {
	const key = monthlySpendKey(usage.provider);
	const raw = await kv.get(key);
	const current = raw ? parseFloat(raw) : 0;
	const cost = calculateTokenCostUsd(usage);
	await kv.put(key, String(current + cost));
	return cost;
}

/**
 * Return the current monthly spend in USD for a provider.
 */
export async function getMonthlySpend(kv: KVNamespace, provider: LlmProvider): Promise<number> {
	const raw = await kv.get(monthlySpendKey(provider));
	return raw ? parseFloat(raw) : 0;
}

export async function isProviderOverBudget(
	kv: KVNamespace,
	provider: LlmProvider,
	monthlyBudget: number
): Promise<boolean> {
	if (!Number.isFinite(monthlyBudget)) return false;
	const spend = await getMonthlySpend(kv, provider);
	return spend >= monthlyBudget;
}
