import type { IAItem } from './types';

export function slugify(s: string, max = 40): string {
	return String(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, max);
}

export function extractYear(item: IAItem): number {
	if (item.year) {
		const n = parseInt(String(item.year), 10);
		if (!Number.isNaN(n)) return n;
	}
	const m = String(item.title || item.identifier || '').match(/(19|20)\d{2}/);
	return m ? parseInt(m[0], 10) : 0;
}

export function firstSentence(s: string | undefined, maxLen = 160): string {
	if (!s) return '';
	const flat = String(s).replace(/\s+/g, ' ').trim();
	const m = flat.match(/^(.+?[.!?])\s/);
	const out = m ? m[1] : flat;
	return out.length > maxLen ? out.slice(0, maxLen - 1) + '…' : out;
}

export function smartShowNameFromTitle(title: string): string {
	return title
		.replace(/^\s*(\d{4})\s*[-–:]\s*/, '')
		.replace(/\s*[-–:]?\s*(s\d+e\d+|episode\s*\d+|ep\s*\d+|pt\.?\s*\d+).*/i, '')
		.replace(/\s*\(.*?\)\s*$/, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Normalized key used to cluster results that look like episodes of the same show. */
export function seriesKey(title: string): string {
	return title
		.replace(/\s*\([^)]*\)\s*/g, ' ')
		.replace(/\s*(S\d+\s*E\d+|Episode\s*\d+|Ep\.?\s*\d+|\d+x\d+).*/i, '')
		.replace(/^\s*\d{4}\s*[-–:]\s*/, '')
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function parseSE(title: string): { s: number; e: number } | null {
	const m = title.match(/S0*(\d+)\s*E0*(\d+)/i);
	if (!m) return null;
	return { s: parseInt(m[1], 10), e: parseInt(m[2], 10) };
}

const QUALITY_SUFFIX_RE =
	/\b(SDTV|HDTV|480p|720p|1080p|2160p|4K|x264|x265|h264|h265|HEVC|BluRay|BDRip|DVDRip|WEBRip|WEB-DL|AAC|AC3|DTS|REMUX|PROPER|REPACK)\b.*$/i;

export function parseEpisodeName(filePath: string): {
	title: string;
	season: number;
	episode: number;
} {
	const filename = filePath.split('/').pop() || filePath;
	let stem = filename.replace(/\.[^.]+$/, '');
	let season = 1;
	let episode = 0;

	const seasonInPath = filePath.match(/season\s*0*(\d+)/i);
	if (seasonInPath) season = parseInt(seasonInPath[1], 10);

	const sxxexx = stem.match(/S0*(\d+)\s*E0*(\d+)/i);
	if (sxxexx) {
		season = parseInt(sxxexx[1], 10);
		episode = parseInt(sxxexx[2], 10);
		stem = stem.replace(/^.*?S0*\d+\s*E0*\d+\s*[-–:_.]?\s*/i, '');
	} else {
		const epOnly = stem.match(/\b(?:episode|ep\.?)\s*0*(\d+)\b/i);
		if (epOnly) {
			episode = parseInt(epOnly[1], 10);
			stem = stem.replace(/^.*?(?:episode|ep\.?)\s*0*\d+\s*[-–:_.]?\s*/i, '');
		} else {
			const leading = stem.match(/^0*(\d+)\s*[-–:_.]\s*(.+)/);
			if (leading) {
				episode = parseInt(leading[1], 10);
				stem = leading[2];
			}
		}
	}

	stem = stem
		.replace(QUALITY_SUFFIX_RE, '')
		.replace(/[._]+/g, ' ')
		.replace(/\s*-\s*$/, '')
		.replace(/\s+/g, ' ')
		.trim();

	return { title: stem || filename, season, episode };
}
