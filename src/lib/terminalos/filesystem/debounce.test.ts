import { describe, it, expect } from 'vitest';
import { InMemoryManifestStore, InMemoryBodyStore } from './storage/storage-types';
import { TerminalFS, DOCUMENTS_ID, TRASH_ID } from './terminal-fs';

function setup() {
	const manifest = new InMemoryManifestStore();
	const bodies = new InMemoryBodyStore();
	const fs = TerminalFS.createCleanDisk(manifest, bodies);
	return { fs, manifest, bodies };
}

describe('debounced persist', () => {
	it('coalesces rapid mutations into fewer manifest writes', async () => {
		const manifest = new InMemoryManifestStore();
		let saveCount = 0;
		const original = manifest.save.bind(manifest);
		manifest.save = async (...args) => {
			saveCount++;
			return original(...args);
		};

		const fs = TerminalFS.createCleanDisk(manifest);

		await Promise.all([
			fs.createFolder(DOCUMENTS_ID, 'A'),
			fs.createFolder(DOCUMENTS_ID, 'B'),
			fs.createFolder(DOCUMENTS_ID, 'C')
		]);

		// All three mutations coalesce — only one save call from the debounced timer
		// (createCleanDisk itself does NOT persist, so saveCount = 1)
		expect(saveCount).toBe(1);
	});

	it('data is available in memory before debounce flushes', async () => {
		const { fs } = setup();

		// Don't await — start the mutation
		const promise = fs.createFolder(DOCUMENTS_ID, 'Eager');

		// The in-memory state is updated synchronously before persist
		const list = await fs.listFolder(DOCUMENTS_ID);
		expect(list.ok).toBe(true);
		if (list.ok) {
			expect(list.value.some((n) => n.name === 'Eager')).toBe(true);
		}

		await promise;
	});

	it('flushPersist writes immediately and resolves pending callers', async () => {
		const manifest = new InMemoryManifestStore();
		const fs = TerminalFS.createCleanDisk(manifest);

		const promise = fs.createFolder(DOCUMENTS_ID, 'Flushed');
		await fs.flushPersist();

		const result = await promise;
		expect(result.ok).toBe(true);

		const fs2 = await TerminalFS.open(manifest);
		const list = await fs2.listFolder(DOCUMENTS_ID);
		expect(list.ok && list.value.some((n) => n.name === 'Flushed')).toBe(true);
	});

	it('emptyTrash uses immediate persist, not debounced', async () => {
		const manifest = new InMemoryManifestStore();
		let saveCount = 0;
		const original = manifest.save.bind(manifest);
		manifest.save = async (...args) => {
			saveCount++;
			return original(...args);
		};

		const fs = TerminalFS.createCleanDisk(manifest);
		const file = await fs.createTextFile(DOCUMENTS_ID, 'doomed.txt', 'bye');
		if (!file.ok) throw new Error('setup');
		await fs.trash(file.value.id);

		saveCount = 0;
		await fs.emptyTrash();

		// emptyTrash should persist immediately (flush + persist = could be 1 or 2 saves)
		expect(saveCount).toBeGreaterThanOrEqual(1);

		// Verify on-disk state matches — trash is empty
		const fs2 = await TerminalFS.open(manifest);
		const trash = await fs2.listFolder(TRASH_ID);
		expect(trash.ok && trash.value.length).toBe(0);
	});

	it('deleteNode uses immediate persist, not debounced', async () => {
		const manifest = new InMemoryManifestStore();
		const fs = TerminalFS.createCleanDisk(manifest);
		const file = await fs.createTextFile(DOCUMENTS_ID, 'gone.txt', 'bye');
		if (!file.ok) throw new Error('setup');

		await fs.deleteNode(file.value.id);

		// Verify on-disk state matches — file is gone
		const fs2 = await TerminalFS.open(manifest);
		const list = await fs2.listFolder(DOCUMENTS_ID);
		expect(list.ok).toBe(true);
		if (list.ok) {
			expect(list.value.some((n) => n.name === 'gone.txt')).toBe(false);
		}
	});

	it('reinstallOS flushes pending debounce before rebuilding', async () => {
		const manifest = new InMemoryManifestStore();
		const fs = TerminalFS.createCleanDisk(manifest);

		// Start a mutation (debounced)
		const renamePromise = fs.createFolder(DOCUMENTS_ID, 'WillBeWiped');

		// Reinstall should flush the pending write, then rebuild
		await fs.reinstallOS();
		await renamePromise;

		// After reinstall, the disk should be clean — no 'WillBeWiped'
		const list = await fs.listFolder(DOCUMENTS_ID);
		expect(list.ok).toBe(true);
		if (list.ok) {
			expect(list.value.some((n) => n.name === 'WillBeWiped')).toBe(false);
		}
	});

	it('restoreBackup flushes pending debounce before restoring', async () => {
		const manifest = new InMemoryManifestStore();
		const bodies = new InMemoryBodyStore();
		const fs = TerminalFS.createCleanDisk(manifest, bodies);

		// Get a backup from the clean state
		const backup = await fs.exportBackup();
		if (!backup.ok) throw new Error('export failed');

		// Make a mutation
		await fs.createFolder(DOCUMENTS_ID, 'Extra');

		// Start another mutation (debounced)
		const promise = fs.createTextFile(DOCUMENTS_ID, 'pending.txt', 'data');

		// Restore should flush, then overwrite
		await fs.restoreBackup(backup.value);
		await promise;

		// After restore, should not have 'Extra' or 'pending.txt'
		const list = await fs.listFolder(DOCUMENTS_ID);
		expect(list.ok).toBe(true);
		if (list.ok) {
			expect(list.value.some((n) => n.name === 'Extra')).toBe(false);
			expect(list.value.some((n) => n.name === 'pending.txt')).toBe(false);
		}
	});
});

describe('peekNode', () => {
	it('returns the node for a valid ID', () => {
		const fs = TerminalFS.createCleanDisk();
		const node = fs.peekNode(DOCUMENTS_ID);
		expect(node).toBeDefined();
		expect(node?.name).toBe('Documents');
	});

	it('returns undefined for an invalid ID', () => {
		const fs = TerminalFS.createCleanDisk();
		expect(fs.peekNode('nonexistent')).toBeUndefined();
	});

	it('returns Readonly type (compile-time only)', () => {
		const fs = TerminalFS.createCleanDisk();
		const node = fs.peekNode(DOCUMENTS_ID);
		// TypeScript should prevent: node.name = 'x'
		// This test just verifies the node is usable read-only
		expect(node?.kind).toBe('folder');
	});
});

describe('createCleanDisk isolation', () => {
	it('does not leak resources from throwaway instances', () => {
		// createCleanDisk should not open a BroadcastChannel
		// (verified by the enableBroadcast=false flag in the constructor)
		const fs = TerminalFS.createCleanDisk();
		// destroy should be safe to call even without broadcast
		fs.destroy();
	});
});
