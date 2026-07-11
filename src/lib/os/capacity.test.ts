import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	CAPACITY_WARN_RATIO,
	estimateCapacity,
	isNearCapacity,
	shouldWarnCapacity,
	resetCapacityWarningForTests,
	formatBytes,
	type CapacityEstimate
} from './capacity';

function stubEstimate(result: { usage?: number; quota?: number } | 'throws' | 'missing') {
	if (result === 'missing') {
		vi.stubGlobal('navigator', {});
		return;
	}
	vi.stubGlobal('navigator', {
		storage: {
			estimate:
				result === 'throws'
					? () => Promise.reject(new Error('nope'))
					: () => Promise.resolve(result)
		}
	});
}

function est(usageBytes: number, quotaBytes: number): CapacityEstimate {
	return { usageBytes, quotaBytes, ratio: usageBytes / quotaBytes };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('estimateCapacity', () => {
	it('returns usage, quota, and ratio when the API reports numbers', async () => {
		stubEstimate({ usage: 400, quota: 1000 });
		expect(await estimateCapacity()).toEqual({ usageBytes: 400, quotaBytes: 1000, ratio: 0.4 });
	});

	it('returns null when navigator.storage.estimate is unavailable', async () => {
		stubEstimate('missing');
		expect(await estimateCapacity()).toBeNull();
	});

	it('returns null when estimate() rejects', async () => {
		stubEstimate('throws');
		expect(await estimateCapacity()).toBeNull();
	});

	it('returns null when the browser reports no usable numbers', async () => {
		stubEstimate({ usage: undefined, quota: undefined });
		expect(await estimateCapacity()).toBeNull();

		stubEstimate({ usage: 100, quota: 0 });
		expect(await estimateCapacity()).toBeNull();
	});
});

describe('isNearCapacity', () => {
	it('is false below the threshold and true at or above it', () => {
		expect(isNearCapacity(est(799, 1000))).toBe(false);
		expect(isNearCapacity(est(800, 1000))).toBe(true);
		expect(isNearCapacity(est(950, 1000))).toBe(true);
	});

	it('accounts for a pending write via extraBytes', () => {
		expect(isNearCapacity(est(700, 1000))).toBe(false);
		expect(isNearCapacity(est(700, 1000), 100)).toBe(true);
	});

	it('treats a missing estimate as not near capacity', () => {
		expect(isNearCapacity(null)).toBe(false);
	});

	it('matches the exported threshold constant', () => {
		const justUnder = est(CAPACITY_WARN_RATIO * 1000 - 1, 1000);
		const atThreshold = est(CAPACITY_WARN_RATIO * 1000, 1000);
		expect(isNearCapacity(justUnder)).toBe(false);
		expect(isNearCapacity(atThreshold)).toBe(true);
	});
});

describe('shouldWarnCapacity (once per session)', () => {
	beforeEach(() => {
		resetCapacityWarningForTests();
	});

	it('warns the first time usage crosses the threshold', () => {
		expect(shouldWarnCapacity(est(850, 1000))).toBe(true);
	});

	it('does not warn again in the same session', () => {
		expect(shouldWarnCapacity(est(850, 1000))).toBe(true);
		expect(shouldWarnCapacity(est(990, 1000))).toBe(false);
	});

	it('does not consume the gate on healthy estimates', () => {
		expect(shouldWarnCapacity(est(100, 1000))).toBe(false);
		expect(shouldWarnCapacity(null)).toBe(false);
		expect(shouldWarnCapacity(est(850, 1000))).toBe(true);
	});

	it('warns again after a session reset', () => {
		expect(shouldWarnCapacity(est(850, 1000))).toBe(true);
		resetCapacityWarningForTests();
		expect(shouldWarnCapacity(est(850, 1000))).toBe(true);
	});
});

describe('formatBytes', () => {
	it('picks a sensible unit', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(2048)).toBe('2.0 KB');
		expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
		expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
	});
});
