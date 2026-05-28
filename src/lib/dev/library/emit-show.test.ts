import { describe, expect, test } from 'vitest';
import { buildShowBlock, removeShowBlock, ShowBlockNotFoundError } from './emit-show';

const SAMPLE = [
	'export const SHOWS = [',
	'\t{',
	"\t\tid: 'first',",
	"\t\tname: 'First',",
	'\t\tepisodes: [',
	'\t\t\t{',
	"\t\t\t\tid: 'first-1',",
	"\t\t\t\ttitle: 'A'",
	'\t\t\t},',
	'\t\t\t{',
	"\t\t\t\tid: 'first-2',",
	"\t\t\t\ttitle: 'B'",
	'\t\t\t}',
	'\t\t]',
	'\t},',
	'\t{',
	"\t\tid: 'second',",
	"\t\tname: 'Second',",
	'\t\tepisodes: []',
	'\t},',
	'\t// >>> sentinel <<<',
	'];',
	''
].join('\n');

describe('buildShowBlock', () => {
	test('emits a single-episode show with tabs and trailing comma', () => {
		const out = buildShowBlock({
			id: 'foo',
			name: 'Foo',
			years: '1985',
			description: 'A show.',
			episodes: [
				{
					id: 'foo-e1',
					title: 'Pilot',
					year: 1985,
					archiveId: 'foo-pilot',
					description: 'The first one.'
				}
			]
		});
		expect(out).toBe(
			[
				'\t{',
				"\t\tid: 'foo',",
				"\t\tname: 'Foo',",
				"\t\tyears: '1985',",
				'\t\tdescription:',
				"\t\t\t'A show.',",
				'\t\tepisodes: [',
				'\t\t\t{',
				"\t\t\t\tid: 'foo-e1',",
				"\t\t\t\ttitle: 'Pilot',",
				'\t\t\t\tyear: 1985,',
				"\t\t\t\tarchiveId: 'foo-pilot',",
				'\t\t\t\tdescription:',
				"\t\t\t\t\t'The first one.'",
				'\t\t\t}',
				'\t\t]',
				'\t},'
			].join('\n')
		);
	});

	test('includes archiveFile only when present', () => {
		const out = buildShowBlock({
			id: 'foo',
			name: 'Foo',
			years: '1985',
			description: '',
			episodes: [
				{
					id: 'foo-e1',
					title: 'A',
					year: 1985,
					archiveId: 'arch',
					archiveFile: 'Season 01/A.mp4',
					description: ''
				}
			]
		});
		expect(out).toContain("archiveFile: 'Season 01/A.mp4',");
	});

	test('escapes single quotes and backslashes', () => {
		const out = buildShowBlock({
			id: 'foo',
			name: "Don't \\ break",
			years: '1985',
			description: '',
			episodes: [{ id: 'foo-1', title: "T'", year: 1985, archiveId: 'a', description: '' }]
		});
		expect(out).toContain("name: 'Don\\'t \\\\ break',");
		expect(out).toContain("title: 'T\\'',");
	});

	test('escapes newlines inside descriptions to keep emitted code valid', () => {
		const out = buildShowBlock({
			id: 'foo',
			name: 'Foo',
			years: '1985',
			description: 'line one\nline two',
			episodes: [{ id: 'foo-1', title: 'A', year: 1985, archiveId: 'a', description: '' }]
		});
		expect(out).toContain("'line one\\nline two'");
	});

	test('multi-episode list uses commas between but not after last', () => {
		const out = buildShowBlock({
			id: 'foo',
			name: 'Foo',
			years: '1985',
			description: '',
			episodes: [
				{ id: 'a', title: 'A', year: 1985, archiveId: 'aa', description: '' },
				{ id: 'b', title: 'B', year: 1985, archiveId: 'bb', description: '' }
			]
		});
		const trailingBraces = out.match(/\t\t\t\}/g);
		expect(trailingBraces).toHaveLength(2);
		const closingWithComma = out.match(/\t\t\t},/g);
		expect(closingWithComma).toHaveLength(1);
	});
});

describe('removeShowBlock', () => {
	test('removes a middle show, preserves others + sentinel', () => {
		const out = removeShowBlock(SAMPLE, 'first');
		expect(out).not.toContain("id: 'first'");
		expect(out).toContain("id: 'second'");
		expect(out).toContain('// >>> sentinel <<<');
		expect(out).toContain("\t{\n\t\tid: 'second'");
	});

	test('removes the last show before the sentinel', () => {
		const out = removeShowBlock(SAMPLE, 'second');
		expect(out).not.toContain("id: 'second'");
		expect(out).toContain("id: 'first'");
		expect(out).toContain('// >>> sentinel <<<');
	});

	test('does not get confused by nested episode "{" / "}"', () => {
		// "first" has nested episode braces — make sure the remover ends at the show closer,
		// not the first episode closer.
		const out = removeShowBlock(SAMPLE, 'first');
		expect(out).not.toContain("id: 'first-1'");
		expect(out).not.toContain("id: 'first-2'");
		expect(out).toContain("id: 'second'");
	});

	test('throws ShowBlockNotFoundError for unknown id', () => {
		expect(() => removeShowBlock(SAMPLE, 'nope')).toThrow(ShowBlockNotFoundError);
	});

	test('round-trip: build then remove yields the original prefix/suffix', () => {
		const prefix = 'export const SHOWS = [\n';
		const suffix = '\t// sentinel\n];\n';
		const block = buildShowBlock({
			id: 'temp',
			name: 'Temp',
			years: '2025',
			description: 'x',
			episodes: [{ id: 't-1', title: 'A', year: 2025, archiveId: 'a', description: '' }]
		});
		const withShow = `${prefix}${block}\n${suffix}`;
		const removed = removeShowBlock(withShow, 'temp');
		expect(removed).toBe(`${prefix}${suffix}`);
	});
});
