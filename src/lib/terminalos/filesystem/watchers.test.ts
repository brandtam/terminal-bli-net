import { describe, it, expect, vi } from 'vitest';
import { TerminalFS, DOCUMENTS_ID, DESKTOP_ID, TRASH_ID } from './terminal-fs';

describe('watchers', () => {
	it('global watcher fires on createFolder', async () => {
		const fs = TerminalFS.createCleanDisk();
		const cb = vi.fn();
		fs.watch(cb);

		await fs.createFolder(DOCUMENTS_ID, 'Test');

		expect(cb).toHaveBeenCalledOnce();
		expect(cb.mock.calls[0][0].operation).toBe('create_folder');
		expect(cb.mock.calls[0][0].changedFolderIds).toContain(DOCUMENTS_ID);
		expect(cb.mock.calls[0][0].remote).toBe(false);
	});

	it('folder watcher fires when child is created', async () => {
		const fs = TerminalFS.createCleanDisk();
		const cb = vi.fn();
		fs.watchFolder(DOCUMENTS_ID, cb);

		await fs.createTextFile(DOCUMENTS_ID, 'test.txt', 'hello');

		expect(cb).toHaveBeenCalledOnce();
		expect(cb.mock.calls[0][0].operation).toBe('create_file');
	});

	it('folder watcher does not fire for other folders', async () => {
		const fs = TerminalFS.createCleanDisk();
		const cb = vi.fn();
		fs.watchFolder(DESKTOP_ID, cb);

		await fs.createTextFile(DOCUMENTS_ID, 'test.txt', 'hello');

		expect(cb).not.toHaveBeenCalled();
	});

	it('node watcher fires when node is renamed', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.createTextFile(DOCUMENTS_ID, 'test.txt', 'hello');
		if (!result.ok) throw new Error('setup failed');

		const cb = vi.fn();
		fs.watchNode(result.value.id, cb);

		await fs.rename(result.value.id, 'renamed.txt');

		expect(cb).toHaveBeenCalledOnce();
		expect(cb.mock.calls[0][0].operation).toBe('rename');
	});

	it('node watcher does not fire for other nodes', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result1 = await fs.createTextFile(DOCUMENTS_ID, 'a.txt', 'hello');
		const result2 = await fs.createTextFile(DOCUMENTS_ID, 'b.txt', 'world');
		if (!result1.ok || !result2.ok) throw new Error('setup failed');

		const cb = vi.fn();
		fs.watchNode(result1.value.id, cb);

		await fs.rename(result2.value.id, 'c.txt');

		expect(cb).not.toHaveBeenCalled();
	});

	it('global watcher fires on move with both parent folders', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.createTextFile(DOCUMENTS_ID, 'test.txt', 'hello');
		if (!result.ok) throw new Error('setup failed');

		const cb = vi.fn();
		fs.watch(cb);
		cb.mockClear();

		await fs.move(result.value.id, DESKTOP_ID);

		expect(cb).toHaveBeenCalledOnce();
		const event = cb.mock.calls[0][0];
		expect(event.changedFolderIds).toContain(DOCUMENTS_ID);
		expect(event.changedFolderIds).toContain(DESKTOP_ID);
	});

	it('global watcher fires on trash', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.createTextFile(DOCUMENTS_ID, 'test.txt', 'hello');
		if (!result.ok) throw new Error('setup failed');

		const cb = vi.fn();
		fs.watch(cb);
		cb.mockClear();

		await fs.trash(result.value.id);

		expect(cb).toHaveBeenCalledOnce();
		const event = cb.mock.calls[0][0];
		expect(event.changedFolderIds).toContain(TRASH_ID);
	});

	it('global watcher fires on emptyTrash', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.createTextFile(DOCUMENTS_ID, 'test.txt', 'hello');
		if (!result.ok) throw new Error('setup failed');
		await fs.trash(result.value.id);

		const cb = vi.fn();
		fs.watch(cb);
		cb.mockClear();

		await fs.emptyTrash();

		expect(cb).toHaveBeenCalledOnce();
		expect(cb.mock.calls[0][0].operation).toBe('empty_trash');
	});

	it('unsubscribe stops notifications', async () => {
		const fs = TerminalFS.createCleanDisk();
		const cb = vi.fn();
		const unsub = fs.watch(cb);

		unsub();
		await fs.createFolder(DOCUMENTS_ID, 'Test');

		expect(cb).not.toHaveBeenCalled();
	});

	it('destroy clears all watchers', async () => {
		const fs = TerminalFS.createCleanDisk();
		const cb = vi.fn();
		fs.watch(cb);

		fs.destroy();
		await fs.createFolder(DOCUMENTS_ID, 'Test');

		expect(cb).not.toHaveBeenCalled();
	});
});
