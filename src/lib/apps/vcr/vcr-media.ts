import type { VCREpisode } from './vcr-data';

/**
 * Archive.org `format` values we can hand straight to a native <video>.
 *
 * Order is the priority we pick in: h.264 first because it's the full-quality
 * original mp4 (best picture). The MPEG4 transcodes are smaller and start a
 * little faster, then Ogg as a last resort. Anything not in this list
 * (MPEG2, subtitles, thumbnails) is not browser-playable.
 */
const PLAYABLE_FORMATS = [
	'h.264',
	'512Kb MPEG4',
	'256Kb MPEG4',
	'HiRes MPEG4',
	'Ogg Video'
] as const;

type ArchiveFile = { name: string; format: string };

/**
 * Return the best browser-playable file name from an archive.org file list,
 * by our format priority, or null if nothing matches.
 */
export function pickPlayableFile(files: ArchiveFile[]): string | null {
	for (const format of PLAYABLE_FORMATS) {
		const match = files.find((f) => f.format === format);
		if (match) return match.name;
	}
	return null;
}

/**
 * Build a download URL for a file inside an archive.org item.
 *
 * File names can contain spaces and slashes — encode each path segment but
 * keep the `/` separators so the path still resolves on the media server.
 */
export function downloadUrl(archiveId: string, fileName: string): string {
	const encoded = fileName
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `https://archive.org/download/${archiveId}/${encoded}`;
}

// Cache resolved URLs (and misses, as null) by archiveId so repeat plays
// don't refetch the metadata.
const urlCache = new Map<string, string | null>();

/**
 * Resolve a native-playable media URL for an episode, or null if none exists.
 *
 * - If the episode already points at an .mp4 file, use it directly.
 * - Otherwise fetch the archive.org metadata and pick the best playable file.
 * - Any fetch/parse failure resolves to null (caller falls back to the iframe).
 */
export async function resolvePlayableUrl(episode: VCREpisode): Promise<string | null> {
	if (episode.archiveFile && episode.archiveFile.toLowerCase().endsWith('.mp4')) {
		return downloadUrl(episode.archiveId, episode.archiveFile);
	}

	if (urlCache.has(episode.archiveId)) {
		return urlCache.get(episode.archiveId) ?? null;
	}

	let resolved: string | null;
	try {
		const res = await fetch(`https://archive.org/metadata/${episode.archiveId}`);
		const json: { files?: ArchiveFile[] } = await res.json();
		const files: ArchiveFile[] = Array.isArray(json?.files) ? json.files : [];
		const name = pickPlayableFile(files);
		resolved = name ? downloadUrl(episode.archiveId, name) : null;
	} catch {
		resolved = null;
	}

	urlCache.set(episode.archiveId, resolved);
	return resolved;
}
