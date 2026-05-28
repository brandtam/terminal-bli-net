import { describe, expect, test } from 'vitest';
import {
	extractYear,
	firstSentence,
	parseEpisodeName,
	parseSE,
	seriesKey,
	slugify,
	smartShowNameFromTitle
} from './parsers';

describe('slugify', () => {
	test('lowercases, replaces non-alphanumeric with hyphens, trims', () => {
		expect(slugify('Hello, World!')).toBe('hello-world');
	});
	test('caps length to max', () => {
		expect(slugify('abcdefghij'.repeat(10), 20)).toHaveLength(20);
	});
	test('strips leading and trailing hyphens', () => {
		expect(slugify('--foo--bar--')).toBe('foo-bar');
	});
});

describe('extractYear', () => {
	test('uses item.year when present', () => {
		expect(extractYear({ identifier: 'x', year: 1985 })).toBe(1985);
		expect(extractYear({ identifier: 'x', year: '1985' })).toBe(1985);
	});
	test('falls back to year-shaped substring in title', () => {
		expect(extractYear({ identifier: 'x', title: 'ALF (1987) season 1' })).toBe(1987);
	});
	test('returns 0 when no year findable', () => {
		expect(extractYear({ identifier: 'x', title: 'no year here' })).toBe(0);
	});
});

describe('firstSentence', () => {
	test('returns first sentence with terminator', () => {
		expect(firstSentence('Hello world. Second sentence.')).toBe('Hello world.');
	});
	test('returns whole string if no terminator', () => {
		expect(firstSentence('No terminator here')).toBe('No terminator here');
	});
	test('truncates with ellipsis when longer than maxLen', () => {
		expect(firstSentence('x'.repeat(200), 50)).toHaveLength(50);
		expect(firstSentence('x'.repeat(200), 50).endsWith('…')).toBe(true);
	});
	test('collapses whitespace', () => {
		expect(firstSentence('a\n\tb   c')).toBe('a b c');
	});
	test('handles undefined input', () => {
		expect(firstSentence(undefined)).toBe('');
	});
});

describe('smartShowNameFromTitle', () => {
	test('strips leading year prefix', () => {
		expect(smartShowNameFromTitle('1985 - The Computer Chronicles')).toBe(
			'The Computer Chronicles'
		);
	});
	test('strips SxxExx and everything after', () => {
		expect(smartShowNameFromTitle('ALF S01E02 - Strangers in the Night')).toBe('ALF');
	});
	test('strips trailing parenthetical', () => {
		expect(smartShowNameFromTitle('Show Name (1987)')).toBe('Show Name');
	});
});

describe('seriesKey', () => {
	test('strips parentheticals, SE markers, year prefix; lowercases; normalizes', () => {
		expect(seriesKey('1987 - ALF (Pilot) S01E01 - Strangers')).toBe('alf');
		expect(seriesKey('ALF S01E02 - Strangers')).toBe('alf');
		expect(seriesKey('V: The Series Episode 03')).toBe('v the series');
	});
	test('handles 1x02 marker', () => {
		expect(seriesKey('Cheers 1x02 something')).toBe('cheers');
	});
});

describe('parseSE', () => {
	test('parses S1E2 and S01E02 alike', () => {
		expect(parseSE('Show S1E2')).toEqual({ s: 1, e: 2 });
		expect(parseSE('Show S01E02')).toEqual({ s: 1, e: 2 });
	});
	test('returns null if no SE marker', () => {
		expect(parseSE('Movie title')).toBeNull();
	});
});

describe('parseEpisodeName', () => {
	test('extracts SxxExx from filename', () => {
		const r = parseEpisodeName('ALF - S01E02 - Strangers in the Night.mp4');
		expect(r).toEqual({ title: 'Strangers in the Night', season: 1, episode: 2 });
	});
	test('infers season from path when filename has no S marker', () => {
		const r = parseEpisodeName('ALF/Season 03/Episode 5 - Title.mkv');
		expect(r.season).toBe(3);
		expect(r.episode).toBe(5);
		expect(r.title).toBe('Title');
	});
	test('handles leading-number-style episode names', () => {
		const r = parseEpisodeName('Cartoons/01 - Pilot Episode.mp4');
		expect(r).toEqual({ title: 'Pilot Episode', season: 1, episode: 1 });
	});
	test('strips codec/quality suffixes', () => {
		const r = parseEpisodeName('Show S01E01 The Title 1080p BluRay x264.mp4');
		expect(r.title).toBe('The Title');
	});
	test('falls back to filename if title parsing leaves empty', () => {
		const r = parseEpisodeName('orphan-file.mp4');
		expect(r.title).toBe('orphan-file');
	});
});
