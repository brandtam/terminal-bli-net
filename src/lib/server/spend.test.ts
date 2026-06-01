/// <reference types="@cloudflare/workers-types" />
/* eslint-disable no-undef */
import { describe, it, expect, beforeEach } from 'vitest';
import {
	canRespond,
	calculateTokenCostUsd,
	getMonthlySpend,
	isProviderOverBudget,
	monthlySpendKey,
	rateLimitKey,
	recordMessage,
	recordTokens,
	type SpendConfig
} from './spend';
import type { LlmTokenUsage } from '$lib/types';

interface MockKV extends KVNamespace {
	_store: Map<string, string>;
}

function createMockKV(): MockKV {
	const store = new Map<string, string>();

	return {
		_store: store,

		async get(key: string): Promise<string | null> {
			return store.get(key) ?? null;
		},

		async put(key: string, value: string): Promise<void> {
			store.set(key, value);
		},

		async delete(key: string): Promise<void> {
			store.delete(key);
		},

		async list() {
			return {
				keys: [],
				list_complete: true,
				cacheStatus: null
			} as unknown as KVNamespaceListResult<unknown, string>;
		},
		async getWithMetadata() {
			return {
				value: null,
				metadata: null,
				cacheStatus: null
			} as unknown as KVNamespaceGetWithMetadataResult<string, unknown>;
		}
	} as unknown as MockKV;
}

function defaultConfig(kv: KVNamespace, overrides?: Partial<SpendConfig>): SpendConfig {
	return {
		kv,
		rateLimitPerHour: 30,
		...overrides
	};
}

function usage(overrides?: Partial<LlmTokenUsage>): LlmTokenUsage {
	return {
		provider: 'openai',
		model: 'gpt-4o-mini',
		inputTokens: 1_000_000,
		outputTokens: 2_000_000,
		...overrides
	};
}

const TEST_IP = '203.0.113.42';

describe('monthlySpendKey', () => {
	it('formats as spend:provider:YYYY-MM', () => {
		const key = monthlySpendKey('openai', new Date('2026-05-23T14:00:00Z'));
		expect(key).toBe('spend:openai:2026-05');
	});

	it('zero-pads single-digit months', () => {
		const key = monthlySpendKey('claude', new Date('2026-01-05T00:00:00Z'));
		expect(key).toBe('spend:claude:2026-01');
	});
});

describe('rateLimitKey', () => {
	it('formats as rate:IP:YYYY-MM-DD-HH', () => {
		const key = rateLimitKey(TEST_IP, new Date('2026-05-23T14:30:00Z'));
		expect(key).toBe('rate:203.0.113.42:2026-05-23-14');
	});

	it('zero-pads single-digit hours', () => {
		const key = rateLimitKey(TEST_IP, new Date('2026-05-23T03:00:00Z'));
		expect(key).toBe('rate:203.0.113.42:2026-05-23-03');
	});
});

describe('canRespond', () => {
	let kv: MockKV;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('allows requests when the per-IP rate is within bounds', async () => {
		const config = defaultConfig(kv);
		const result = await canRespond(config, TEST_IP);
		expect(result).toEqual({ allowed: true });
	});

	it('blocks when per-IP rate limit equals the cap', async () => {
		const config = defaultConfig(kv, { rateLimitPerHour: 30 });
		kv._store.set(rateLimitKey(TEST_IP), '30');
		const result = await canRespond(config, TEST_IP);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('Rate limit exceeded');
	});

	it('does not treat monthly spend as a global kill switch', async () => {
		const config = defaultConfig(kv);
		kv._store.set(monthlySpendKey('openai'), '1000');
		const result = await canRespond(config, TEST_IP);
		expect(result.allowed).toBe(true);
	});
});

