/// <reference types="@cloudflare/workers-types" />
/**
 * File areas — D1 metadata (+ inline text bodies) and R2 image bodies behind
 * /api/dialer/boards/[board]/files and /api/dialer/files/[id]. Canon rows are
 * seeded by migration (`canon=1`, deterministic ids) and immutable here by
 * construction: the only writes are community uploads and their moderation
 * follow-ups, all keyed to caller-owned rows.
 *
 * The ratio economy (PRD "upload 1 to unlock 3 downloads"): every download
 * spends one ratio credit — canon files included, that's the scarcity the
 * fiction runs on — and a visible upload earns UPLOAD_CREDITS. Registration
 * seeds 3 credits, exactly the chain's two canon downloads plus one spare.
 * Uploads cap at 3/day. Both are atomic claims on the callers row, like the
 * post cooldown.
 *
 * Upload write order is R2 object first, then D1 row; a crash between the two
 * leaves an orphan object the nightly sweep collects. Delete order is the
 * reverse (R2 first, then row) for the same reason.
 */
import { epochSeconds } from './auth';
import type { PublicBoard } from './boards';

/** Era-shaped filename: 8.3-ish, uppercase, must carry an extension. */
const FILE_NAME_RE = /^[A-Z0-9][A-Z0-9_-]{0,7}\.[A-Z0-9]{1,3}$/;
export const TEXT_MAX_BYTES = 32_768;
/** Post-dither ceiling (PRD): the client dithers, the server only verifies. */
export const IMAGE_MAX_BYTES = 65_536;
export const IMAGE_MAX_WIDTH = 640;
export const IMAGE_MAX_HEIGHT = 400;
export const UPLOADS_PER_DAY = 3;
export const UPLOAD_CREDITS = 3;

export type FileKind = 'txt' | 'md' | 'png';

export interface FileSummary {
	id: string;
	name: string;
	kind: FileKind;
	size: number;
	uploader: string;
	downloads: number;
	createdAt: number;
	canon: boolean;
}

export type UploadFailure =
	| 'invalid-name'
	| 'invalid-kind'
	| 'invalid-body'
	| 'duplicate-name'
	| 'daily-limit';
export type UploadResult = { ok: true; id: string } | { ok: false; reason: UploadFailure };

export type DownloadFailure = 'no-file' | 'ratio';
export type DownloadResult =
	| { ok: true; file: FileSummary; bodyText: string | null; r2Key: string | null }
	| { ok: false; reason: DownloadFailure };

/** A board's visible files: canon in authored order first, then community by recency. */
export async function listFiles(db: D1Database, board: PublicBoard): Promise<FileSummary[]> {
	const rows = await db
		.prepare(
			`SELECT id, name, kind, size, uploader, downloads, created_at, canon FROM files
			 WHERE board = ?1 AND deleted_at IS NULL AND flagged = 0
			 ORDER BY canon DESC,
			          CASE WHEN canon = 1 THEN pinned_rank END ASC,
			          created_at DESC`
		)
		.bind(board)
		.all<{
			id: string;
			name: string;
			kind: FileKind;
			size: number;
			uploader: string;
			downloads: number;
			created_at: number;
			canon: number;
		}>();
	return rows.results.map(toSummary);
}

/**
 * Store a text upload, hidden (`flagged=1`) until moderation clears it — the
 * route unflags on an OK verdict, soft-deletes on REJECT, and leaves the row
 * hidden when the seam is down (never fail open). Claims the day's upload
 * slot atomically; ratio credits are granted separately, only when the file
 * becomes visible (grantUploadCredits), so junk that never clears earns
 * nothing.
 */
