import { describe, expect, it } from 'vitest';
import {
	DESKTOP_ID,
	DOCUMENTS_ID,
	ROOT_ID,
	TRASH_ID,
	TerminalFS,
	type FsNode
} from '$lib/terminalos';
import {
	canDragFilesystemNode,
	canDropFilesystemNode,
	readFilesystemDragNodeId,
	performFilesystemDrop
} from './filesystem-drag';

function createDisk() {
	return TerminalFS.createCleanDisk();
}

async function expectParent(fs: TerminalFS, nodeId: string, parentId: string) {
	const node = await fs.getNode(nodeId);
	expect(node.ok).toBe(true);
	if (node.ok) expect(node.value.parentId).toBe(parentId);
}

describe('filesystem drag/drop policy', () => {
	it('ignores external text/plain drag payloads', () => {
		const data = {
			getData(type: string) {
				return type === 'text/plain' ? DOCUMENTS_ID : '';
			}
		} as DataTransfer;

		expect(readFilesystemDragNodeId(data)).toBeNull();
	});

	it('moves a dragged Finder item to the Desktop folder', async () => {
		const fs = createDisk();
		const created = await fs.createTextFile(DOCUMENTS_ID, 'Dragged.txt', 'hello');
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const result = await performFilesystemDrop(fs, created.value.id, {
			kind: 'folder',
			folderId: DESKTOP_ID
		});

		expect(result.ok).toBe(true);
		await expectParent(fs, created.value.id, DESKTOP_ID);
	});

	it('moves a dragged Desktop item into the open Finder folder', async () => {
		const fs = createDisk();
		const created = await fs.createTextFile(DESKTOP_ID, 'To Documents.txt', 'hello');
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const result = await performFilesystemDrop(fs, created.value.id, {
			kind: 'folder',
			folderId: DOCUMENTS_ID
		});

		expect(result.ok).toBe(true);
		await expectParent(fs, created.value.id, DOCUMENTS_ID);
	});

	it('moves a dragged item onto a Finder folder', async () => {
		const fs = createDisk();
		const folder = await fs.createFolder(DOCUMENTS_ID, 'Drop Target');
		const file = await fs.createTextFile(DOCUMENTS_ID, 'Move Me.txt', 'hello');
		expect(folder.ok).toBe(true);
		expect(file.ok).toBe(true);
		if (!folder.ok || !file.ok) return;

		const result = await performFilesystemDrop(fs, file.value.id, {
			kind: 'folder',
			folderId: folder.value.id
		});

		expect(result.ok).toBe(true);
		await expectParent(fs, file.value.id, folder.value.id);
	});

	it('trashes a dragged item through the shared trash action', async () => {
		const fs = createDisk();
		const created = await fs.createTextFile(DESKTOP_ID, 'Trash Me.txt', 'bye');
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const result = await performFilesystemDrop(fs, created.value.id, { kind: 'trash' });

		expect(result.ok).toBe(true);
		await expectParent(fs, created.value.id, TRASH_ID);
	});

	it('treats dropping into the current parent as a no-op', async () => {
		const fs = createDisk();
		const created = await fs.createTextFile(DOCUMENTS_ID, 'Already Here.txt', 'hello');
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const result = await performFilesystemDrop(fs, created.value.id, {
			kind: 'folder',
			folderId: DOCUMENTS_ID
		});

		expect(result.ok).toBe(true);
		await expectParent(fs, created.value.id, DOCUMENTS_ID);
	});

	it('keeps TerminalFS validation for invalid moves', async () => {
		const fs = createDisk();
		const folder = await fs.createFolder(DOCUMENTS_ID, 'Folder');
		expect(folder.ok).toBe(true);
		if (!folder.ok) return;

		const result = await performFilesystemDrop(fs, folder.value.id, {
			kind: 'folder',
			folderId: folder.value.id
		});

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('invalid_move');
	});

	it('does not advertise dragging a folder over itself as droppable', async () => {
		const fs = createDisk();
		const folder = await fs.createFolder(DOCUMENTS_ID, 'Folder');
		expect(folder.ok).toBe(true);
		if (!folder.ok) return;

		expect(
			canDropFilesystemNode(folder.value, { kind: 'folder', folderId: folder.value.id }, fs)
		).toBe(false);
	});

	it('does not advertise dragging a folder over a descendant as droppable', async () => {
		const fs = createDisk();
		const parent = await fs.createFolder(DOCUMENTS_ID, 'Parent');
		expect(parent.ok).toBe(true);
		if (!parent.ok) return;
		const child = await fs.createFolder(parent.value.id, 'Child');
		expect(child.ok).toBe(true);
		if (!child.ok) return;

		expect(
			canDropFilesystemNode(parent.value, { kind: 'folder', folderId: child.value.id }, fs)
		).toBe(false);

		const result = await performFilesystemDrop(fs, parent.value.id, {
			kind: 'folder',
			folderId: child.value.id
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('invalid_move');
	});

	it('advertises valid sibling and unrelated folder targets as droppable', async () => {
		const fs = createDisk();
		const source = await fs.createFolder(DOCUMENTS_ID, 'Source');
		const sibling = await fs.createFolder(DOCUMENTS_ID, 'Sibling');
		expect(source.ok).toBe(true);
		expect(sibling.ok).toBe(true);
		if (!source.ok || !sibling.ok) return;

		expect(
			canDropFilesystemNode(source.value, { kind: 'folder', folderId: sibling.value.id }, fs)
		).toBe(true);
		expect(canDropFilesystemNode(source.value, { kind: 'folder', folderId: DESKTOP_ID }, fs)).toBe(
			true
		);
	});

	it('does not advertise protected nodes as draggable or droppable', async () => {
		const fs = createDisk();
		const root = await fs.getNode(ROOT_ID);
		expect(root.ok).toBe(true);
		if (!root.ok) return;

		expect(canDragFilesystemNode(root.value)).toBe(false);
		expect(
			canDropFilesystemNode(root.value as FsNode, { kind: 'folder', folderId: DOCUMENTS_ID })
		).toBe(false);
	});
});
