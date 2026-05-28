import { describe, expect, test } from 'vitest';
import { ShowInputSchema } from './payload-schema';

const valid = {
	id: 'my-show',
	name: 'My Show',
	years: '1985',
	description: 'desc',
	episodes: [{ id: 'e1', title: 'T', year: 1985, archiveId: 'a', description: '' }]
};

describe('ShowInputSchema', () => {
	test('accepts a valid payload', () => {
		expect(() => ShowInputSchema.parse(valid)).not.toThrow();
	});

	test('accepts archiveFile when present', () => {
		const r = ShowInputSchema.parse({
			...valid,
			episodes: [{ ...valid.episodes[0], archiveFile: 'Season 01/A.mp4' }]
		});
		expect(r.episodes[0].archiveFile).toBe('Season 01/A.mp4');
	});

	test('rejects id with uppercase', () => {
		expect(() => ShowInputSchema.parse({ ...valid, id: 'MyShow' })).toThrow();
	});

	test('rejects id starting with hyphen', () => {
		expect(() => ShowInputSchema.parse({ ...valid, id: '-show' })).toThrow();
	});

	test('rejects empty episode list', () => {
		expect(() => ShowInputSchema.parse({ ...valid, episodes: [] })).toThrow();
	});

	test('rejects episode missing archiveId', () => {
		expect(() =>
			ShowInputSchema.parse({
				...valid,
				episodes: [{ id: 'e1', title: 'T', year: 1985, description: '' }]
			})
		).toThrow();
	});

	test('rejects non-numeric year', () => {
		expect(() =>
			ShowInputSchema.parse({
				...valid,
				episodes: [{ ...valid.episodes[0], year: '1985' }]
			})
		).toThrow();
	});
});
