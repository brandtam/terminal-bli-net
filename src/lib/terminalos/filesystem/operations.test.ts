import { describe, it, expect } from 'vitest';
import {
	TerminalFS,
	ROOT_ID,
	DOCUMENTS_ID,
	DESKTOP_ID,
	TRASH_ID,
	RECORDINGS_ID,
	APPDATA_ID
} from './terminal-fs';
import type { FsFolder, FsFile, FsAlias } from './types';

function createDisk() {
	return TerminalFS.createCleanDisk();
}

describe('createFolder', () => {
	it('creates a folder inside a parent', async () => {
		const fs = createDisk();
		const result = await fs.createFolder(DOCUMENTS_ID, 'Projects');
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const folder = result.value;
		expect(folder.kind).toBe('folder');
		expect(folder.name).toBe('Projects');
		expect(folder.parentId).toBe(DOCUMENTS_ID);

		// Should appear in parent listing
		const listing = await fs.listFolder(DOCUMENTS_ID);
		expect(listing.ok).toBe(true);
		if (!listing.ok) return;
		const names = listing.value.map((n) => n.name);
		expect(names).toContain('Projects');
	});

	it('rejects duplicate name (case-insensitive)', async () => {
		const fs = createDisk();
		await fs.createFolder(DOCUMENTS_ID, 'Projects');
		const result = await fs.createFolder(DOCUMENTS_ID, 'projects');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('duplicate_name');
		}
	});

	it('rejects creation in a non-folder', async () => {
		const fs = createDisk();
		// Find a file node
		const docs = await fs.listFolder(DOCUMENTS_ID);
		if (!docs.ok) return;
		const file = docs.value.find((n) => n.kind === 'file');
		expect(file).toBeDefined();
		if (!file) return;

		const result = await fs.createFolder(file.id, 'Nope');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_folder');
		}
	});
});

describe('createTextFile', () => {
	it('creates a text file with inline-text bodyRef', async () => {
		const fs = createDisk();
		const result = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'Hello world');
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const file = result.value;
		expect(file.kind).toBe('file');
		expect(file.name).toBe('Notes.txt');
		expect(file.fileType).toBe('text');
		expect(file.opensWith).toBe('textedit');
		expect(file.bodyRef).toEqual({ kind: 'inline-text', text: 'Hello world' });
		expect(file.parentId).toBe(DOCUMENTS_ID);
	});

	it('rejects duplicate name', async () => {
		const fs = createDisk();
		// README.TXT already exists in Documents
		const result = await fs.createTextFile(DOCUMENTS_ID, 'README.TXT', 'dupe');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('duplicate_name');
		}
	});
});

