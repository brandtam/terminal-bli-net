import { describe, it, expect } from 'vitest';
import { TerminalFS, APPLICATIONS_ID, DOCUMENTS_ID, DESKTOP_ID, TRASH_ID } from './terminal-fs';
import type { FsAlias, FsFile, FsFolder } from './types';

function createDisk() {
	return TerminalFS.createCleanDisk();
}

describe('TerminalFS.createAlias', () => {
	it('creates alias to a file', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'hello');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		const alias = aliasResult.value;
		expect(alias.kind).toBe('alias');
		expect(alias.parentId).toBe(DESKTOP_ID);
		expect(alias.target.nodeId).toBe(fileResult.value.id);
		expect(alias.target.targetKind).toBe('file');
		expect(alias.target.originalName).toBe('Notes.txt');
		expect(alias.target.fingerprint).toBe('text');
	});

	it('creates alias to a folder', async () => {
		const fs = createDisk();
		const folderResult = await fs.createFolder(DOCUMENTS_ID, 'Projects');
		expect(folderResult.ok).toBe(true);
		if (!folderResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, folderResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		const alias = aliasResult.value;
		expect(alias.target.targetKind).toBe('folder');
		expect(alias.target.originalName).toBe('Projects');
		expect(alias.target.fingerprint).toBeUndefined();
	});

	it('creates alias to an app with fingerprint = appId', async () => {
		const fs = createDisk();
		// Find an app file in /Applications
		const appsResult = await fs.listFolder(APPLICATIONS_ID);
		expect(appsResult.ok).toBe(true);
		if (!appsResult.ok) return;

		const appFile = appsResult.value.find(
			(n): n is FsFile => n.kind === 'file' && n.fileType === 'app' && n.appId !== undefined
		);
		expect(appFile).toBeDefined();
		if (!appFile) return;

		// Create alias in Documents to avoid desktop name conflict
		const aliasResult = await fs.createAlias(DOCUMENTS_ID, appFile.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		const alias = aliasResult.value;
		expect(alias.target.targetKind).toBe('app');
		expect(alias.target.fingerprint).toBe(appFile.appId);
	});

	it('uses target name when no name given', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Report.txt', 'data');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		expect(aliasResult.value.name).toBe('Report.txt');
	});

	it('uses custom name when provided', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Report.txt', 'data');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id, 'My Report');
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		expect(aliasResult.value.name).toBe('My Report');
	});

	it('rejects duplicate name (case-insensitive)', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'hello');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		// Create first alias
		const alias1 = await fs.createAlias(DESKTOP_ID, fileResult.value.id, 'MyAlias');
		expect(alias1.ok).toBe(true);

		// Try to create second alias with same name (different case)
		const alias2 = await fs.createAlias(DESKTOP_ID, fileResult.value.id, 'myalias');
		expect(alias2.ok).toBe(false);
		if (!alias2.ok) {
			expect(alias2.error.code).toBe('duplicate_name');
		}
	});

	it('rejects alias to non-existent target', async () => {
		const fs = createDisk();
		const result = await fs.createAlias(DESKTOP_ID, 'nonexistent_id');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});

