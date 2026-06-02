import type { TerminalFS } from '$lib/terminalos/filesystem/terminal-fs';
import type { FsNode } from '$lib/terminalos/filesystem/types';
import { DOCUMENTS_ID } from '$lib/terminalos/filesystem/well-known-ids';
import type { StickyNote } from './types';

/** Default note color (yellow) — the seed and any unparseable file fall back here. */
const DEFAULT_COLOR = '#f9bd2b';

/**
 * Parse a sticky file node into a StickyNote. The filesystem IS the state: a note
 * window is a live view of its own file (Color writes the file, the window reads
 * it back via fs.watch), so this is the single decode path. Null-safe — a missing
 * or non-file node (deleted out from under an open window) yields a blank default
 * rather than throwing.
 */
export function stickyFromFile(f: Readonly<FsNode> | null | undefined): StickyNote {
	const file = f && f.kind === 'file' ? f : null;
	const text = file?.bodyRef?.kind === 'inline-text' ? file.bodyRef.text : '';
	try {
		const parsed = JSON.parse(text) as { title?: string; body?: string; color?: string };
		return {
			id: file?.id ?? '',
			title: parsed.title ?? '',
			body: parsed.body ?? '',
			color: parsed.color ?? DEFAULT_COLOR
		};
	} catch {
		return { id: file?.id ?? '', title: '', body: '', color: DEFAULT_COLOR };
	}
}

/**
 * Create a new blank note file in Documents and return its id (or '' on failure).
 * The name is the first free "Untitled Note [N]". No cache to refresh — Finder
 * reads notes straight from the filesystem, and each open window views its file.
 */
export async function createStickyNote(fs: TerminalFS): Promise<string> {
	let name = 'Untitled Note';
	let suffix = 1;
	const names = fs.findByApp('stickies').map((f) => f.name);
	while (names.includes(name)) {
		suffix++;
		name = `Untitled Note ${suffix}`;
	}
	const data = JSON.stringify({ title: '', body: '', color: DEFAULT_COLOR });
	const result = await fs.createFile(DOCUMENTS_ID, name, {
		appId: 'stickies',
		fileType: 'sticky',
		text: data
	});
	return result.ok ? result.value.id : '';
}

/** Seed the first-run "v1 launch — todo" note if no sticky files exist yet. */
export async function seedDefaultStickies(fs: TerminalFS): Promise<void> {
	if (fs.findByApp('stickies').length > 0) return;
	const defaultData = JSON.stringify({
		title: 'v1 launch — todo',
		body: '☑ ship Seinfeld\n☑ ship The Office\n☒ get sued\n☐ teach Kramer to type\n☐ figure out Joey/Phoebe\n☐ "try Succession?"',
		color: DEFAULT_COLOR
	});
	await fs.createFile(DOCUMENTS_ID, 'v1 launch — todo', {
		appId: 'stickies',
		fileType: 'sticky',
		text: defaultData
	});
}

/** Write a full note back to its file (title + body + color as one JSON blob). */
export async function updateSticky(fs: TerminalFS, note: StickyNote): Promise<void> {
	const data = JSON.stringify({ title: note.title, body: note.body, color: note.color });
	await fs.writeText(note.id, data);
}

/**
 * Set just the color of a note. Reads the current file to preserve title/body —
 * this is the Color menu's write. The open window reflects the new color via
 * fs.watch; it owns title/body while open, so its own debounced save reconciles
 * any in-flight typing on the next flush.
 */
export async function setStickyColor(fs: TerminalFS, id: string, color: string): Promise<void> {
	const current = stickyFromFile(fs.peekNode(id));
	await updateSticky(fs, { ...current, id, color });
}

/** Delete a note's file. */
export async function deleteStickyNote(fs: TerminalFS, id: string): Promise<void> {
	await fs.deleteNode(id);
}
