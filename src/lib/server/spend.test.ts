/// <reference types="@cloudflare/workers-types" />
/* eslint-disable no-undef */
import { describe, it, expect, beforeEach } from 'vitest';
import {
	canRespond,
	recordTokens,
	recordMessage,
	getMonthlySpend,
	monthlySpendKey,
	rateLimitKey,
	sessionKey,
	type SpendConfig
} from './spend';

// ---------------------------------------------------------------------------
// In-memory KVNamespace mock
// ---------------------------------------------------------------------------

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

		// Stubs for the rest of the KVNamespace interface — unused by spend.ts
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultConfig(kv: KVNamespace, overrides?: Partial<SpendConfig>): SpendConfig {
	return {
		kv,
		monthlyCap: 50,
		rateLimitPerHour: 30,
		sessionCap: 50,
		...overrides
	};
}

const TEST_IP = '203.0.113.42';
const TEST_SESSION = 'sess_abc123';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('monthlySpendKey', () => {
	it('formats as spend:YYYY-MM', () => {
		const key = monthlySpendKey(new Date('2026-05-23T14:00:00Z'));
		expect(key).toBe('spend:2026-05');
	});

	it('zero-pads single-digit months', () => {
		const key = monthlySpendKey(new Date('2026-01-05T00:00:00Z'));
		expect(key).toBe('spend:2026-01');
	});

	it('handles December correctly', () => {
		const key = monthlySpendKey(new Date('2026-12-31T23:59:59Z'));
		expect(key).toBe('spend:2026-12');
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

	it('allows requests when all limits are within bounds', async () => {
		const config = defaultConfig(kv);
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result).toEqual({ allowed: true });
	});

	// -- Session cap (server-side via KV) -----------------------------------

	it('blocks when server-side session count equals the cap', async () => {
		const config = defaultConfig(kv, { sessionCap: 10 });
		kv._store.set(sessionKey(TEST_SESSION), '10');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('Session message limit');
	});

	it('blocks when server-side session count exceeds the cap', async () => {
		const config = defaultConfig(kv, { sessionCap: 10 });
		kv._store.set(sessionKey(TEST_SESSION), '15');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(false);
	});

	it('allows when server-side session count is below the cap', async () => {
		const config = defaultConfig(kv, { sessionCap: 10 });
		kv._store.set(sessionKey(TEST_SESSION), '9');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(true);
	});

	// -- Monthly spend kill-switch ------------------------------------------

	it('blocks when monthly spend equals the cap (kill switch)', async () => {
		const config = defaultConfig(kv, { monthlyCap: 50 });
		kv._store.set(monthlySpendKey(), '50');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('Monthly spend cap');
	});

	it('blocks when monthly spend exceeds the cap', async () => {
		const config = defaultConfig(kv, { monthlyCap: 50 });
		kv._store.set(monthlySpendKey(), '75.25');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(false);
	});

	it('allows when monthly spend is below the cap', async () => {
		const config = defaultConfig(kv, { monthlyCap: 50 });
		kv._store.set(monthlySpendKey(), '49.99');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(true);
	});

	it('allows when there is no spend recorded yet', async () => {
		const config = defaultConfig(kv, { monthlyCap: 50 });
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(true);
	});

	// -- Per-IP hourly rate limit -------------------------------------------

	it('blocks when per-IP rate limit equals the cap', async () => {
		const config = defaultConfig(kv, { rateLimitPerHour: 30 });
		kv._store.set(rateLimitKey(TEST_IP), '30');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('Rate limit exceeded');
	});

	it('blocks when per-IP rate limit exceeds the cap', async () => {
		const config = defaultConfig(kv, { rateLimitPerHour: 30 });
		kv._store.set(rateLimitKey(TEST_IP), '35');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(false);
	});

	it('allows when per-IP rate is below the cap', async () => {
		const config = defaultConfig(kv, { rateLimitPerHour: 30 });
		kv._store.set(rateLimitKey(TEST_IP), '29');
		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(true);
	});

	// -- Priority order: session > spend > rate -----------------------------

	it('reports session cap before checking spend or rate limits', async () => {
		const config = defaultConfig(kv, { sessionCap: 5, monthlyCap: 50, rateLimitPerHour: 30 });
		// All limits exceeded
		kv._store.set(sessionKey(TEST_SESSION), '5');
		kv._store.set(monthlySpendKey(), '100');
		kv._store.set(rateLimitKey(TEST_IP), '100');

		const result = await canRespond(config, TEST_IP, TEST_SESSION);
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain('Session message limit');
	});
});

describe('recordTokens', () => {
	let kv: MockKV;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('creates the monthly key when none exists', async () => {
		await recordTokens(kv, 1_000_000);
		const spend = await getMonthlySpend(kv);
		// 1M tokens at $1.25/1M = $1.25
		expect(spend).toBeCloseTo(1.25, 5);
	});

	it('increments an existing monthly spend', async () => {
		kv._store.set(monthlySpendKey(), '10');
		await recordTokens(kv, 2_000_000);
		const spend = await getMonthlySpend(kv);
		// $10 + (2M * $1.25/1M) = $12.50
		expect(spend).toBeCloseTo(12.5, 5);
	});

	it('accumulates across multiple calls', async () => {
		await recordTokens(kv, 1_000_000);
		await recordTokens(kv, 1_000_000);
		await recordTokens(kv, 1_000_000);
		const spend = await getMonthlySpend(kv);
		expect(spend).toBeCloseTo(3.75, 5);
	});

	it('handles zero tokens gracefully', async () => {
		await recordTokens(kv, 0);
		const spend = await getMonthlySpend(kv);
		expect(spend).toBe(0);
	});
});

describe('recordMessage', () => {
	let kv: MockKV;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('creates the rate key starting at 1 when none exists', async () => {
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		const raw = kv._store.get(rateLimitKey(TEST_IP));
		expect(raw).toBe('1');
	});

	it('increments an existing rate counter', async () => {
		kv._store.set(rateLimitKey(TEST_IP), '5');
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		const raw = kv._store.get(rateLimitKey(TEST_IP));
		expect(raw).toBe('6');
	});

	it('increments correctly across multiple calls', async () => {
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		const raw = kv._store.get(rateLimitKey(TEST_IP));
		expect(raw).toBe('3');
	});

	it('tracks different IPs independently', async () => {
		const ip2 = '198.51.100.1';
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		await recordMessage(kv, ip2, TEST_SESSION);

		expect(kv._store.get(rateLimitKey(TEST_IP))).toBe('2');
		expect(kv._store.get(rateLimitKey(ip2))).toBe('1');
	});

	it('also increments the session counter', async () => {
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		const raw = kv._store.get(sessionKey(TEST_SESSION));
		expect(raw).toBe('2');
	});

	it('tracks different sessions independently', async () => {
		const session2 = 'sess_other';
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		await recordMessage(kv, TEST_IP, TEST_SESSION);
		await recordMessage(kv, TEST_IP, session2);

		expect(kv._store.get(sessionKey(TEST_SESSION))).toBe('2');
		expect(kv._store.get(sessionKey(session2))).toBe('1');
	});
});

describe('getMonthlySpend', () => {
	let kv: MockKV;

	beforeEach(() => {
		kv = createMockKV();
	});

	it('returns 0 when no spend has been recorded', async () => {
		const spend = await getMonthlySpend(kv);
		expect(spend).toBe(0);
	});

	it('returns the stored spend value', async () => {
		kv._store.set(monthlySpendKey(), '42.75');
		const spend = await getMonthlySpend(kv);
		expect(spend).toBe(42.75);
	});
});