export async function uploadTextFile(
	db: D1Database,
	board: PublicBoard,
	uploader: string,
	input: { name: string; kind: string; body: string },
	now: Date
): Promise<UploadResult> {
	const name = canonicalFileName(input.name);
	if (!name) return { ok: false, reason: 'invalid-name' };
	if (input.kind !== 'txt' && input.kind !== 'md') return { ok: false, reason: 'invalid-kind' };
	const body = cleanFileBody(input.body);
	if (!body) return { ok: false, reason: 'invalid-body' };

	if (await nameTaken(db, board, name)) return { ok: false, reason: 'duplicate-name' };
	if (!(await claimUploadSlot(db, uploader))) return { ok: false, reason: 'daily-limit' };

	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO files (id, board, name, kind, size, uploader, body_text, r2_key, downloads, created_at, flagged)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, 0, ?8, 1)`
		)
		.bind(
			id,
			board,
			name,
			input.kind,
			new TextEncoder().encode(body).length,
			uploader,
			body,
			epochSeconds(now)
		)
		.run();
	return { ok: true, id };
}

/**
 * Store a verified CGA PNG: object to R2 first, then the D1 row, hidden until
 * moderation clears it. Image pixels can't be cheaply judged by the text seam
 * — the dither constraint (16 colors, 64 KB) is the content bound — but the
 * filename still takes the same trip through the LLM as everything else.
 */
export async function uploadImageFile(
	db: D1Database,
	bucket: R2Bucket,
	board: PublicBoard,
	uploader: string,
	input: { name: string; bytes: Uint8Array },
	now: Date
): Promise<UploadResult> {
	const name = canonicalFileName(input.name);
	if (!name) return { ok: false, reason: 'invalid-name' };
	if (!verifyCgaPng(input.bytes).ok) return { ok: false, reason: 'invalid-body' };

	if (await nameTaken(db, board, name)) return { ok: false, reason: 'duplicate-name' };
	if (!(await claimUploadSlot(db, uploader))) return { ok: false, reason: 'daily-limit' };

	const id = crypto.randomUUID();
	const r2Key = `${board}/${id}.png`;
	await bucket.put(r2Key, input.bytes as unknown as ArrayBuffer);
	await db
		.prepare(
			`INSERT INTO files (id, board, name, kind, size, uploader, body_text, r2_key, downloads, created_at, flagged)
			 VALUES (?1, ?2, ?3, 'png', ?4, ?5, NULL, ?6, 0, ?7, 1)`
		)
		.bind(id, board, name, input.bytes.length, uploader, r2Key, epochSeconds(now))
		.run();
	return { ok: true, id };
}

/** Give back the credit a download claimed when its R2 body turns out to be gone. */
export async function refundDownloadCredit(db: D1Database, handle: string): Promise<void> {
	await db
		.prepare('UPDATE callers SET ratio_credits = ratio_credits + 1 WHERE handle = ?1')
		.bind(handle)
		.run();
}

/**
 * Spend one ratio credit and hand back the file. The credit claim is atomic
 * (like the post cooldown) so parallel downloads can't overdraw; the download
 * counter only moves when the claim wins.
 */
export async function downloadFile(
	db: D1Database,
	fileId: string,
	handle: string
): Promise<DownloadResult> {
	const row = await db
		.prepare(
			`SELECT id, board, name, kind, size, uploader, body_text, r2_key, downloads, created_at, canon
			 FROM files WHERE id = ?1 AND deleted_at IS NULL AND flagged = 0`
		)
		.bind(fileId)
		.first<{
			id: string;
			board: string;
			name: string;
			kind: FileKind;
			size: number;
			uploader: string;
			body_text: string | null;
			r2_key: string | null;
			downloads: number;
			created_at: number;
			canon: number;
		}>();
	if (!row) return { ok: false, reason: 'no-file' };

	const claim = await db
		.prepare(
			`UPDATE callers SET ratio_credits = ratio_credits - 1
			 WHERE handle = ?1 AND is_canon = 0 AND ratio_credits > 0`
		)
		.bind(handle)
		.run();
	if (claim.meta.changes !== 1) return { ok: false, reason: 'ratio' };

	await db.prepare('UPDATE files SET downloads = downloads + 1 WHERE id = ?1').bind(fileId).run();
	return {
		ok: true,
		file: toSummary({ ...row, downloads: row.downloads + 1 }),
		bodyText: row.body_text,
		r2Key: row.r2_key
	};
}

/** Make a hidden upload visible (moderation cleared it). */
export async function setFileVisible(db: D1Database, fileId: string): Promise<void> {
	await db.prepare('UPDATE files SET flagged = 0 WHERE id = ?1 AND canon = 0').bind(fileId).run();
}

/** Soft-delete an upload (moderation rejected it); the nightly sweep hard-deletes. */
export async function softDeleteFile(db: D1Database, fileId: string, now: Date): Promise<void> {
	await db
		.prepare('UPDATE files SET deleted_at = ?2 WHERE id = ?1 AND canon = 0')
		.bind(fileId, epochSeconds(now))
		.run();
}

/** The upload reward, granted when (and only when) the file becomes visible. */
export async function grantUploadCredits(db: D1Database, handle: string): Promise<void> {
	await db
		.prepare('UPDATE callers SET ratio_credits = ratio_credits + ?2 WHERE handle = ?1')
		.bind(handle, UPLOAD_CREDITS)
		.run();
}

async function nameTaken(db: D1Database, board: PublicBoard, name: string): Promise<boolean> {
	const existing = await db
		.prepare('SELECT 1 FROM files WHERE board = ?1 AND name = ?2 AND deleted_at IS NULL')
		.bind(board, name)
		.first();
	return existing !== null;
}

/** Atomically claim one of the day's upload slots (3/day, reset by the cron). */
async function claimUploadSlot(db: D1Database, handle: string): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE callers SET uploads_today = uploads_today + 1
			 WHERE handle = ?1 AND is_canon = 0 AND uploads_today < ?2`
		)
		.bind(handle, UPLOADS_PER_DAY)
		.run();
	return result.meta.changes === 1;
}

