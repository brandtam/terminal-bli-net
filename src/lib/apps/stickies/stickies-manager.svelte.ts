import { findByApp, createFile, writeFile, deleteNode, DOCS_ID } from '$lib/os/filesystem';
import type { FSFile } from '$lib/os/filesystem';
import { appRead } from '$lib/persistence';
import type { StickyNote } from './StickiesNote.svelte';

function stickyFromFile(f: FSFile): StickyNote {
	try {
		const parsed = JSON.parse(f.data) as { title?: string; body?: string; color?: string };
		return {
			id: f.id,
			title: parsed.title ?? '',
			body: parsed.body ?? '',
			color: parsed.color ?? '#f9bd2b'
		};
	} catch {
		return { id: f.id, title: '', body: '', color: '#f9bd2b' };
	}
}

export function createStickiesManager() {
	let notes = $state<StickyNote[]>([]);

	function load(): StickyNote[] {
		const files = findByApp('stickies');
		if (files.length > 0) return files.map(stickyFromFile);

		// Migrate from legacy appRead persistence if present
		const legacy = appRead<StickyNote[] | null>('stickies', 'notes', null);
		if (legacy && legacy.length > 0) {
			const migrated: StickyNote[] = [];
			for (const note of legacy) {
				const name = note.title || 'Untitled Note';
				const data = JSON.stringify({ title: note.title, body: note.body, color: note.color });
				try {
					const file = createFile(DOCS_ID, name, 'stickies', data);
					migrated.push({ ...note, id: file.id });
				} catch {
					const file = createFile(DOCS_ID, `${name} (${note.id.slice(-4)})`, 'stickies', data);
					migrated.push({ ...note, id: file.id });
				}
			}
			return migrated;
		}

		// Seed a default note for first-time users
		const defaultData = JSON.stringify({
			title: 'v1 launch — todo',
			body: '☑ ship Seinfeld\n☑ ship The Office\n☒ get sued\n☐ teach Kramer to type\n☐ figure out Joey/Phoebe\n☐ "try Succession?"',
			color: '#f9bd2b'
		});
		const file = createFile(DOCS_ID, 'v1 launch — todo', 'stickies', defaultData);
		return [stickyFromFile(file)];
	}

	function refresh() {
		notes = findByApp('stickies').map(stickyFromFile);
	}

	function init() {
		notes = load();
	}

	function create(): string {
		let name = 'Untitled Note';
		let suffix = 1;
		const existing = findByApp('stickies');
		const names = new Set(existing.map((f) => f.name));
		while (names.has(name)) {
			suffix++;
			name = `Untitled Note ${suffix}`;
		}
		const data = JSON.stringify({ title: '', body: '', color: '#f9bd2b' });
		const file = createFile(DOCS_ID, name, 'stickies', data);
		refresh();
		return file.id;
	}

	function remove(id: string) {
		deleteNode(id);
		refresh();
	}

	function update(updated: StickyNote) {
		const data = JSON.stringify({ title: updated.title, body: updated.body, color: updated.color });
		try {
			writeFile(updated.id, data);
		} catch {
			// file may have been deleted
		}
		refresh();
	}

	function setColor(noteId: string, color: string) {
		const note = notes.find((n) => n.id === noteId);
		if (!note) return;
		update({ ...note, color });
	}

	return {
		get notes() {
			return notes;
		},
		init,
		create,
		remove,
		update,
		setColor,
		refresh
	};
}
