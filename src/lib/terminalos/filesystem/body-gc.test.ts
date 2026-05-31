import { describe, it, expect } from 'vitest';
import { TerminalFS, DOCUMENTS_ID, RECORDINGS_ID } from './terminal-fs';
import { InMemoryBodyStore } from './storage/storage-types';
import type { BodyId, FsFile } from './types';

function blobBodyId(file: FsFile): BodyId {
	if (file.bodyRef?.kind !== 'indexeddb-blob') {
		throw new Error(`Expected "${file.name}" to be blob-backed`);
	}
	return file.bodyRef.bodyId;
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

describe('blob body garbage collection', () => {
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