/** Uppercase-canonical era filename, or null if it doesn't scan. */
export function canonicalFileName(raw: string): string | null {
	const name = raw.trim().toUpperCase();
	return FILE_NAME_RE.test(name) ? name : null;
}

/** File body text: same normalization as post bodies, bigger budget. */
function cleanFileBody(raw: string): string {
	const body = raw
		.replace(/\r\n?/g, '\n')
		.replace(/\t/g, ' ')
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
		.replace(/\s+$/, '');
	if (body.length === 0 || new TextEncoder().encode(body).length > TEXT_MAX_BYTES) return '';
	return body;
}

function toSummary(row: {
	id: string;
	name: string;
	kind: FileKind;
	size: number;
	uploader: string;
	downloads: number;
	created_at: number;
	canon: number;
}): FileSummary {
	return {
		id: row.id,
		name: row.name,
		kind: row.kind,
		size: row.size,
		uploader: row.uploader,
		downloads: row.downloads,
		createdAt: row.created_at,
		canon: row.canon === 1
	};
}

/** The 16 CGA colors as 24-bit ints — the only pixels an upload may carry. */
const CGA_PALETTE = new Set([
	0x000000, 0xaa0000, 0x00aa00, 0xaa5500, 0x0000aa, 0xaa00aa, 0x00aaaa, 0xaaaaaa, 0x555555,
	0xff5555, 0x55ff55, 0xffff55, 0x5555ff, 0xff55ff, 0x55ffff, 0xffffff
]);

export type PngVerdict =
	| { ok: true; width: number; height: number }
	| { ok: false; reason: string };

/**
 * Verify a client-dithered PNG without decoding pixel data: the upload must
 * be indexed-color (type 3), so checking the palette chunk against the CGA 16
 * bounds every pixel the file can express. Dimensions come from IHDR; size is
 * the byte length. No server re-dither, no inflate (PRD backend spec).
 */
export function verifyCgaPng(bytes: Uint8Array): PngVerdict {
	if (bytes.length > IMAGE_MAX_BYTES) return { ok: false, reason: 'too-big' };
	const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	if (bytes.length < 8 + 25 || SIG.some((b, i) => bytes[i] !== b)) {
		return { ok: false, reason: 'not-png' };
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	let offset = 8;
	let dims: { width: number; height: number } | null = null;
	let paletteOk = false;
	let sawIdat = false;
	while (offset + 8 <= bytes.length) {
		const length = view.getUint32(offset);
		const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
		const dataStart = offset + 8;
		if (length > bytes.length - dataStart - 4) return { ok: false, reason: 'truncated' };

		if (type === 'IHDR') {
			const width = view.getUint32(dataStart);
			const height = view.getUint32(dataStart + 4);
			const bitDepth = bytes[dataStart + 8];
			const colorType = bytes[dataStart + 9];
			if (colorType !== 3) return { ok: false, reason: 'not-indexed' };
			if (![1, 2, 4, 8].includes(bitDepth)) return { ok: false, reason: 'bad-depth' };
			if (width < 1 || height < 1 || width > IMAGE_MAX_WIDTH || height > IMAGE_MAX_HEIGHT) {
				return { ok: false, reason: 'bad-dimensions' };
			}
			dims = { width, height };
		} else if (type === 'PLTE') {
			if (length % 3 !== 0 || length / 3 > 16) return { ok: false, reason: 'bad-palette' };
			for (let i = dataStart; i < dataStart + length; i += 3) {
				const rgb = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
				if (!CGA_PALETTE.has(rgb)) return { ok: false, reason: 'off-palette' };
			}
			paletteOk = true;
		} else if (type === 'tRNS') {
			// The terminal has no transparency; a dithered upload never needs one.
			return { ok: false, reason: 'has-alpha' };
		} else if (type === 'IDAT') {
			sawIdat = true;
		} else if (type === 'IEND') {
			break;
		}
		offset = dataStart + length + 4;
	}

	if (!dims) return { ok: false, reason: 'no-header' };
	if (!paletteOk) return { ok: false, reason: 'no-palette' };
	if (!sawIdat) return { ok: false, reason: 'no-image-data' };
	return { ok: true, ...dims };
}
