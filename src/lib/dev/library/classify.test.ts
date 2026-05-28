import { describe, expect, test } from 'vitest';
import { classify } from './classify';

describe('classify', () => {
	test('NOT_IN_COPYRIGHT marks clear', () => {
		expect(classify({ identifier: 'x', 'possible-copyright-status': 'NOT_IN_COPYRIGHT' })).toEqual({
			tier: 'clear',
			reason: 'public domain'
		});
	});
	test('CC license marks clear', () => {
		expect(
			classify({ identifier: 'x', licenseurl: 'https://creativecommons.org/licenses/by/4.0' })
		).toMatchObject({ tier: 'clear' });
	});
	test('known-safe collection marks clear with collection name', () => {
		expect(classify({ identifier: 'x', collection: ['prelinger', 'other'] })).toEqual({
			tier: 'clear',
			reason: 'collection: prelinger'
		});
	});
	test('handles single-string collection field', () => {
		expect(classify({ identifier: 'x', collection: 'computerchronicles' })).toMatchObject({
			tier: 'clear'
		});
	});
	test('unknown when no signals present', () => {
		expect(classify({ identifier: 'x' })).toEqual({
			tier: 'unknown',
			reason: 'no license metadata'
		});
	});
});
