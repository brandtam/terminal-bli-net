import { describe, it, expect } from 'vitest';
import { TerminalFS, DOCUMENTS_ID, RECORDINGS_ID } from './terminal-fs';
import { InMemoryBodyStore, InMemoryManifestStore } from './storage/storage-types';
import type { BodyId, FsFile } from './types';

function blobBodyId(file: FsFile): BodyId {
	if (file.bodyRef?.kind !== 'indexeddb-blob') {
		throw new Error(`Expected "${file.name}" to be blob-backed`);
	}
	return file.bodyRef.bodyId;
}

function bytes(text: string): ArrayBuffer {
	return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

async function expectBodyText(fs: TerminalFS, bodyId: BodyId, expected: string): Promise<void> {
	const read = await fs.readBody(bodyId);
	expect(read.ok).toBe(true);
	if (!read.ok) return;
	expect(new TextDecoder().decode(read.value)).toBe(expected);
}

async function createRecording(
	fs: TerminalFS,
	name: string,
	bytes = new Uint8Array([1, 2, 3]).buffer
): Promise<FsFile> {
	const result = await fs.createBlobFile(RECORDINGS_ID, name, bytes, {
		appId: 'recorder',
		opensWith: 'player',
		fileType: 'recording',
		contentType: 'video/webm'
	});
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

class FailingDeleteBodyStore extends InMemoryBodyStore {
	readonly failDeletesFor = new Set<BodyId>();

	async delete(bodyId: BodyId): Promise<void> {
		if (this.failDeletesFor.has(bodyId)) {
			throw new Error(`Refusing to delete ${bodyId}`);
		}
		await super.delete(bodyId);
	}
}

class FailingWriteBodyStore extends InMemoryBodyStore {
	failWrites = false;

	async write(bodyId: BodyId, data: ArrayBuffer) {
		if (this.failWrites) {
			return {
				ok: false as const,
				error: { code: 'quota_exceeded' as const, message: `No space for ${bodyId}` }
			};
		}
		return super.write(bodyId, data);
	}
}

class ObservableBodyStore extends InMemoryBodyStore {
	readonly deleteCalls: BodyId[] = [];

	async delete(bodyId: BodyId): Promise<void> {
		this.deleteCalls.push(bodyId);
		await super.delete(bodyId);
	}
}

class FailingManifestStore extends InMemoryManifestStore {
	failSaves = false;

	async save(...args: Parameters<InMemoryManifestStore['save']>) {
		if (this.failSaves) {
			return {
				ok: false as const,
				error: { code: 'quota_exceeded' as const, message: 'Manifest quota exceeded' }
			};
		}
		return super.save(...args);
	}
}

class OrderedBodyStore extends InMemoryBodyStore {
	constructor(private readonly events: string[]) {
		super();
	}

	async write(bodyId: BodyId, data: ArrayBuffer) {
		this.events.push(`write:${bodyId}`);
		return super.write(bodyId, data);
	}

	async listBodyIds() {
		this.events.push('listBodyIds');
		return super.listBodyIds();
	}

	async delete(bodyId: BodyId): Promise<void> {
		this.events.push(`delete:${bodyId}`);
		await super.delete(bodyId);
	}
}

class OrderedManifestStore extends InMemoryManifestStore {
	constructor(private readonly events: string[]) {
		super();
	}

	async save(...args: Parameters<InMemoryManifestStore['save']>) {
		this.events.push('saveManifest');
		return super.save(...args);
	}
}

describe('blob body garbage collection', () => {
	it('creates a blob-backed file by writing the body before committing the manifest', async () => {
		const events: string[] = [];
		const manifest = new OrderedManifestStore(events);
		const bodies = new OrderedBodyStore(events);
		const fs = TerminalFS.createCleanDisk(manifest, bodies);

		const result = await fs.createBlobFile(RECORDINGS_ID, 'Create-order.webm', bytes('new'), {
			appId: 'recorder',
			opensWith: 'player',
			fileType: 'recording',
			contentType: 'video/webm'
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const bodyId = blobBodyId(result.value);
		const writeIndex = events.indexOf(`write:${bodyId}`);
		const saveIndex = events.indexOf('saveManifest');
		expect(writeIndex).toBeGreaterThanOrEqual(0);
		expect(saveIndex).toBeGreaterThan(writeIndex);
		expect(events).not.toContain('listBodyIds');
		await expectBodyText(fs, bodyId, 'new');
	});

	it('leaves no node and no manifest change when createBlobFile body writing fails', async () => {
		const events: string[] = [];
		const manifest = new OrderedManifestStore(events);
		const bodies = new FailingWriteBodyStore();
		const fs = await TerminalFS.open(manifest, bodies);
		events.length = 0;

		bodies.failWrites = true;
		const result = await fs.createBlobFile(RECORDINGS_ID, 'No-body.webm', bytes('new'), {
			appId: 'recorder',
			fileType: 'recording'
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('quota_exceeded');
		}
		expect(events).toEqual([]);
		expect(await bodies.listBodyIds()).toEqual([]);

		const listing = await fs.listFolder(RECORDINGS_ID);
		expect(listing.ok).toBe(true);
		if (listing.ok) {
			expect(listing.value.some((node) => node.name === 'No-body.webm')).toBe(false);
		}

		const reopened = await TerminalFS.open(manifest, bodies);
		const persistedListing = await reopened.listFolder(RECORDINGS_ID);
		expect(persistedListing.ok).toBe(true);
		if (persistedListing.ok) {
			expect(persistedListing.value.some((node) => node.name === 'No-body.webm')).toBe(false);
		}
	});

	it('rolls back createBlobFile memory and leaves an uncommitted body collectable when manifest commit fails', async () => {
		const manifest = new FailingManifestStore();
		const bodies = new ObservableBodyStore();
		const fs = await TerminalFS.open(manifest, bodies);
		const existing = await createRecording(fs, 'Existing.webm', bytes('old'));
		const existingBodyId = blobBodyId(existing);

		manifest.failSaves = true;
		const result = await fs.createBlobFile(
			RECORDINGS_ID,
			'Manifest-fails-create.webm',
			bytes('new'),
			{
				appId: 'recorder',
				fileType: 'recording'
			}
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('quota_exceeded');
		}
		expect(bodies.deleteCalls).toEqual([]);

		const listing = await fs.listFolder(RECORDINGS_ID);
		expect(listing.ok).toBe(true);
		if (listing.ok) {
			expect(listing.value.some((node) => node.name === 'Manifest-fails-create.webm')).toBe(false);
		}
		await expectBodyText(fs, existingBodyId, 'old');

		const storedBeforeGc = await bodies.listBodyIds();
		expect(storedBeforeGc).toHaveLength(2);
		expect(storedBeforeGc).toContain(existingBodyId);

		manifest.failSaves = false;
		const collected = await fs.collectGarbage();
		expect(collected.ok).toBe(true);
		if (!collected.ok) return;
		expect(collected.value.deleted).toBe(1);
		await expectBodyText(fs, existingBodyId, 'old');
		expect(await bodies.listBodyIds()).toEqual([existingBodyId]);
	});

	it('preserves blob-retaining undo state when a createBlobFile manifest commit fails', async () => {
		const manifest = new FailingManifestStore();
		const bodies = new ObservableBodyStore();
		const fs = await TerminalFS.open(manifest, bodies);
		const deletedFile = await createRecording(fs, 'Undo-source.webm', bytes('undo body'));
		const retainedBodyId = blobBodyId(deletedFile);

		const deleted = await fs.deleteNode(deletedFile.id);
		expect(deleted.ok).toBe(true);

		manifest.failSaves = true;
		const failedCreate = await fs.createBlobFile(
			RECORDINGS_ID,
			'Failed-undo-replacement.webm',
			bytes('orphan'),
			{
				appId: 'recorder',
				fileType: 'recording'
			}
		);

		expect(failedCreate.ok).toBe(false);

		const undoLabel = await fs.getUndoLabel();
		expect(undoLabel.ok).toBe(true);
		if (undoLabel.ok) {
			expect(undoLabel.value).toBe('Delete "Undo-source.webm"');
		}

		const collected = await fs.collectGarbage();
		expect(collected.ok).toBe(true);
		if (!collected.ok) return;
		expect(collected.value.deleted).toBe(1);
		await expectBodyText(fs, retainedBodyId, 'undo body');

		manifest.failSaves = false;
		const undone = await fs.undoLast();
		expect(undone.ok).toBe(true);
		const restored = await fs.getNode(deletedFile.id);
		expect(restored.ok).toBe(true);
		await expectBodyText(fs, retainedBodyId, 'undo body');
	});

	it('replaces a blob-backed file by writing a new body before committing the manifest', async () => {
		const events: string[] = [];
		const manifest = new OrderedManifestStore(events);
		const bodies = new OrderedBodyStore(events);
		const fs = TerminalFS.createCleanDisk(manifest, bodies);
		const file = await createRecording(fs, 'Replace.webm', bytes('old'));
		const oldBodyId = blobBodyId(file);
		events.length = 0;

		const result = await fs.replaceBlobFileBody(file.id, bytes('new'), {
			contentType: 'video/mp4'
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const newBodyId = blobBodyId(result.value);
		expect(newBodyId).not.toBe(oldBodyId);
		expect(result.value.bodyRef).toMatchObject({
			kind: 'indexeddb-blob',
			bodyId: newBodyId,
			size: 3,
			contentType: 'video/mp4'
		});
		await expectBodyText(fs, newBodyId, 'new');

		const writeIndex = events.findIndex((event) => event.startsWith(`write:${newBodyId}`));
		const saveIndex = events.indexOf('saveManifest');
		const scanIndex = events.indexOf('listBodyIds');
		const deleteIndex = events.indexOf(`delete:${oldBodyId}`);
		expect(writeIndex).toBeGreaterThanOrEqual(0);
		expect(saveIndex).toBeGreaterThan(writeIndex);
		expect(scanIndex).toBeGreaterThan(saveIndex);
		expect(deleteIndex).toBeGreaterThan(scanIndex);

		const oldBody = await fs.readBody(oldBodyId);
		expect(oldBody.ok).toBe(false);
	});

	it('leaves the manifest unchanged when replacement body writing fails', async () => {
		const bodies = new FailingWriteBodyStore();
		const fs = TerminalFS.createCleanDisk(undefined, bodies);
		const file = await createRecording(fs, 'Body-write-fails.webm', bytes('old'));
		const oldBodyId = blobBodyId(file);

		bodies.failWrites = true;
		const result = await fs.replaceBlobFileBody(file.id, bytes('new'));

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('quota_exceeded');
		}

		const current = await fs.getNode(file.id);
		expect(current.ok).toBe(true);
		if (!current.ok || current.value.kind !== 'file') return;
		expect(blobBodyId(current.value)).toBe(oldBodyId);
		await expectBodyText(fs, oldBodyId, 'old');
		expect(await bodies.listBodyIds()).toEqual([oldBodyId]);
	});

	it('rolls the in-memory file back and skips GC when replacement manifest commit fails', async () => {
		const manifest = new FailingManifestStore();
		const bodies = new ObservableBodyStore();
		const fs = TerminalFS.createCleanDisk(manifest, bodies);
		const file = await createRecording(fs, 'Manifest-fails.webm', bytes('old'));
		const oldBodyId = blobBodyId(file);

		manifest.failSaves = true;
		const result = await fs.replaceBlobFileBody(file.id, bytes('new'));

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('quota_exceeded');
		}

		const current = await fs.getNode(file.id);
		expect(current.ok).toBe(true);
		if (!current.ok || current.value.kind !== 'file') return;
		expect(blobBodyId(current.value)).toBe(oldBodyId);
		await expectBodyText(fs, oldBodyId, 'old');
		expect(bodies.deleteCalls).toEqual([]);
		expect((await bodies.listBodyIds()).length).toBe(2);

		manifest.failSaves = false;
		const reopened = await TerminalFS.open(manifest, bodies);
		const persisted = await reopened.getNode(file.id);
		expect(persisted.ok).toBe(true);
		if (persisted.ok && persisted.value.kind === 'file') {
			expect(blobBodyId(persisted.value)).toBe(oldBodyId);
		}
	});

	it('rolls back blob-to-inline writes and skips unsafe GC when the manifest commit fails', async () => {
		const manifest = new FailingManifestStore();
		const bodies = new ObservableBodyStore();
		const fs = await TerminalFS.open(manifest, bodies);
		const file = await createRecording(fs, 'Inline-fails.webm', bytes('old'));
		const oldBodyId = blobBodyId(file);

		manifest.failSaves = true;
		const result = await fs.writeText(file.id, 'inline replacement');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('quota_exceeded');
		}

		const current = await fs.getNode(file.id);
		expect(current.ok).toBe(true);
		if (!current.ok || current.value.kind !== 'file') return;
		expect(blobBodyId(current.value)).toBe(oldBodyId);
		expect(bodies.deleteCalls).toEqual([]);

		const collected = await fs.collectGarbage();
		expect(collected.ok).toBe(true);
		if (!collected.ok) return;
		expect(collected.value.deleted).toBe(0);
		await expectBodyText(fs, oldBodyId, 'old');
	});

	it('uses copy-on-write when replacing one file that shares a body with a duplicate', async () => {
		const fs = TerminalFS.createCleanDisk();
		const original = await createRecording(fs, 'Shared-replace.webm', bytes('old'));
		const oldBodyId = blobBodyId(original);
		const duplicate = await fs.duplicate(original.id);
		expect(duplicate.ok).toBe(true);
		if (!duplicate.ok || duplicate.value.kind !== 'file') return;
		expect(blobBodyId(duplicate.value)).toBe(oldBodyId);

		const replaced = await fs.replaceBlobFileBody(original.id, bytes('new'));
		expect(replaced.ok).toBe(true);
		if (!replaced.ok) return;

		const newBodyId = blobBodyId(replaced.value);
		expect(newBodyId).not.toBe(oldBodyId);
		await expectBodyText(fs, newBodyId, 'new');
		await expectBodyText(fs, oldBodyId, 'old');

		const duplicateAfterReplace = await fs.getNode(duplicate.value.id);
		expect(duplicateAfterReplace.ok).toBe(true);
		if (duplicateAfterReplace.ok && duplicateAfterReplace.value.kind === 'file') {
			expect(blobBodyId(duplicateAfterReplace.value)).toBe(oldBodyId);
		}
	});

	it('retains an old replaced body while pending undo can restore it', async () => {
		const fs = TerminalFS.createCleanDisk();
		const original = await createRecording(fs, 'Undo-retained-replace.webm', bytes('old'));
		const oldBodyId = blobBodyId(original);
		const duplicate = await fs.duplicate(original.id);
		expect(duplicate.ok).toBe(true);
		if (!duplicate.ok || duplicate.value.kind !== 'file') return;

		const deleted = await fs.deleteNode(duplicate.value.id);
		expect(deleted.ok).toBe(true);

		const replaced = await fs.replaceBlobFileBody(original.id, bytes('new'));
		expect(replaced.ok).toBe(true);
		if (!replaced.ok) return;
		await expectBodyText(fs, blobBodyId(replaced.value), 'new');

		await expectBodyText(fs, oldBodyId, 'old');

		const replacementUndo = await fs.createFolder(DOCUMENTS_ID, 'Clear replacement undo');
		expect(replacementUndo.ok).toBe(true);

		const collected = await fs.readBody(oldBodyId);
		expect(collected.ok).toBe(false);
		if (!collected.ok) {
			expect(collected.error.code).toBe('not_found');
		}
	});

	it('duplicates blob-backed files by sharing the same body id', async () => {
		const fs = TerminalFS.createCleanDisk();
		const original = await createRecording(fs, 'Shared.webm');
		const bodyId = blobBodyId(original);

		const duplicate = await fs.duplicate(original.id);
		expect(duplicate.ok).toBe(true);
		if (!duplicate.ok || duplicate.value.kind !== 'file') return;

		expect(blobBodyId(duplicate.value)).toBe(bodyId);

		const deleted = await fs.deleteNode(duplicate.value.id);
		expect(deleted.ok).toBe(true);

		const stillReachable = await fs.readBody(bodyId);
		expect(stillReachable.ok).toBe(true);

		await fs.createFolder(DOCUMENTS_ID, 'Replace duplicate undo');
		const stillShared = await fs.readBody(bodyId);
		expect(stillShared.ok).toBe(true);
	});

	it('keeps deleteNode bodies readable while the delete is undoable', async () => {
		const fs = TerminalFS.createCleanDisk();
		const file = await createRecording(fs, 'Undoable.webm');
		const bodyId = blobBodyId(file);

		const deleted = await fs.deleteNode(file.id);
		expect(deleted.ok).toBe(true);

		const retained = await fs.readBody(bodyId);
		expect(retained.ok).toBe(true);

		const undo = await fs.undoLast();
		expect(undo.ok).toBe(true);

		const restored = await fs.getNode(file.id);
		expect(restored.ok).toBe(true);
		const restoredBody = await fs.readBody(bodyId);
		expect(restoredBody.ok).toBe(true);
	});

	it('collects bodies retained only by a replaced undo record', async () => {
		const fs = TerminalFS.createCleanDisk();
		const file = await createRecording(fs, 'Undo-retained.webm');
		const bodyId = blobBodyId(file);

		const deleted = await fs.deleteNode(file.id);
		expect(deleted.ok).toBe(true);
		expect((await fs.readBody(bodyId)).ok).toBe(true);

		const replacement = await fs.createFolder(DOCUMENTS_ID, 'Clear blob undo');
		expect(replacement.ok).toBe(true);

		const collected = await fs.readBody(bodyId);
		expect(collected.ok).toBe(false);
		if (!collected.ok) {
			expect(collected.error.code).toBe('not_found');
		}
	});

	it('collects blob bodies after emptyTrash makes trashed files unreachable', async () => {
		const fs = TerminalFS.createCleanDisk();
		const file = await createRecording(fs, 'Trash-me.webm');
		const bodyId = blobBodyId(file);

		const trashed = await fs.trash(file.id);
		expect(trashed.ok).toBe(true);
		expect((await fs.readBody(bodyId)).ok).toBe(true);

		const emptied = await fs.emptyTrash();
		expect(emptied.ok).toBe(true);

		const collected = await fs.readBody(bodyId);
		expect(collected.ok).toBe(false);
		if (!collected.ok) {
			expect(collected.error.code).toBe('not_found');
		}
	});

	it('full-scan collectGarbage removes historical orphan bodies', async () => {
		const bodies = new InMemoryBodyStore();
		const fs = TerminalFS.createCleanDisk(undefined, bodies);
		const live = await createRecording(fs, 'Live.webm');
		const liveBodyId = blobBodyId(live);
		const orphanBodyId = 'body_historical_orphan';
		await bodies.write(orphanBodyId, new Uint8Array([9, 9, 9]).buffer);

		const result = await fs.collectGarbage();
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value).toEqual({
			stored: 2,
			reachable: 1,
			unreachable: 1,
			deleted: 1,
			failed: 0,
			failedBodyIds: []
		});
		expect((await fs.readBody(liveBodyId)).ok).toBe(true);
		expect((await fs.readBody(orphanBodyId)).ok).toBe(false);
	});

	it('does not fail manifest commands when automatic GC cannot delete a body', async () => {
		const bodies = new FailingDeleteBodyStore();
		const fs = TerminalFS.createCleanDisk(undefined, bodies);
		const file = await createRecording(fs, 'Delete-fails.webm');
		const bodyId = blobBodyId(file);
		bodies.failDeletesFor.add(bodyId);

		const undo = await fs.undoLast();
		expect(undo.ok).toBe(true);
		expect((await fs.readBody(bodyId)).ok).toBe(true);

		const report = await fs.collectGarbage();
		expect(report.ok).toBe(true);
		if (!report.ok) return;
		expect(report.value.deleted).toBe(0);
		expect(report.value.failed).toBe(1);
		expect(report.value.failedBodyIds).toEqual([bodyId]);
	});
});
