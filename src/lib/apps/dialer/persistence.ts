/**
 * Local progress in TerminalFS AppData (PRD persistence spec): the session
 * lives in `progress.json` under /System/AppData/dialer, so it survives
 * backup/restore with the disk and app uninstall/reinstall. The shape is
 * forward-compatible — later slices add found numbers, read posts, and
 * scanlogs to the same file. Corrupt JSON heals to fresh progress and the
 * file is rewritten.
 */
import type { TerminalFS } from '$lib/terminalos';
import type { Session } from './api';

const PROGRESS_FILE = 'progress.json';

export type DialerProgress = {
	session: Session | null;
};

const FRESH: DialerProgress = { session: null };

export async function loadProgress(fs: TerminalFS): Promise<DialerProgress> {
	const file = await progressFileId(fs);
	if (!file) return { ...FRESH };
	const text = fs.readText(file);
	if (text === null) return { ...FRESH };

	const parsed = parseProgress(text);
	if (parsed) return parsed;
	// Corrupt file: heal it so the next load doesn't re-parse garbage.
	const fresh = { ...FRESH };
	await saveProgress(fs, fresh);
	return fresh;
}

export async function saveProgress(fs: TerminalFS, progress: DialerProgress): Promise<void> {
	const folder = await fs.getAppDataFolder('dialer');
	if (!folder.ok) return; // no disk, no memory — the session just won't stick
	const text = JSON.stringify(progress, null, '\t');

	const existing = await progressFileId(fs);
	if (existing) {
		await fs.writeText(existing, text);
		return;
	}
	await fs.createFile(folder.value, PROGRESS_FILE, { appId: 'dialer', text });
}

async function progressFileId(fs: TerminalFS): Promise<string | null> {
	const folder = await fs.getAppDataFolder('dialer');
	if (!folder.ok) return null;
	const listing = await fs.listFolder(folder.value);
	if (!listing.ok) return null;
	const file = listing.value.find((n) => n.kind === 'file' && n.name === PROGRESS_FILE);
	return file?.id ?? null;
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
	const session = (raw as { session?: unknown }).session;
	if (session === null || session === undefined) return { session: null };
	if (typeof session !== 'object') return null;
	const s = session as Record<string, unknown>;
	if (
		typeof s.handle !== 'string' ||
		typeof s.token !== 'string' ||
		typeof s.expiresAt !== 'number'
	)
		return null;
	return { session: { handle: s.handle, token: s.token, expiresAt: s.expiresAt } };
}