describe('createBlobFile', () => {
	it('creates a file with an indexeddb-blob bodyRef and round-trips the bytes', async () => {
		const fs = createDisk();
		const bytes = new Uint8Array([1, 2, 3, 4, 5, 200, 255]);
		const result = await fs.createBlobFile(RECORDINGS_ID, 'Clip.webm', bytes.buffer, {
			appId: 'recorder',
			fileType: 'recording',
			contentType: 'video/webm'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const file = result.value;
		expect(file.bodyRef?.kind).toBe('indexeddb-blob');
		if (file.bodyRef?.kind !== 'indexeddb-blob') return;
		expect(file.bodyRef.size).toBe(bytes.byteLength);
		expect(file.bodyRef.contentType).toBe('video/webm');

		const read = await fs.readBody(file.bodyRef.bodyId);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		expect(new Uint8Array(read.value)).toEqual(bytes);
	});

	it('sets fileType and appId from opts', async () => {
		const fs = createDisk();
		const result = await fs.createBlobFile(
			RECORDINGS_ID,
			'Clip2.webm',
			new Uint8Array([9]).buffer,
			{
				appId: 'recorder',
				fileType: 'recording'
			}
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.fileType).toBe('recording');
		expect(result.value.appId).toBe('recorder');
		expect(result.value.opensWith).toBe('recorder');
	});

	it('lets opensWith differ from appId (creator vs handler)', async () => {
		const fs = createDisk();
		const result = await fs.createBlobFile(
			RECORDINGS_ID,
			'Clip3.webm',
			new Uint8Array([7]).buffer,
			{
				appId: 'recorder',
				opensWith: 'player',
				fileType: 'recording'
			}
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// A recording is created by 'recorder' but opened by the system 'player',
		// so it stays playable after Recorder (a store app) is uninstalled.
		expect(result.value.appId).toBe('recorder');
		expect(result.value.opensWith).toBe('player');
	});

	it('rejects duplicate name', async () => {
		const fs = createDisk();
		await fs.createBlobFile(RECORDINGS_ID, 'Dupe.webm', new Uint8Array([1]).buffer, {});
		const result = await fs.createBlobFile(
			RECORDINGS_ID,
			'dupe.webm',
			new Uint8Array([2]).buffer,
			{}
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('duplicate_name');
		}
	});
});

describe('getAppDataFolder / per-app FS scope', () => {
	it('returns a folder id and is idempotent for the same appId', async () => {
		const fs = createDisk();

		const first = await fs.getAppDataFolder('chatrbot');
		expect(first.ok).toBe(true);
		if (!first.ok) return;

		const second = await fs.getAppDataFolder('chatrbot');
		expect(second.ok).toBe(true);
		if (!second.ok) return;

		// Same call twice returns the same folder — no duplicate created.
		expect(second.value).toBe(first.value);

		const listing = await fs.listFolder(APPDATA_ID);
		expect(listing.ok).toBe(true);
		if (!listing.ok) return;
		const chatrbotFolders = listing.value.filter((n) => n.name === 'chatrbot');
		expect(chatrbotFolders).toHaveLength(1);
	});

	it('gives different appIds different folders, both under AppData', async () => {
		const fs = createDisk();

		const a = await fs.getAppDataFolder('chatrbot');
		const b = await fs.getAppDataFolder('recorder');
		expect(a.ok).toBe(true);
		expect(b.ok).toBe(true);
		if (!a.ok || !b.ok) return;

		expect(a.value).not.toBe(b.value);

		const nodes = fs.getAllNodes();
		expect(nodes.get(a.value)?.parentId).toBe(APPDATA_ID);
		expect(nodes.get(b.value)?.parentId).toBe(APPDATA_ID);
		expect(nodes.get(a.value)?.name).toBe('chatrbot');
		expect(nodes.get(b.value)?.name).toBe('recorder');
	});

	it('keeps app files out of the disk root', async () => {
		const fs = createDisk();

		const folder = await fs.getAppDataFolder('chatrbot');
		expect(folder.ok).toBe(true);
		if (!folder.ok) return;

		const file = await fs.createBlobFile(
			folder.value,
			'save.bin',
			new Uint8Array([1, 2, 3]).buffer,
			{ appId: 'chatrbot' }
		);
		expect(file.ok).toBe(true);
		if (!file.ok) return;

		const root = await fs.listFolder(ROOT_ID);
		expect(root.ok).toBe(true);
		if (!root.ok) return;
		expect(root.value.map((n) => n.name)).not.toContain('save.bin');
	});

	it('self-heals: recreates the AppData container on an old disk', async () => {
		// Simulate a disk persisted before AppData existed by exporting a backup,
		// stripping the AppData node, and restoring it. restoreBackup replaces the
		// live node map wholesale, so the container is genuinely gone.
		const source = createDisk();
		const exported = await source.exportBackup();
		expect(exported.ok).toBe(true);
		if (!exported.ok) return;

		const stripped = {
			...exported.value,
			nodes: exported.value.nodes.filter((n) => n.id !== APPDATA_ID)
		};

		const fs = TerminalFS.createCleanDisk();
		const restored = await fs.restoreBackup(stripped);
		expect(restored.ok).toBe(true);
		if (!restored.ok) return;
		expect(fs.getAllNodes().has(APPDATA_ID)).toBe(false);

		const folder = await fs.getAppDataFolder('chatrbot');
		expect(folder.ok).toBe(true);
		if (!folder.ok) return;

		// Container was recreated under /System, app folder parented to it.
		expect(fs.getAllNodes().has(APPDATA_ID)).toBe(true);
		expect(fs.getAllNodes().get(folder.value)?.parentId).toBe(APPDATA_ID);
	});

	it('covers app-scoped files in backup, round-tripping blob bytes', async () => {
		const source = createDisk();

		const folder = await source.getAppDataFolder('chatrbot');
		expect(folder.ok).toBe(true);
		if (!folder.ok) return;

		const bytes = new Uint8Array([10, 20, 30, 200, 255]);
		const created = await source.createBlobFile(folder.value, 'save.bin', bytes.buffer, {
			appId: 'chatrbot'
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const exported = await source.exportBackup();
		expect(exported.ok).toBe(true);
		if (!exported.ok) return;

		const fresh = TerminalFS.createCleanDisk();
		const restored = await fresh.restoreBackup(exported.value);
		expect(restored.ok).toBe(true);
		if (!restored.ok) return;

		// The app's AppData folder and its file survive restore.
		const appFolder = await fresh.getAppDataFolder('chatrbot');
		expect(appFolder.ok).toBe(true);
		if (!appFolder.ok) return;

		const listing = await fresh.listFolder(appFolder.value);
		expect(listing.ok).toBe(true);
		if (!listing.ok) return;
		const saved = listing.value.find((n) => n.name === 'save.bin');
		expect(saved).toBeDefined();
		if (!saved || saved.kind !== 'file' || saved.bodyRef?.kind !== 'indexeddb-blob') {
			throw new Error('expected restored blob file');
		}

		const read = await fresh.readBody(saved.bodyRef.bodyId);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		expect(new Uint8Array(read.value)).toEqual(bytes);
	});
});

describe('writeText', () => {
	it('updates file body and updatedAt', async () => {
		const fs = createDisk();
		const createResult = await fs.createTextFile(DOCUMENTS_ID, 'Draft.txt', 'v1');
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const original = createResult.value;
		const originalUpdatedAt = original.updatedAt;

		// Small delay to ensure timestamp differs
		const writeResult = await fs.writeText(original.id, 'v2');
		expect(writeResult.ok).toBe(true);
		if (!writeResult.ok) return;

		const updated = writeResult.value;
		expect(updated.bodyRef).toEqual({ kind: 'inline-text', text: 'v2' });
		expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
	});

	it('returns not_found for missing node', async () => {
		const fs = createDisk();
		const result = await fs.writeText('nonexistent', 'text');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});

describe('rename', () => {
	it('changes the name of a node', async () => {
		const fs = createDisk();
		const createResult = await fs.createFolder(DOCUMENTS_ID, 'OldName');
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const result = await fs.rename(createResult.value.id, 'NewName');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.name).toBe('NewName');
	});

	it('rejects if duplicate name in parent', async () => {
		const fs = createDisk();
		await fs.createFolder(DOCUMENTS_ID, 'Alpha');
		const bResult = await fs.createFolder(DOCUMENTS_ID, 'Beta');
		expect(bResult.ok).toBe(true);
		if (!bResult.ok) return;

		const result = await fs.rename(bResult.value.id, 'Alpha');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('duplicate_name');
		}
	});

	it('rejects renaming protected nodes', async () => {
		const fs = createDisk();
		// DOCUMENTS_ID is system+protected
		const result = await fs.rename(DOCUMENTS_ID, 'My Docs');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('protected_node');
		}
	});
});

describe('move', () => {
	it('changes parentId of a node', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Movable.txt', 'data');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const result = await fs.move(fileResult.value.id, DESKTOP_ID);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.parentId).toBe(DESKTOP_ID);
	});

	it('rejects cycle — folder into itself', async () => {
		const fs = createDisk();
		const folderResult = await fs.createFolder(DOCUMENTS_ID, 'Parent');
		expect(folderResult.ok).toBe(true);
		if (!folderResult.ok) return;

		const result = await fs.move(folderResult.value.id, folderResult.value.id);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('invalid_move');
		}
	});

	it('rejects cycle — folder into its own descendant', async () => {
		const fs = createDisk();
		const parentResult = await fs.createFolder(DOCUMENTS_ID, 'Outer');
		expect(parentResult.ok).toBe(true);
		if (!parentResult.ok) return;

		const childResult = await fs.createFolder(parentResult.value.id, 'Inner');
		expect(childResult.ok).toBe(true);
		if (!childResult.ok) return;

		const result = await fs.move(parentResult.value.id, childResult.value.id);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('invalid_move');
		}
	});

	it('rejects moving to a non-folder', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'A.txt', 'a');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const file2Result = await fs.createTextFile(DOCUMENTS_ID, 'B.txt', 'b');
		expect(file2Result.ok).toBe(true);
		if (!file2Result.ok) return;

		const result = await fs.move(fileResult.value.id, file2Result.value.id);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_folder');
		}
	});

	it('rejects name conflict in target folder', async () => {
		const fs = createDisk();
		// Create files with the same name in two different folders
		await fs.createTextFile(DOCUMENTS_ID, 'Clash.txt', 'a');
		const desktopFile = await fs.createTextFile(DESKTOP_ID, 'Clash.txt', 'b');
		expect(desktopFile.ok).toBe(true);
		if (!desktopFile.ok) return;

		const result = await fs.move(desktopFile.value.id, DOCUMENTS_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('duplicate_name');
		}
	});

	it('rejects moving protected nodes', async () => {
		const fs = createDisk();
		// DOCUMENTS_ID is protected
		const result = await fs.move(DOCUMENTS_ID, DESKTOP_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('protected_node');
		}
	});

	it('preserves node ID after move', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Keep.txt', 'data');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const originalId = fileResult.value.id;
		const result = await fs.move(originalId, DESKTOP_ID);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.id).toBe(originalId);
	});
});

