/**
 * Local progress in TerminalFS AppData (PRD persistence spec): the caller's
 * whole single-player state lives in `progress.json` under
 * /System/AppData/dialer, so it survives backup/restore with the disk and app
 * uninstall/reinstall. Corrupt JSON heals to fresh progress and the file is
 * rewritten. A human-readable PHONEBOOK.TXT is written alongside — a caller
 * browsing AppData in Finder finds an in-fiction artifact, not opaque state.
 *
 * Shared content (posts, files, scores, identity) lives in D1/R2, never here.
 */
import type { TerminalFS } from '$lib/terminalos';
import type { Session } from './api';
import { CANON_SYSTEMS } from './content';
import { formatNumber } from './content/types';

const PROGRESS_FILE = 'progress.json';
const PHONEBOOK_FILE = 'PHONEBOOK.TXT';

/** A number the caller has seen on screen but hasn't dialed into yet. */
export type FoundNumber = {
	/** Seven digits, no punctuation. */
	number: string;
	/** Where it was first seen — a board name, a scan, or "a post". */
	source: string;
};

/** One night's autodialer sweep, kept for the SCANLOG.TXT screen. */
export type Scanlog = {
	/** The 100-number block, e.g. "5550100-5550199". */
	block: string;
	/** YY-MM-DD the sweep ran. */
	date: string;
	/** One line per number: "5550113 ... CARRIER". */
	lines: string[];
};

export type DialerProgress = {
	handle: string | null;
	session: Session | null;
	/** Numbers sighted but not yet verified by dialing in. */
	foundNumbers: FoundNumber[];
	/** Board ids the caller has actually connected to. */
	verifiedSystems: string[];
	/** Canon topic slugs the caller has opened (read-tracking). */
	readPosts: string[];
	scanlogs: Scanlog[];
	lodestoneUnlocked: boolean;
	doorHighScore: number;
};

const FRESH: DialerProgress = {
	handle: null,
	session: null,
	foundNumbers: [],
	verifiedSystems: [],
	readPosts: [],
	scanlogs: [],
	lodestoneUnlocked: false,
	doorHighScore: 0
};

export function freshProgress(): DialerProgress {
	return structuredClone(FRESH);
}

export async function loadProgress(fs: TerminalFS): Promise<DialerProgress> {
	const file = await progressFileId(fs);
	if (!file) return freshProgress();
	const text = fs.readText(file);
	if (text === null) return freshProgress();

	const parsed = parseProgress(text);
	if (parsed) return parsed;
	// Corrupt file: heal it so the next load doesn't re-parse garbage.
	const fresh = freshProgress();
	await saveProgress(fs, fresh);
	return fresh;
}

export async function saveProgress(fs: TerminalFS, progress: DialerProgress): Promise<void> {
	const folder = await fs.getAppDataFolder('dialer');
	if (!folder.ok) return; // no disk, no memory — the session just won't stick
	await writeFile(fs, folder.value, PROGRESS_FILE, JSON.stringify(progress, null, '\t'));
	await writeFile(fs, folder.value, PHONEBOOK_FILE, renderPhonebook(progress));
}

/** Add a sighted number (idempotent) — a real dial verifies it later. */
export function sightNumber(
	progress: DialerProgress,
	digits: string,
	source: string
): DialerProgress {
	if (!/^\d{7}$/.test(digits)) return progress;
	if (progress.verifiedSystems.some((id) => systemNumber(id) === digits)) return progress;
	if (progress.foundNumbers.some((f) => f.number === digits)) return progress;
	return { ...progress, foundNumbers: [...progress.foundNumbers, { number: digits, source }] };
}

/** Mark a system connected: it graduates from found → verified. */
export function verifySystem(progress: DialerProgress, systemId: string): DialerProgress {
	if (progress.verifiedSystems.includes(systemId)) return progress;
	const digits = systemNumber(systemId);
	return {
		...progress,
		verifiedSystems: [...progress.verifiedSystems, systemId],
		foundNumbers: progress.foundNumbers.filter((f) => f.number !== digits)
	};
}

function systemNumber(systemId: string): string | null {
	return CANON_SYSTEMS.find((s) => s.id === systemId)?.number ?? null;
}

async function writeFile(
	fs: TerminalFS,
	folder: string,
	name: string,
	text: string
): Promise<void> {
	const existing = await fileId(fs, name);
	if (existing) {
		await fs.writeText(existing, text);
		return;
	}
	await fs.createFile(folder, name, { appId: 'dialer', text });
}

