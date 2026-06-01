import { describe, it, expect } from 'vitest';
import { TerminalFS, APPDATA_ID, DESKTOP_ID, DOCUMENTS_ID, RECORDINGS_ID } from './terminal-fs';
import { InMemoryBodyStore, InMemoryManifestStore } from './storage/storage-types';
import type { FsAlias, FsFile, FsNode, FsResult, NodeId, TerminalVolume } from './types';

class FailingManifestStore extends InMemoryManifestStore {
	failSaves = false;

	async save(volume: TerminalVolume, nodes: FsNode[]): Promise<FsResult<void>> {
		if (this.failSaves) {
			return {
				ok: false,
				error: { code: 'quota_exceeded', message: 'Manifest save failed' }
			};
		}
		return super.save(volume, nodes);
	}
}

function bytes(text: string): ArrayBuffer {
	return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

function expectPersistenceFailure(result: FsResult<unknown>): void {
	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.error.code).toBe('quota_exceeded');
	}
}

function nodesById(nodes: Iterable<FsNode>): Map<NodeId, FsNode> {
	return new Map(Array.from(nodes, (node) => [node.id, node]));
}

async function expectInMemoryMatchesManifest(
	fs: TerminalFS,
	manifest: InMemoryManifestStore
): Promise<void> {
	const loaded = await manifest.load();
	expect(loaded).not.toBeNull();
	if (!loaded) return;

	expect(fs.getVolume()).toEqual(loaded.volume);
	expect(nodesById(fs.getAllNodes().values())).toEqual(nodesById(loaded.nodes));
}

async function getCreatedFile(result: Promise<FsResult<FsFile>>): Promise<FsFile> {
	const created = await result;
	expect(created.ok).toBe(true);
	if (!created.ok) throw new Error(created.error.message);
	return created.value;
}

async function getCreatedAlias(result: Promise<FsResult<FsAlias>>): Promise<FsAlias> {
	const created = await result;
	expect(created.ok).toBe(true);
	if (!created.ok) throw new Error(created.error.message);
	return created.value;
}

type AtomicityScenario = {
	name: string;
	prepare: (fs: TerminalFS) => Promise<() => Promise<FsResult<unknown>>>;
};

async function runFailedSaveScenario(scenario: AtomicityScenario): Promise<void> {
	const manifest = new FailingManifestStore();
	const bodies = new InMemoryBodyStore();
	const fs = await TerminalFS.open(manifest, bodies);
	const action = await scenario.prepare(fs);

	await expectInMemoryMatchesManifest(fs, manifest);

	manifest.failSaves = true;
	const result = await action();

	expectPersistenceFailure(result);
	await expectInMemoryMatchesManifest(fs, manifest);
}

