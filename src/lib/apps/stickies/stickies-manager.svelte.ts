import type { TerminalFS } from '$lib/terminalos';
import type { FsFile } from '$lib/terminalos';
import { DOCUMENTS_ID } from '$lib/terminalos';
import { appRead } from '$lib/persistence';
import type { StickyNote } from './StickiesNote.svelte';

function stickyFromFile(f: FsFile): StickyNote {
	const text = f.bodyRef?.kind === 'inline-text' ? f.bodyRef.text : '';
	try {
		const parsed = JSON.parse(text) as { title?: string; body?: string; color?: string };
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

export function createStickiesManager(fs: TerminalFS) {
	let notes = $state<StickyNote[]>([]);

	async function load(): Promise<StickyNote[]> {
		const files = fs.findByApp('stickies');
		if (files.length > 0) return files.map(stickyFromFile);

		// Migrate from legacy appRead persistence if present
		const legacy = appRead<StickyNote[] | null>('stickies', 'notes', null);
		if (legacy && legacy.length > 0) {
			const migrated: StickyNote[] = [];
			for (const note of legacy) {
				const name = note.title || 'Untitled Note';
				const data = JSON.stringify({ title: note.title, body: note.body, color: note.color });
				let result = await fs.createFile(DOCUMENTS_ID, name, {
					appId: 'stickies',
					fileType: 'sticky',
					text: data
				});
				if (!result.ok) {
					result = await fs.createFile(DOCUMENTS_ID, `${name} (${note.id.slice(-4)})`, {
						appId: 'stickies',
						fileType: 'sticky',
						text: data
					});
				}
				if (result.ok) {
					migrated.push({ ...note, id: result.value.id });
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
		const result = await fs.createFile(DOCUMENTS_ID, 'v1 launch — todo', {
			appId: 'stickies',
			fileType: 'sticky',
			text: defaultData
		});
		if (result.ok) return [stickyFromFile(result.value)];
		return [];
	}

	function refresh() {
		notes = fs.findByApp('stickies').map(stickyFromFile);
	}

	function init() {
		load().then((loaded) => {
			notes = loaded;
		});
	}

	async function create(): Promise<string> {
		let name = 'Untitled Note';
		let suffix = 1;
		const existing = fs.findByApp('stickies');
		const names = new Set(existing.map((f) => f.name));
		while (names.has(name)) {
			suffix++;
			name = `Untitled Note ${suffix}`;
		}
		const data = JSON.stringify({ title: '', body: '', color: '#f9bd2b' });
		const result = await fs.createFile(DOCUMENTS_ID, name, {
			appId: 'stickies',
			fileType: 'sticky',
			text: data
		});
		refresh();
		return result.ok ? result.value.id : '';
	}

	async function remove(id: string) {
		await fs.deleteNode(id);
		refresh();
	}

	async function update(updated: StickyNote) {
		const data = JSON.stringify({ title: updated.title, body: updated.body, color: updated.color });
		await fs.writeText(updated.id, data);
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