async function progressFileId(fs: TerminalFS): Promise<string | null> {
	return fileId(fs, PROGRESS_FILE);
}

async function fileId(fs: TerminalFS, name: string): Promise<string | null> {
	const folder = await fs.getAppDataFolder('dialer');
	if (!folder.ok) return null;
	const listing = await fs.listFolder(folder.value);
	if (!listing.ok) return null;
	const file = listing.value.find((n) => n.kind === 'file' && n.name === name);
	return file?.id ?? null;
}

/** The in-fiction artifact a Finder-browsing caller stumbles on. */
function renderPhonebook(progress: DialerProgress): string {
	const lines = [
		'                    THE DIALER -- PHONEBOOK',
		'          numbers this modem has seen. dial them yourself.',
		'',
		'VERIFIED (you have connected):'
	];
	if (progress.verifiedSystems.length === 0) {
		lines.push('  (none yet)');
	} else {
		for (const id of progress.verifiedSystems) {
			const system = CANON_SYSTEMS.find((s) => s.id === id);
			if (system) lines.push(`  ${formatNumber(system.number)}   ${system.name}`);
		}
	}
	lines.push('', 'UNVERIFIED (seen, not yet dialed):');
	if (progress.foundNumbers.length === 0) {
		lines.push('  (none yet)');
	} else {
		for (const found of progress.foundNumbers) {
			lines.push(`  ${formatNumber(found.number)}   ?UNVERIFIED?   -- ${found.source}`);
		}
	}
	if (progress.scanlogs.length > 0) {
		lines.push('', `EXCHANGE SWEEPS ON FILE: ${progress.scanlogs.length}`);
		for (const log of progress.scanlogs) lines.push(`  ${log.block}   ${log.date}`);
	}
	lines.push('', `Door-game best: ${progress.doorHighScore}`);
	return lines.join('\n') + '\n';
}

/** Strictly-shaped parse: anything off returns null (treated as corrupt). */
function parseProgress(text: string): DialerProgress | null {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;

	const session = parseSession(r.session);
	if (session === undefined) return null;

	const foundNumbers = parseFoundNumbers(r.foundNumbers);
	if (!foundNumbers) return null;
	const scanlogs = parseScanlogs(r.scanlogs);
	if (!scanlogs) return null;

	return {
		handle: typeof r.handle === 'string' ? r.handle : (session?.handle ?? null),
		session,
		foundNumbers,
		verifiedSystems: stringArray(r.verifiedSystems),
		readPosts: stringArray(r.readPosts),
		scanlogs,
		lodestoneUnlocked: r.lodestoneUnlocked === true,
		doorHighScore: typeof r.doorHighScore === 'number' ? r.doorHighScore : 0
	};
}

/** Session: undefined = malformed (fail the whole parse), null = logged out. */
function parseSession(value: unknown): Session | null | undefined {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'object') return undefined;
	const s = value as Record<string, unknown>;
	if (
		typeof s.handle !== 'string' ||
		typeof s.token !== 'string' ||
		typeof s.expiresAt !== 'number'
	)
		return undefined;
	return { handle: s.handle, token: s.token, expiresAt: s.expiresAt };
}

function parseFoundNumbers(value: unknown): FoundNumber[] | null {
	if (value === undefined) return [];
	if (!Array.isArray(value)) return null;
	const out: FoundNumber[] = [];
	for (const item of value) {
		if (typeof item !== 'object' || item === null) return null;
		const f = item as Record<string, unknown>;
		if (typeof f.number !== 'string' || typeof f.source !== 'string') return null;
		out.push({ number: f.number, source: f.source });
	}
	return out;
}

function parseScanlogs(value: unknown): Scanlog[] | null {
	if (value === undefined) return [];
	if (!Array.isArray(value)) return null;
	const out: Scanlog[] = [];
	for (const item of value) {
		if (typeof item !== 'object' || item === null) return null;
		const s = item as Record<string, unknown>;
		if (typeof s.block !== 'string' || typeof s.date !== 'string' || !Array.isArray(s.lines))
			return null;
		if (!s.lines.every((l) => typeof l === 'string')) return null;
		out.push({ block: s.block, date: s.date, lines: s.lines as string[] });
	}
	return out;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