const rollbackScenarios: AtomicityScenario[] = [
	{
		name: 'createFolder',
		prepare: async (fs) => async () => fs.createFolder(DOCUMENTS_ID, 'Failed folder')
	},
	{
		name: 'getAppDataFolder',
		prepare: async (fs) => async () => fs.getAppDataFolder('chatrbot')
	},
	{
		name: 'createTextFile',
		prepare: async (fs) => async () => fs.createTextFile(DOCUMENTS_ID, 'Failed.txt', 'draft')
	},
	{
		name: 'createFile',
		prepare: async (fs) => async () =>
			fs.createFile(DOCUMENTS_ID, 'Failed.sticky', {
				appId: 'stickies',
				fileType: 'sticky',
				text: '{}'
			})
	},
	{
		name: 'createBlobFile',
		prepare: async (fs) => async () =>
			fs.createBlobFile(RECORDINGS_ID, 'Failed.webm', bytes('new'), {
				appId: 'recorder',
				fileType: 'recording'
			})
	},
	{
		name: 'replaceBlobFileBody',
		prepare: async (fs) => {
			const file = await getCreatedFile(
				fs.createBlobFile(RECORDINGS_ID, 'Replace.webm', bytes('old'), {
					appId: 'recorder',
					fileType: 'recording'
				})
			);
			return async () => fs.replaceBlobFileBody(file.id, bytes('new'));
		}
	},
	{
		name: 'writeText',
		prepare: async (fs) => {
			const file = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Draft.txt', 'v1'));
			return async () => fs.writeText(file.id, 'v2');
		}
	},
	{
		name: 'rename',
		prepare: async (fs) => {
			const file = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Before.txt', 'text'));
			return async () => fs.rename(file.id, 'After.txt');
		}
	},
	{
		name: 'move',
		prepare: async (fs) => {
			const file = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Move.txt', 'text'));
			return async () => fs.move(file.id, DESKTOP_ID);
		}
	},
	{
		name: 'duplicate',
		prepare: async (fs) => {
			const folder = await fs.createFolder(DOCUMENTS_ID, 'Copy source');
			expect(folder.ok).toBe(true);
			if (!folder.ok) throw new Error(folder.error.message);
			await getCreatedFile(fs.createTextFile(folder.value.id, 'child.txt', 'text'));
			return async () => fs.duplicate(folder.value.id);
		}
	},
	{
		name: 'trash',
		prepare: async (fs) => {
			const file = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Trash me.txt', 'text'));
			return async () => fs.trash(file.id);
		}
	},
	{
		name: 'emptyTrash',
		prepare: async (fs) => {
			const file = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Empty me.txt', 'text'));
			const trashed = await fs.trash(file.id);
			expect(trashed.ok).toBe(true);
			return async () => fs.emptyTrash();
		}
	},
	{
		name: 'createAlias',
		prepare: async (fs) => {
			const target = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Target.txt', 'text'));
			return async () => fs.createAlias(DESKTOP_ID, target.id, 'Target alias');
		}
	},
	{
		name: 'resolveAlias repair',
		prepare: async (fs) => {
			const firstTarget = await getCreatedFile(
				fs.createTextFile(DOCUMENTS_ID, 'Repair target.txt', 'old')
			);
			const alias = await getCreatedAlias(fs.createAlias(DESKTOP_ID, firstTarget.id));
			const deleted = await fs.deleteNode(firstTarget.id);
			expect(deleted.ok).toBe(true);
			await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Repair target.txt', 'new'));
			return async () => fs.resolveAlias(alias.id);
		}
	},
	{
		name: 'undoLast',
		prepare: async (fs) => {
			const file = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Undo move.txt', 'text'));
			const moved = await fs.move(file.id, DESKTOP_ID);
			expect(moved.ok).toBe(true);
			return async () => fs.undoLast();
		}
	},
	{
		name: 'installApp',
		prepare: async (fs) => async () => fs.installApp('tvguide')
	},
	{
		name: 'uninstallApp',
		prepare: async (fs) => {
			const installed = await fs.installApp('tvguide');
			expect(installed.ok).toBe(true);
			return async () => fs.uninstallApp('tvguide');
		}
	},
	{
		name: 'buyApp',
		prepare: async (fs) => async () => fs.buyApp('tvguide')
	},
	{
		name: 'returnApp',
		prepare: async (fs) => {
			const bought = await fs.buyApp('tvguide');
			expect(bought.ok).toBe(true);
			return async () => fs.returnApp('tvguide');
		}
	},
	{
		name: 'restoreBackup',
		prepare: async (fs) => {
			const source = TerminalFS.createCleanDisk();
			await getCreatedFile(source.createTextFile(DOCUMENTS_ID, 'Restored.txt', 'backup'));
			const backup = await source.exportBackup();
			expect(backup.ok).toBe(true);
			if (!backup.ok) throw new Error(backup.error.message);

			await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Keep.txt', 'current'));
			return async () => fs.restoreBackup(backup.value);
		}
	},
	{
		name: 'reinstallOS',
		prepare: async (fs) => {
			await getCreatedFile(
				fs.createTextFile(DOCUMENTS_ID, 'Keep after failed reinstall.txt', 'text')
			);
			const bought = await fs.buyApp('tvguide');
			expect(bought.ok).toBe(true);
			return async () => fs.reinstallOS();
		}
	},
	{
		name: 'deleteNode',
		prepare: async (fs) => {
			const folder = await fs.createFolder(DOCUMENTS_ID, 'Delete folder');
			expect(folder.ok).toBe(true);
			if (!folder.ok) throw new Error(folder.error.message);
			await getCreatedFile(fs.createTextFile(folder.value.id, 'child.txt', 'text'));
			return async () => fs.deleteNode(folder.value.id);
		}
	}
];

describe('TerminalFS command atomicity', () => {
	for (const scenario of rollbackScenarios) {
		it(`rolls back in-memory state when ${scenario.name} manifest persistence fails`, async () => {
			await runFailedSaveScenario(scenario);
		});
	}

	it('rolls back AppData container self-heal when manifest persistence fails', async () => {
		const manifest = new FailingManifestStore();
		await TerminalFS.open(manifest);
		const loaded = await manifest.load();
		expect(loaded).not.toBeNull();
		if (!loaded) return;

		await manifest.save(
			loaded.volume,
			loaded.nodes.filter((node) => node.id !== APPDATA_ID)
		);
		const oldDisk = await TerminalFS.open(manifest);
		expect(oldDisk.getAllNodes().has(APPDATA_ID)).toBe(false);

		manifest.failSaves = true;
		const result = await oldDisk.getAppDataFolder('chatrbot');

		expectPersistenceFailure(result);
		expect(oldDisk.getAllNodes().has(APPDATA_ID)).toBe(false);
		await expectInMemoryMatchesManifest(oldDisk, manifest);
	});

	it('preserves the previous undo record when a replacement undo command fails', async () => {
		const manifest = new FailingManifestStore();
		const fs = await TerminalFS.open(manifest);
		const target = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Rename target.txt', 'x'));
		const undoAnchor = await fs.createFolder(DOCUMENTS_ID, 'Undo anchor');
		expect(undoAnchor.ok).toBe(true);

		manifest.failSaves = true;
		const result = await fs.rename(target.id, 'Renamed.txt');

		expectPersistenceFailure(result);
		const undoLabel = await fs.getUndoLabel();
		expect(undoLabel.ok).toBe(true);
		if (undoLabel.ok) {
			expect(undoLabel.value).toBe('Create folder "Undo anchor"');
		}
	});

	it('preserves undo when a destructive clear-undo command fails', async () => {
		const manifest = new FailingManifestStore();
		const fs = await TerminalFS.open(manifest);
		const file = await getCreatedFile(fs.createTextFile(DOCUMENTS_ID, 'Undoable trash.txt', 'x'));
		const trashed = await fs.trash(file.id);
		expect(trashed.ok).toBe(true);

		manifest.failSaves = true;
		const result = await fs.emptyTrash();

		expectPersistenceFailure(result);
		const undoLabel = await fs.getUndoLabel();
		expect(undoLabel.ok).toBe(true);
		if (undoLabel.ok) {
			expect(undoLabel.value).toBe('Trash "Undoable trash.txt"');
		}
	});
});
