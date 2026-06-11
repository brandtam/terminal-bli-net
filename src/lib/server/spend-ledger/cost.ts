import type { LlmTokenUsage } from '$lib/types';
import { calculateTokenCostUsd, getModelPricing } from '../spend';

/**
 * Cost helpers for the Spend Ledger. Reuses the canonical pricing table in
 * `spend.ts` so there is exactly one source of truth for model prices.
 */

/**
 * Upper-bound dollar cost for a request before it runs. Prices every input and
 * output token at full (non-cached) rate so the reservation can never be too
 * small. Throws on an unknown model — spend must never silently under-reserve.
 */
export function worstCaseCostUsd(
	model: string,
	maxInputTokens: number,
	maxOutputTokens: number
): number {
	const pricing = getModelPricing(model);
	return (
		(maxInputTokens * pricing.input) / 1_000_000 + (maxOutputTokens * pricing.output) / 1_000_000
	);
}

/** Actual settled dollar cost from real token usage (cache-aware). */
export function actualCostUsd(usage: LlmTokenUsage): number {
	return calculateTokenCostUsd(usage);
}