describe('calculateTokenCostUsd', () => {
	it('prices input and output tokens using the actual model table', () => {
		expect(calculateTokenCostUsd(usage())).toBeCloseTo(1.35, 5);
	});

	it('prices Claude models separately from OpenAI models', () => {
		expect(
			calculateTokenCostUsd(
				usage({
					provider: 'claude',
					model: 'claude-haiku-4-5-20251001',
					inputTokens: 1_000_000,
					outputTokens: 1_000_000
				})
			)
		).toBeCloseTo(6, 5);
	});

	it('prices Claude prompt-cache write and read tokens separately', () => {
		expect(
			calculateTokenCostUsd(
				usage({
					provider: 'claude',
					model: 'claude-haiku-4-5-20251001',
					inputTokens: 1_000_000,
					cacheCreationInputTokens: 1_000_000,
					cacheReadInputTokens: 1_000_000,
					outputTokens: 1_000_000
				})
			)
		).toBeCloseTo(7.35, 5);
	});

	it('prices OpenAI cached input tokens at the cached-input rate', () => {
		expect(
			calculateTokenCostUsd(
				usage({
					inputTokens: 1_000_000,
					cacheReadInputTokens: 1_000_000,
					outputTokens: 1_000_000
				})
			)
		).toBeCloseTo(0.825, 5);
	});

	it('fails loud for unknown models', () => {
		expect(() => calculateTokenCostUsd(usage({ model: 'mystery-model' }))).toThrow(
			'No token pricing configured'
		);
	});
});

describe('recordTokens', () => {
	let kv: MockKV;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('creates the provider monthly key when none exists', async () => {
		await recordTokens(kv, usage());
		const spend = await getMonthlySpend(kv, 'openai');
		expect(spend).toBeCloseTo(1.35, 5);
	});

	it('increments an existing provider monthly spend', async () => {
		kv._store.set(monthlySpendKey('openai'), '10');
		await recordTokens(kv, usage());
		const spend = await getMonthlySpend(kv, 'openai');
		expect(spend).toBeCloseTo(11.35, 5);
	});

	it('records spend against the provider actually used', async () => {
		await recordTokens(kv, usage({ provider: 'claude', model: 'claude-haiku-4-5-20251001' }));

		expect(await getMonthlySpend(kv, 'openai')).toBe(0);
		expect(await getMonthlySpend(kv, 'claude')).toBeCloseTo(11, 5);
	});

	it('handles zero tokens gracefully', async () => {
		await recordTokens(kv, usage({ inputTokens: 0, outputTokens: 0 }));
		const spend = await getMonthlySpend(kv, 'openai');
		expect(spend).toBe(0);
	});
});

describe('isProviderOverBudget', () => {
	let kv: MockKV;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('returns false below the provider budget', async () => {
		kv._store.set(monthlySpendKey('openai'), '24.99');
		await expect(isProviderOverBudget(kv, 'openai', 25)).resolves.toBe(false);
	});

	it('returns true at the provider budget', async () => {
		kv._store.set(monthlySpendKey('openai'), '25');
		await expect(isProviderOverBudget(kv, 'openai', 25)).resolves.toBe(true);
	});
});

describe('recordMessage', () => {
	let kv: MockKV;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('creates the rate key starting at 1 when none exists', async () => {
		await recordMessage(kv, TEST_IP);
		const raw = kv._store.get(rateLimitKey(TEST_IP));
		expect(raw).toBe('1');
	});

	it('increments an existing rate counter', async () => {
		kv._store.set(rateLimitKey(TEST_IP), '5');
		await recordMessage(kv, TEST_IP);
		const raw = kv._store.get(rateLimitKey(TEST_IP));
		expect(raw).toBe('6');
	});

	it('tracks different IPs independently', async () => {
		const ip2 = '198.51.100.1';
		await recordMessage(kv, TEST_IP);
		await recordMessage(kv, TEST_IP);
		await recordMessage(kv, ip2);

		expect(kv._store.get(rateLimitKey(TEST_IP))).toBe('2');
		expect(kv._store.get(rateLimitKey(ip2))).toBe('1');
	});
});

describe('getMonthlySpend', () => {
	let kv: MockKV;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('returns 0 when no spend has been recorded', async () => {
		const spend = await getMonthlySpend(kv, 'openai');
		expect(spend).toBe(0);
	});

	it('returns the stored provider spend value', async () => {
		kv._store.set(monthlySpendKey('openai'), '42.75');
		const spend = await getMonthlySpend(kv, 'openai');
		expect(spend).toBe(42.75);
	});
});