describe('TerminalFS.resolveAlias', () => {
	it('resolves by direct ID hit', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'hello');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		const resolved = await fs.resolveAlias(aliasResult.value.id);
		expect(resolved.ok).toBe(true);
		if (!resolved.ok) return;

		expect(resolved.value.id).toBe(fileResult.value.id);
		expect(resolved.value.name).toBe('Notes.txt');
	});

	it('survives target rename', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'hello');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		// Rename the target
		const renameResult = await fs.rename(fileResult.value.id, 'Renamed.txt');
		expect(renameResult.ok).toBe(true);

		// Resolve should still work — same ID
		const resolved = await fs.resolveAlias(aliasResult.value.id);
		expect(resolved.ok).toBe(true);
		if (!resolved.ok) return;

		expect(resolved.value.id).toBe(fileResult.value.id);
		expect(resolved.value.name).toBe('Renamed.txt');
	});

	it('survives target move', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'hello');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		// Create a subfolder and move the target there
		const subResult = await fs.createFolder(DOCUMENTS_ID, 'Archive');
		expect(subResult.ok).toBe(true);
		if (!subResult.ok) return;

		const moveResult = await fs.move(fileResult.value.id, subResult.value.id);
		expect(moveResult.ok).toBe(true);

		// Resolve should still work — same ID
		const resolved = await fs.resolveAlias(aliasResult.value.id);
		expect(resolved.ok).toBe(true);
		if (!resolved.ok) return;

		expect(resolved.value.id).toBe(fileResult.value.id);
	});

	it('resolves folder alias to the folder', async () => {
		const fs = createDisk();
		const folderResult = await fs.createFolder(DOCUMENTS_ID, 'Projects');
		expect(folderResult.ok).toBe(true);
		if (!folderResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, folderResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		const resolved = await fs.resolveAlias(aliasResult.value.id);
		expect(resolved.ok).toBe(true);
		if (!resolved.ok) return;

		expect(resolved.value.kind).toBe('folder');
		expect(resolved.value.id).toBe(folderResult.value.id);
	});

	it('returns broken_alias when target is deleted', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Doomed.txt', 'bye');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		// Trash and empty to fully delete
		await fs.trash(fileResult.value.id);
		await fs.emptyTrash();

		const resolved = await fs.resolveAlias(aliasResult.value.id);
		expect(resolved.ok).toBe(false);
		if (!resolved.ok) {
			expect(resolved.error.code).toBe('broken_alias');
		}
	});

	it('auto-repairs by name and kind when one candidate matches', async () => {
		const fs = createDisk();

		// Create a text file and alias to it
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Budget.txt', 'v1');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		const aliasId = aliasResult.value.id;

		// Delete the original target
		await fs.trash(fileResult.value.id);
		await fs.emptyTrash();

		// Create a new file with the same name
		const newFileResult = await fs.createTextFile(DOCUMENTS_ID, 'Budget.txt', 'v2');
		expect(newFileResult.ok).toBe(true);
		if (!newFileResult.ok) return;

		// Resolve should auto-repair to the new file
		const resolved = await fs.resolveAlias(aliasId);
		expect(resolved.ok).toBe(true);
		if (!resolved.ok) return;

		expect(resolved.value.id).toBe(newFileResult.value.id);
		expect(resolved.value.name).toBe('Budget.txt');

		// Verify the alias was updated in the FS
		const aliasNode = await fs.getNode(aliasId);
		expect(aliasNode.ok).toBe(true);
		if (!aliasNode.ok) return;
		expect(aliasNode.value.kind).toBe('alias');
		if (aliasNode.value.kind === 'alias') {
			expect(aliasNode.value.target.nodeId).toBe(newFileResult.value.id);
		}
	});

	it('does not auto-repair when multiple candidates exist', async () => {
		const fs = createDisk();

		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'original');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		// Delete the original
		await fs.trash(fileResult.value.id);
		await fs.emptyTrash();

		// Create two files with the same name in different folders
		const sub = await fs.createFolder(DOCUMENTS_ID, 'Sub');
		expect(sub.ok).toBe(true);
		if (!sub.ok) return;

		await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'copy1');
		await fs.createTextFile(sub.value.id, 'Notes.txt', 'copy2');

		const resolved = await fs.resolveAlias(aliasResult.value.id);
		expect(resolved.ok).toBe(false);
		if (!resolved.ok) {
			expect(resolved.error.code).toBe('broken_alias');
			expect(resolved.error.message).toContain('Multiple');
		}
	});

	it('returns error for non-alias node', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'hello');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const resolved = await fs.resolveAlias(fileResult.value.id);
		expect(resolved.ok).toBe(false);
		if (!resolved.ok) {
			expect(resolved.error.code).toBe('not_found');
		}
	});

	it('undo removes created alias', async () => {
		const fs = createDisk();
		const fileResult = await fs.createTextFile(DOCUMENTS_ID, 'Notes.txt', 'hello');
		expect(fileResult.ok).toBe(true);
		if (!fileResult.ok) return;

		const aliasResult = await fs.createAlias(DESKTOP_ID, fileResult.value.id);
		expect(aliasResult.ok).toBe(true);
		if (!aliasResult.ok) return;

		const aliasId = aliasResult.value.id;

		// Verify alias exists
		const beforeUndo = await fs.getNode(aliasId);
		expect(beforeUndo.ok).toBe(true);

		// Undo
		const undoResult = await fs.undoLast();
		expect(undoResult.ok).toBe(true);

		// Verify alias is gone
		const afterUndo = await fs.getNode(aliasId);
		expect(afterUndo.ok).toBe(false);
		if (!afterUndo.ok) {
			expect(afterUndo.error.code).toBe('not_found');
		}
	});
});
