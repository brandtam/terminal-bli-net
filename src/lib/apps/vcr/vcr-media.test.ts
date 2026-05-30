import { describe, it, expect } from 'vitest';
import { pickPlayableFile, downloadUrl } from './vcr-media';

describe('pickPlayableFile', () => {
	it('prefers h.264 over every other format', () => {
		const files = [
			{ name: 'show.ogv', format: 'Ogg Video' },
			{ name: 'show_512.mp4', format: '512Kb MPEG4' },
			{ name: 'show.mp4', format: 'h.264' }
		];
		expect(pickPlayableFile(files)).toBe('show.mp4');
	});

	it('falls down the priority order when higher formats are missing', () => {
		const files = [
			{ name: 'show.ogv', format: 'Ogg Video' },
			{ name: 'show_256.mp4', format: '256Kb MPEG4' },
			{ name: 'show_512.mp4', format: '512Kb MPEG4' }
		];
		expect(pickPlayableFile(files)).toBe('show_512.mp4');
	});

	it('picks Ogg Video as the last resort', () => {
		const files = [
			{ name: 'show.mpg', format: 'MPEG2' },
			{ name: 'show.ogv', format: 'Ogg Video' }
		];
		expect(pickPlayableFile(files)).toBe('show.ogv');
	});

	it('returns null when only non-playable formats are present', () => {
		const files = [
			{ name: 'show.mpg', format: 'MPEG2' },
			{ name: 'show.srt', format: 'SubRip' },
			{ name: 'thumb.jpg', format: 'Thumbnail' }
		];
		expect(pickPlayableFile(files)).toBeNull();
	});

	it('returns null for an empty file list', () => {
		expect(pickPlayableFile([])).toBeNull();
	});
});

describe('downloadUrl', () => {
	it('encodes spaces in the file name', () => {
		expect(downloadUrl('MyItem', 'A Show.mp4')).toBe(
			'https://archive.org/download/MyItem/A%20Show.mp4'
		);
	});

	it('encodes each path segment but preserves the slash separators', () => {
		expect(downloadUrl('Alf', 'Alf/Season 01/ALF - S01E01 SDTV.mp4')).toBe(
			'https://archive.org/download/Alf/Alf/Season%2001/ALF%20-%20S01E01%20SDTV.mp4'
		);
	});

	it('leaves a simple name untouched', () => {
		expect(downloadUrl('Item', 'video.mp4')).toBe('https://archive.org/download/Item/video.mp4');
	});
});