describe('duplicate', () => {
	it('duplicates a file with "name copy" pattern', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Original.txt', 'content');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const dupResult = await fs.duplicate(fileResult.value.id);
		expect(dupResult.ok).toBe(true);
		if (!dupResult.ok) return;

		const dup = dupResult.value as FsFile;
		expect(dup.name).toBe('Original.txt copy');
		expect(dup.parentId).toBe(DOCUMENTS_ID);
		expect(dup.id).not.toBe(fileResult.value.id);
		expect(dup.kind).toBe('file');
	});

	it('duplicates a folder with all children (deep copy)', async () => {
		const fs = createDisk();
		const folderResult = await fs.createFolder(DOCUMENTS_ID, 'MyFolder');
		expect(folderResult.ok).toBe(true);
		if (!folderResult.ok) return;

		await fs.createTextFile(folderResult.value.id, 'A.txt', 'a');
		await fs.createTextFile(folderResult.value.id, 'B.txt', 'b');

		const dupResult = await fs.duplicate(folderResult.value.id);
		expect(dupResult.ok).toBe(true);
		if (!dupResult.ok) return;

		const dupFolder = dupResult.value as FsFolder;
		expect(dupFolder.name).toBe('MyFolder copy');
		expect(dupFolder.id).not.toBe(folderResult.value.id);

		// Children should also be duplicated
		const children = await fs.listFolder(dupFolder.id);
		expect(children.ok).toBe(true);
		if (!children.ok) return;
		expect(children.value.length).toBe(2);
		const childNames = children.value.map((n) => n.name).sort();
		expect(childNames).toEqual(['A.txt', 'B.txt']);

		// All child IDs should be new
		const originalChildren = await fs.listFolder(folderResult.value.id);
		if (!originalChildren.ok) return;
		const originalIds = new Set(originalChildren.value.map((n) => n.id));
		for (const child of children.value) {
			expect(originalIds.has(child.id)).toBe(false);
		}
	});

	it('duplicates an alias with the same target', async () => {
		const fs = createDisk();
		// Desktop has aliases — grab one
		const desktopResult = await fs.listFolder(DESKTOP_ID);
		expect(desktopResult.ok).toBe(true);
		if (!desktopResult.ok) return;

		const alias = desktopResult.value.find((n): n is FsAlias => n.kind === 'alias');
		expect(alias).toBeDefined();
		if (!alias) return;

		const dupResult = await fs.duplicate(alias.id);
		expect(dupResult.ok).toBe(true);
		if (!dupResult.ok) return;

		const dupAlias = dupResult.value as FsAlias;
		expect(dupAlias.id).not.toBe(alias.id);
		expect(dupAlias.kind).toBe('alias');
		expect(dupAlias.target.nodeId).toBe(alias.target.nodeId);
	});

	it('creates all new IDs for duplicated nodes', async () => {
		const fs = createDisk();
		const folderResult = await fs.createFolder(DOCUMENTS_ID, 'Orig');
		expect(folderResult.ok).toBe(true);
		if (!folderResult.ok) return;

		await fs.createTextFile(folderResult.value.id, 'Child.txt', 'c');

		const beforeIds = new Set(fs.getAllNodes().keys());
		const dupResult = await fs.duplicate(folderResult.value.id);
		expect(dupResult.ok).toBe(true);
		if (!dupResult.ok) return;

		const afterIds = new Set(fs.getAllNodes().keys());
		const newIds = [...afterIds].filter((id) => !beforeIds.has(id));
		// Should have at least 2 new IDs (folder + child)
		expect(newIds.length).toBeGreaterThanOrEqual(2);
	});

	it('increments copy name when "name copy" already exists', async () => {
		const fs = createDisk();
		await fs.createTextFile(DOCUMENTS_ID, 'File.txt', 'a');
		await fs.createTextFile(DOCUMENTS_ID, 'File.txt copy', 'b');

		const orig = await fs.listFolder(DOCUMENTS_ID);
		if (!orig.ok) return;
		const fileNode = orig.value.find((n) => n.name === 'File.txt');
		if (!fileNode) return;

		const dupResult = await fs.duplicate(fileNode.id);
		expect(dupResult.ok).toBe(true);
		if (!dupResult.ok) return;
		expect(dupResult.value.name).toBe('File.txt copy 2');
	});
});

