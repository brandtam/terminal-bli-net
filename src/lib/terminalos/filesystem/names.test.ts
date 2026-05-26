import { describe, it, expect } from 'vitest';
import { normalizeNameForComparison, hasSiblingConflict, generateUniqueId } from './names';

describe('normalizeNameForComparison', () => {
	it('lowercases a name', () => {
		expect(normalizeNameForComparison('README.TXT')).toBe('readme.txt');
	});

	it('keeps already-lowercase names unchanged', () => {
		expect(normalizeNameForComparison('notes')).toBe('notes');
	});

	it('handles mixed case', () => {
		expect(normalizeNameForComparison('TV Guide.app')).toBe('tv guide.app');
	});
});

describe('hasSiblingConflict', () => {
	it('detects exact match', () => {
		const siblings = [{ name: 'README.TXT' }];
		expect(hasSiblingConflict('README.TXT', siblings)).toBe(true);
	});

	it('detects case-insensitive match', () => {
		const siblings = [{ name: 'README.TXT' }];
		expect(hasSiblingConflict('readme.txt', siblings)).toBe(true);
	});

	it('returns false when no conflict', () => {
		const siblings = [{ name: 'README.TXT' }];
		expect(hasSiblingConflict('Pricing.txt', siblings)).toBe(false);
	});

	it('returns false for empty siblings', () => {
		expect(hasSiblingConflict('anything', [])).toBe(false);
	});
});

describe('generateUniqueId', () => {
	it('returns a string', () => {
		const id = generateUniqueId();
		expect(typeof id).toBe('string');
		expect(id.length).toBeGreaterThan(0);
	});

	it('returns unique values', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(generateUniqueId());
		}
		expect(ids.size).toBe(100);
	});
});