describe('trash', () => {
	it('moves a node to the Trash folder', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Disposable.txt', 'bye');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const result = await fs.trash(fileResult.value.id);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.parentId).toBe(TRASH_ID);
		// ID is preserved
		expect(result.value.id).toBe(fileResult.value.id);
	});

	it('rejects trashing protected nodes', async () => {
		const fs = createDisk();
		const result = await fs.trash(DOCUMENTS_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('protected_node');
		}
	});

	it('rejects trashing the Trash folder itself', async () => {
		const fs = createDisk();
		const result = await fs.trash(TRASH_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('protected_node');
		}
	});
});

describe('emptyTrash', () => {
	it('permanently deletes all Trash contents', async () => {
		const fs = createDisk();
		// Trash some files
		const f1 = await fs.createTextFile(DOCUMENTS_ID, 'Gone1.txt', 'a');
		const f2 = await fs.createTextFile(DOCUMENTS_ID, 'Gone2.txt', 'b');
		if (!f1.ok || !f2.ok) return;

		await fs.trash(f1.value.id);
		await fs.trash(f2.value.id);

		const result = await fs.emptyTrash();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.deletedCount).toBe(2);

		// Trash should be empty
		const trashListing = await fs.listFolder(TRASH_ID);
		expect(trashListing.ok).toBe(true);
		if (!trashListing.ok) return;
		expect(trashListing.value.length).toBe(0);
	});

	it('clears undo history', async () => {
		const fs = createDisk();
		const f = await fs.createTextFile(DOCUMENTS_ID, 'Temp.txt', 'x');
		if (!f.ok) return;

		await fs.trash(f.value.id);
		// There should be an undo available for the trash
		const undoLabel = await fs.getUndoLabel();
		expect(undoLabel.ok).toBe(true);

		await fs.emptyTrash();

		// Undo should be cleared
		const result = await fs.undoLast();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});

describe('undoLast', () => {
	it('undoes createFolder — removes the created folder', async () => {
		const fs = createDisk();
		const result = await fs.createFolder(DOCUMENTS_ID, 'Undoable');
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const folderId = result.value.id;
		const undoResult = await fs.undoLast();
		expect(undoResult.ok).toBe(true);
		if (!undoResult.ok) return;
		expect(undoResult.value).toBe('Create folder "Undoable"');

		// Folder should be gone
		const getResult = await fs.getNode(folderId);
		expect(getResult.ok).toBe(false);
	});

	it('undoes move — moves node back to previous parent', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Bounceback.txt', 'data');
		if (!fileResult.ok) return;

		await fs.move(fileResult.value.id, DESKTOP_ID);
		const undoResult = await fs.undoLast();
		expect(undoResult.ok).toBe(true);

		const node = await fs.getNode(fileResult.value.id);
		expect(node.ok).toBe(true);
		if (!node.ok) return;
		expect(node.value.parentId).toBe(DOCUMENTS_ID);
	});

	it('undoes rename — restores previous name', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Before.txt', 'data');
		if (!fileResult.ok) return;

		await fs.rename(fileResult.value.id, 'After.txt');
		const undoResult = await fs.undoLast();
		expect(undoResult.ok).toBe(true);

		const node = await fs.getNode(fileResult.value.id);
		expect(node.ok).toBe(true);
		if (!node.ok) return;
		expect(node.value.name).toBe('Before.txt');
	});

	it('undoes duplicate — removes the duplicated nodes', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Source.txt', 'data');
		if (!fileResult.ok) return;

		const dupResult = await fs.duplicate(fileResult.value.id);
		expect(dupResult.ok).toBe(true);
		if (!dupResult.ok) return;

		const dupId = dupResult.value.id;
		const undoResult = await fs.undoLast();
		expect(undoResult.ok).toBe(true);

		// The duplicate should be removed
		const getResult = await fs.getNode(dupId);
		expect(getResult.ok).toBe(false);

		// The original should still exist
		const origResult = await fs.getNode(fileResult.value.id);
		expect(origResult.ok).toBe(true);
	});

	it('undoes trash — moves node back from Trash', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Rescued.txt', 'data');
		if (!fileResult.ok) return;

		await fs.trash(fileResult.value.id);
		const undoResult = await fs.undoLast();
		expect(undoResult.ok).toBe(true);

		const node = await fs.getNode(fileResult.value.id);
		expect(node.ok).toBe(true);
		if (!node.ok) return;
		expect(node.value.parentId).toBe(DOCUMENTS_ID);
	});

	it('undoes deleteNode — restores the deleted node and its descendants', async () => {
		const fs = createDisk();
		const folder = await fs.createFolder(DOCUMENTS_ID, 'Parent');
		if (!folder.ok) throw new Error('setup');
		const child = await fs.createTextFile(folder.value.id, 'child.txt', 'data');
		if (!child.ok) throw new Error('setup');

		await fs.deleteNode(folder.value.id);

		// Both should be gone
		const gone1 = await fs.getNode(folder.value.id);
		expect(gone1.ok).toBe(false);
		const gone2 = await fs.getNode(child.value.id);
		expect(gone2.ok).toBe(false);

		// Undo should restore both
		const undoResult = await fs.undoLast();
		expect(undoResult.ok).toBe(true);

		const restored1 = await fs.getNode(folder.value.id);
		expect(restored1.ok).toBe(true);
		if (restored1.ok) expect(restored1.value.name).toBe('Parent');

		const restored2 = await fs.getNode(child.value.id);
		expect(restored2.ok).toBe(true);
		if (restored2.ok) expect(restored2.value.name).toBe('child.txt');
	});

	it('returns not_found when no undo available', async () => {
		const fs = createDisk();
		const result = await fs.undoLast();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});

	it('is one-level only — second undo returns not_found', async () => {
		const fs = createDisk();
		await fs.createFolder(DOCUMENTS_ID, 'First');
		const firstUndo = await fs.undoLast();
		expect(firstUndo.ok).toBe(true);

		const secondUndo = await fs.undoLast();
		expect(secondUndo.ok).toBe(false);
		if (!secondUndo.ok) {
			expect(secondUndo.error.code).toBe('not_found');
		}
	});
});

describe('getUndoLabel', () => {
	it('returns the label of the last operation', async () => {
		const fs = createDisk();
		await fs.createFolder(DOCUMENTS_ID, 'Labeled');
		const result = await fs.getUndoLabel();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toBe('Create folder "Labeled"');
	});

	it('returns not_found when no undo available', async () => {
		const fs = createDisk();
		const result = await fs.getUndoLabel();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});
