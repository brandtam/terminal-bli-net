import type {
	NodeId,
	BodyId,
	BodyGcReport,
	BodyRef,
	AppId,
	PersistedAppId,
	FileType,
	FsNode,
	FsFolder,
	FsFile,
	FsAlias,
	FsResult,
	InstalledApp,
	TerminalVolume
} from './types';
import { ok, fail } from './errors';
import { generateUniqueId, hasSiblingConflict } from './names';
import { derivePath } from './paths';
import { resolveAlias as resolveAliasTarget, buildFingerprint } from './aliases';
import { getSystemApps, getDesktopAliasApps, getAppDef } from '../apps/app-library';
import { getAppWindowId } from '../apps/app-install';
import { findAppFile, isOwned as checkOwned, deriveOwnedApps } from '../apps/software-shop';
import type { UndoRecord } from './operations';
import { buildBackup, validateBackup, previewBackup, validateDiskForExport } from './backup';
import type { BackupFile, BackupFileV3, BackupPreferences, BackupRestoreResult } from './backup';
import { arrayBufferToBase64, base64ToArrayBuffer } from './storage/base64';
import type { ManifestStore, BodyStore, BodyEntry } from './storage/storage-types';
import { InMemoryManifestStore, InMemoryBodyStore } from './storage/storage-types';
import { computeDiskUsage } from './usage';
import type { DiskUsage } from './usage';
import { WatcherRegistry } from './watchers';
import type { FsChangeEvent, FsWatchCallback } from './watchers';

// Well-known IDs live in a leaf module (well-known-ids) so early-loaded code like
// apps/manifests.ts can import them without a load-order cycle back through here.
// Re-exported unchanged so every existing `$lib/terminalos` import site is intact.
export {
	ROOT_ID,
	APPLICATIONS_ID,
	DOCUMENTS_ID,
	DESKTOP_ID,
	SYSTEM_ID,
	RECORDINGS_ID,
	TRASH_ID,
	APPDATA_ID
} from './well-known-ids';
import {
	ROOT_ID,
	APPLICATIONS_ID,
	DOCUMENTS_ID,
	DESKTOP_ID,
	SYSTEM_ID,
	RECORDINGS_ID,
	TRASH_ID,
	APPDATA_ID
} from './well-known-ids';

const VOLUME_ID = 'volume_terminal_hd';

type TerminalFsSnapshot = {
	volume: TerminalVolume;
	nodes: Map<NodeId, FsNode>;
	lastUndo: UndoRecord | null;
};

class InvalidBackupBodyError extends Error {
	constructor(
		readonly bodyId: BodyId,
		readonly cause: unknown
	) {
		super(`Backup body "${bodyId}" is not valid base64`);
	}
}

async function* backupBodyEntries(backup: BackupFile): AsyncIterable<BodyEntry> {
	if (backup.version !== 3) return;

	for (const [bodyId, b64] of Object.entries(backup.bodies)) {
		try {
			yield { bodyId, data: base64ToArrayBuffer(b64) };
		} catch (e) {
			throw new InvalidBackupBodyError(bodyId, e);
		}
	}
}

const README_CONTENT = `README.TXT — Terminal v1.0

Terminal is a desktop OS that lives in a browser tab. Apps run inside it.
You drag windows. You open the menu bar. You change the timezone by clicking the clock.
The whole thing is meant to feel like a computer from 1995 that someone restored for you.

GETTING STARTED
Open the Computer Store to browse software. Pick up boxes, read the back,
and bring them to the counter. Purchased apps go to My Shelf, where you
install and uninstall them. Installed apps appear on your desktop.

NAVIGATION
- Double-click a desktop icon to open it
- Drag the title bar to move a window
- Drag the grow box (bottom-right or top-right) to resize
- Click a window to bring it forward
- x in the top-left closes it

KEYBOARD SHORTCUTS
- Cmd+N open the default app for whatever's focused
- Cmd+W close the front window
- Cmd+, open Tweaks (preferences)

THE CLOCK
Top-right of the menu bar. Click it to change timezone. Every time-aware
app reads from this clock, so changing it changes everything.

APPS
Each app on this desktop is its own thing. Click on an app's window, look at the menu bar.
The menus change to match. Open the app's Help menu to find its preferences and
its "About" page. That's where the app-specific manual lives — not here.

FAQ
What's the deal with the airing rule? Open chatrbot's Help menu.
Where's my data? localStorage. There is no server. Closing the tab loses nothing; clearing site data loses everything.
Why does it look like this? Because we like it.`;

const PRICING_CONTENT = `Pricing.txt

BASIC — $0
- 20 messages / day
- Sitcoms only (Seinfeld, Office, Friends)
- Solo characters
- Watermark on shareable transcripts

PRO — $5/mo
- Unlimited messages
- Full roster (incl. Succession, prestige drama, anti-heroes)
- Group chats — up to 4 characters at once
- Custom scene prompts ("you're stuck in an elevator")
- Export to .txt with a CRT scanline filter

SHOWRUNNER — $29/mo
- Everything in Pro
- Upload your own bible (PDF / fan wiki) → make your own cast
- API access · 100k tokens/day
- Priority during Emmy season

Cancel any time. Pricing in fake dollars. Real dollars also fine.`;

/**
 * Apps that exist as concepts (shell, folder, OS chrome, onboarding) but not as
 * installable file nodes. `system` is the chrome-dialog owner (About / System
 * Preferences) — it is isSystem like the others but must never get a "Terminal"
 * icon in /Applications, so it is excluded from seeding here just like finder.
 */
const NON_FILE_APPS = new Set(['finder', 'trash', 'system', 'welcome']);

/**
 * Generate a copy name: "Foo" -> "Foo copy", "Foo copy 2", etc.
 * Avoids case-insensitive conflicts with existing siblings.
 */
function generateCopyName(baseName: string, siblings: { name: string }[]): string {
	const copyName = `${baseName} copy`;
	if (!hasSiblingConflict(copyName, siblings)) return copyName;
	let i = 2;
	while (hasSiblingConflict(`${baseName} copy ${i}`, siblings)) i++;
	return `${baseName} copy ${i}`;
}

/**
 * Deep-duplicate a node and all its descendants, assigning new IDs.
 * Returns an array of all newly created nodes.
 */
function deepDuplicate(
	nodeId: NodeId,
	newParentId: NodeId,
	nodes: Map<NodeId, FsNode>,
	volumeId: string,
	now: number
): FsNode[] {
	const source = nodes.get(nodeId);
	if (!source) return [];

	const newId = generateUniqueId();
	const created: FsNode[] = [];

	if (source.kind === 'folder') {
		const clone: FsFolder = {
			...source,
			id: newId,
			parentId: newParentId,
			createdAt: now,
			updatedAt: now
		};
		created.push(clone);

		// Recursively clone children
		for (const n of nodes.values()) {
			if (n.parentId === nodeId) {
				created.push(...deepDuplicate(n.id, newId, nodes, volumeId, now));
			}
		}
	} else if (source.kind === 'file') {
		const clone: FsFile = {
			...source,
			id: newId,
			parentId: newParentId,
			createdAt: now,
			updatedAt: now
		};
		created.push(clone);
	} else {
		// alias
		const clone: FsAlias = {
			...source,
			id: newId,
			parentId: newParentId,
			createdAt: now,
			updatedAt: now
		};
		created.push(clone);
	}

	return created;
}

export class TerminalFS {
	private volume: TerminalVolume;
	private nodes: Map<NodeId, FsNode>;
	private lastUndo: UndoRecord | null = null;
	private manifest: ManifestStore;
	private bodies: BodyStore;
	private watcherRegistry = new WatcherRegistry();
	private broadcastChannel: BroadcastChannel | null = null;
	private persistTimer: ReturnType<typeof setTimeout> | null = null;
	private persistResolvers: Array<{
		resolve: (v: FsResult<void>) => void;
	}> = [];

	private constructor(
		volume: TerminalVolume,
		nodes: Map<NodeId, FsNode>,
		manifest: ManifestStore,
		bodies: BodyStore,
		enableBroadcast = true
	) {
		this.volume = volume;
		this.nodes = nodes;
		this.manifest = manifest;
		this.bodies = bodies;

		if (enableBroadcast && typeof BroadcastChannel !== 'undefined') {
			this.broadcastChannel = new BroadcastChannel('terminalos-fs');
			this.broadcastChannel.onmessage = (e: MessageEvent) => {
				const event = e.data as FsChangeEvent;
				if (event && event.operation) {
					this.reloadFromManifest().then(() => {
						this.watcherRegistry.notify({ ...event, remote: true });
					});
				}
			};
		}
	}

	private async persist(): Promise<FsResult<void>> {
		const nodes = Array.from(this.nodes.values());
		return this.manifest.save(this.volume, nodes);
	}

	private cloneVolume(volume: TerminalVolume): TerminalVolume {
		if (volume.ownedApps === undefined) return { ...volume };
		return { ...volume, ownedApps: [...volume.ownedApps] };
	}

	private snapshotState(): TerminalFsSnapshot {
		return {
			volume: this.cloneVolume(this.volume),
			nodes: new Map(this.nodes),
			lastUndo: this.lastUndo
		};
	}

	private restoreState(snapshot: TerminalFsSnapshot): void {
		this.volume = this.cloneVolume(snapshot.volume);
		this.nodes = new Map(snapshot.nodes);
		this.lastUndo = snapshot.lastUndo;
	}

	private setLastUndo(record: UndoRecord): boolean {
		const shouldCollectGarbage = this.undoRecordRetainsBlobBodies(this.lastUndo);
		this.lastUndo = record;
		return shouldCollectGarbage;
	}

	private clearLastUndo(): boolean {
		const shouldCollectGarbage = this.undoRecordRetainsBlobBodies(this.lastUndo);
		this.lastUndo = null;
		return shouldCollectGarbage;
	}

	private nodeReferencesBlobBody(node: FsNode): boolean {
		return node.kind === 'file' && node.bodyRef?.kind === 'indexeddb-blob';
	}

	private undoRecordRetainsBlobBodies(undo: UndoRecord | null): boolean {
		if (!undo) return false;

		switch (undo.undoData.type) {
			case 'restore_nodes':
				return undo.undoData.nodes.some((node) => this.nodeReferencesBlobBody(node));
			case 'delete_node':
			case 'delete_nodes':
			case 'move_back':
			case 'rename_back':
				return false;
		}
	}

	private addReachableBodyIds(nodes: Iterable<FsNode>, reachable: Set<BodyId>): void {
		for (const node of nodes) {
			if (node.kind !== 'file' || node.bodyRef?.kind !== 'indexeddb-blob') continue;
			reachable.add(node.bodyRef.bodyId);
		}
	}

	private reachableBodyIds(): Set<BodyId> {
		const reachable = new Set<BodyId>();
		this.addReachableBodyIds(this.nodes.values(), reachable);

		const undo = this.lastUndo;
		if (undo?.undoData.type === 'restore_nodes') {
			this.addReachableBodyIds(undo.undoData.nodes, reachable);
		}

		return reachable;
	}

	private async reachableBodyIdsForGarbageCollection(): Promise<Set<BodyId>> {
		const reachable = this.reachableBodyIds();
		const loaded = await this.manifest.load();
		if (loaded) {
			this.addReachableBodyIds(loaded.nodes, reachable);
		}
		return reachable;
	}

	private async collectGarbageAfterCommit(shouldCollectGarbage: boolean): Promise<void> {
		if (!shouldCollectGarbage) return;
		try {
			await this.collectGarbage();
		} catch {
			// Automatic cleanup is retryable maintenance; the committed manifest
			// remains the source of truth for the next full GC scan.
		}
	}

	private debouncedPersist(): Promise<FsResult<void>> {
		return new Promise((resolve) => {
			this.persistResolvers.push({ resolve });
			if (this.persistTimer) clearTimeout(this.persistTimer);
			this.persistTimer = setTimeout(() => {
				this.persistTimer = null;
				const resolvers = this.persistResolvers.splice(0);
				this.persist()
					.then((result) => {
						for (const r of resolvers) r.resolve(result);
					})
					.catch(() => {
						const err = fail<void>('corrupt_disk', 'Persist failed unexpectedly');
						for (const r of resolvers) r.resolve(err);
					});
			}, 250);
		});
	}

	async flushPersist(): Promise<void> {
		if (this.persistTimer) {
			clearTimeout(this.persistTimer);
			this.persistTimer = null;
			const resolvers = this.persistResolvers.splice(0);
			const result = await this.persist();
			for (const r of resolvers) r.resolve(result);
		}
	}

	private async reloadFromManifest(): Promise<void> {
		await this.flushPersist();
		const loaded = await this.manifest.load();
		if (loaded) {
			this.nodes.clear();
			for (const node of loaded.nodes) {
				this.nodes.set(node.id, node);
			}
		}
	}

	private notifyChange(
		changedNodeIds: NodeId[],
		changedFolderIds: NodeId[],
		operation: string
	): void {
		const event: FsChangeEvent = {
			changedNodeIds,
			changedFolderIds,
			operation,
			remote: false
		};
		this.watcherRegistry.notify(event);

		try {
			this.broadcastChannel?.postMessage(event);
		} catch {
			// Channel may be closed
		}
	}

	static async open(manifest?: ManifestStore, bodies?: BodyStore): Promise<TerminalFS> {
		const manifestStore = manifest ?? new InMemoryManifestStore();
		const bodyStore = bodies ?? new InMemoryBodyStore();

		const loaded = await manifestStore.load();
		if (loaded) {
			const nodes = new Map<NodeId, FsNode>();
			for (const node of loaded.nodes) {
				nodes.set(node.id, node);
			}

			// Migration: derive ownedApps from installed apps if missing
			if (loaded.volume.ownedApps === undefined) {
				loaded.volume.ownedApps = deriveOwnedApps(nodes);
			}

			return new TerminalFS(loaded.volume, nodes, manifestStore, bodyStore);
		}

		// No existing disk — create a clean one
		const fs = TerminalFS.createCleanDisk(manifestStore, bodyStore);
		await fs.persist();
		return fs;
	}

	static createCleanDisk(manifest?: ManifestStore, bodies?: BodyStore): TerminalFS {
		const manifestStore = manifest ?? new InMemoryManifestStore();
		const bodyStore = bodies ?? new InMemoryBodyStore();
		const now = Date.now();
		const nodes = new Map<NodeId, FsNode>();

		// 1. Volume — store apps must be bought; a clean disk owns none.
		const preOwnedStoreApps: AppId[] = [];
		const volume: TerminalVolume = {
			id: VOLUME_ID,
			name: 'Terminal HD',
			kind: 'local',
			rootNodeId: ROOT_ID,
			ownedApps: preOwnedStoreApps
		};

		// 2. Root folder
		const root: FsFolder = {
			id: ROOT_ID,
			volumeId: VOLUME_ID,
			kind: 'folder',
			parentId: null,
			name: 'Terminal HD',
			flags: { system: true, protected: true },
			createdAt: now,
			updatedAt: now
		};
		nodes.set(ROOT_ID, root);

		// 3. System folders
		const systemFolders: { id: NodeId; name: string }[] = [
			{ id: APPLICATIONS_ID, name: 'Applications' },
			{ id: DOCUMENTS_ID, name: 'Documents' },
			{ id: DESKTOP_ID, name: 'Desktop' },
			{ id: SYSTEM_ID, name: 'System' },
			{ id: RECORDINGS_ID, name: 'Recordings' },
			{ id: TRASH_ID, name: 'Trash' }
		];

		for (const sf of systemFolders) {
			const folder: FsFolder = {
				id: sf.id,
				volumeId: VOLUME_ID,
				kind: 'folder',
				parentId: ROOT_ID,
				name: sf.name,
				flags: { system: true, protected: true },
				createdAt: now,
				updatedAt: now
			};
			nodes.set(sf.id, folder);
		}

		// AppData container lives under /System. It's system-flagged (protected
		// from casual deletion) but NOT hidden, so each app's files ride in the
		// manifest backup automatically.
		const appDataFolder: FsFolder = {
			id: APPDATA_ID,
			volumeId: VOLUME_ID,
			kind: 'folder',
			parentId: SYSTEM_ID,
			name: 'AppData',
			flags: { system: true, protected: true },
			createdAt: now,
			updatedAt: now
		};
		nodes.set(APPDATA_ID, appDataFolder);

		// 4. Seed app file nodes
		//    - system apps go into /Applications
		//    - non-file apps (finder, trash) are never created as files
		// System Preferences and About This Terminal have no /System icons — they
		// are reached from the Apple menu — so nothing seeds into /System here.
		const appsToSeed = getSystemApps();

		const appFileIds = new Map<string, NodeId>(); // appId -> file nodeId
		const seenAppIds = new Set<string>();

		for (const appDef of appsToSeed) {
			if (NON_FILE_APPS.has(appDef.id)) continue;
			if (seenAppIds.has(appDef.id)) continue;
			seenAppIds.add(appDef.id);

			const parentId = APPLICATIONS_ID;
			const fileId = generateUniqueId();
			appFileIds.set(appDef.id, fileId);

			const file: FsFile = {
				id: fileId,
				volumeId: VOLUME_ID,
				kind: 'file',
				parentId,
				name: appDef.fileName,
				fileType: 'app',
				opensWith: appDef.id,
				appId: appDef.id,
				flags: {
					system: appDef.category === 'system',
					protected: !appDef.removable
				},
				createdAt: now,
				updatedAt: now
			};
			nodes.set(fileId, file);
		}

		// 5. Desktop aliases for apps with desktopAliasByDefault
		const desktopApps = getDesktopAliasApps();

		for (const appDef of desktopApps) {
			const targetFileId = appFileIds.get(appDef.id);
			if (!targetFileId) continue;

			const aliasId = generateUniqueId();
			const targetNode = nodes.get(targetFileId);
			if (!targetNode) continue;

			const targetPath = derivePath(targetFileId, nodes);

			const alias: FsAlias = {
				id: aliasId,
				volumeId: VOLUME_ID,
				kind: 'alias',
				parentId: DESKTOP_ID,
				name: appDef.fileName,
				target: {
					nodeId: targetFileId,
					originalPath: targetPath,
					originalName: appDef.fileName,
					targetKind: 'app'
				},
				createdAt: now,
				updatedAt: now
			};
			nodes.set(aliasId, alias);
		}

		// 6. Default documents
		const readmeId = generateUniqueId();
		const readmeFile: FsFile = {
			id: readmeId,
			volumeId: VOLUME_ID,
			kind: 'file',
			parentId: DOCUMENTS_ID,
			name: 'README.TXT',
			fileType: 'text',
			opensWith: 'textedit',
			bodyRef: { kind: 'inline-text', text: README_CONTENT },
			createdAt: now,
			updatedAt: now
		};
		nodes.set(readmeId, readmeFile);

		const pricingId = generateUniqueId();
		const pricingFile: FsFile = {
			id: pricingId,
			volumeId: VOLUME_ID,
			kind: 'file',
			parentId: DOCUMENTS_ID,
			name: 'Pricing.txt',
			fileType: 'text',
			opensWith: 'textedit',
			bodyRef: { kind: 'inline-text', text: PRICING_CONTENT },
			createdAt: now,
			updatedAt: now
		};
		nodes.set(pricingId, pricingFile);

		return new TerminalFS(volume, nodes, manifestStore, bodyStore, false);
	}

	// --- Read-only API ---

	async getNode(nodeId: NodeId): Promise<FsResult<FsNode>> {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return fail('not_found', `Node "${nodeId}" not found`);
		}
		return ok(node);
	}

	async listFolder(folderId: NodeId): Promise<FsResult<FsNode[]>> {
		const node = this.nodes.get(folderId);
		if (!node) {
			return fail('not_found', `Node "${folderId}" not found`);
		}
		if (node.kind !== 'folder') {
			return fail('not_folder', `Node "${folderId}" is not a folder`);
		}

		const children: FsNode[] = [];
		for (const n of this.nodes.values()) {
			if (n.parentId === folderId) {
				children.push(n);
			}
		}

		// Sort: folders first, then alphabetical by name
		children.sort((a, b) => {
			const aIsFolder = a.kind === 'folder';
			const bIsFolder = b.kind === 'folder';
			if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		return ok(children);
	}

	async getPath(nodeId: NodeId): Promise<FsResult<string>> {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return fail('not_found', `Node "${nodeId}" not found`);
		}
		return ok(derivePath(nodeId, this.nodes));
	}

	getVolume(): TerminalVolume {
		return this.volume;
	}

	peekNode(nodeId: NodeId): Readonly<FsNode> | undefined {
		return this.nodes.get(nodeId);
	}

	getAllNodes(): Map<NodeId, FsNode> {
		return new Map(this.nodes);
	}

	// --- Mutations ---

	/** Return the children of a given parent as an array of {name} objects. */
	private siblings(parentId: NodeId): { name: string }[] {
		const result: { name: string }[] = [];
		for (const n of this.nodes.values()) {
			if (n.parentId === parentId) {
				result.push({ name: n.name });
			}
		}
		return result;
	}

	/** Check whether a node is protected or system-flagged. */
	private isProtected(node: FsNode): boolean {
		return node.flags?.protected === true || node.flags?.system === true;
	}

	/** Walk from nodeId up through parentId chain; returns true if ancestorId is found. */
	private isAncestor(nodeId: NodeId, ancestorId: NodeId): boolean {
		let current = this.nodes.get(nodeId);
		while (current) {
			if (current.id === ancestorId) return true;
			current = current.parentId ? this.nodes.get(current.parentId) : undefined;
		}
		return false;
	}

	/** Collect a node and all its descendants recursively. */
	private collectDescendants(nodeId: NodeId): NodeId[] {
		const result: NodeId[] = [nodeId];
		for (const n of this.nodes.values()) {
			if (n.parentId === nodeId) {
				result.push(...this.collectDescendants(n.id));
			}
		}
		return result;
	}

	async createFolder(parentId: NodeId, name: string): Promise<FsResult<FsFolder>> {
		const parent = this.nodes.get(parentId);
		if (!parent) return fail('not_found', `Parent "${parentId}" not found`);
		if (parent.kind !== 'folder') return fail('not_folder', `Parent "${parentId}" is not a folder`);

		if (hasSiblingConflict(name, this.siblings(parentId))) {
			return fail('duplicate_name', `A node named "${name}" already exists in this folder`);
		}

		const now = Date.now();
		const nodeId = generateUniqueId();
		const folder: FsFolder = {
			id: nodeId,
			volumeId: this.volume.id,
			kind: 'folder',
			parentId,
			name,
			createdAt: now,
			updatedAt: now
		};
		const snapshot = this.snapshotState();
		this.nodes.set(nodeId, folder);

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'create_folder',
			label: `Create folder "${name}"`,
			undoData: { type: 'delete_node', nodeId }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsFolder>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([nodeId], [parentId], 'create_folder');
		return ok(folder);
	}

	/**
	 * Get (or lazily create) an app's private folder under /System/AppData/<appId>.
	 *
	 * Apps store their files here so they don't collide in the disk root. The
	 * folder is named by the appId string — human-readable in Finder and stable
	 * across reloads, so it's looked up by name each call rather than by a fixed
	 * id.
	 *
	 * Self-healing: disks persisted before AppData existed won't have the
	 * container node. If APPDATA_ID is missing, this recreates it under /System,
	 * so no separate migration pass is needed.
	 */
	async getAppDataFolder(appId: PersistedAppId): Promise<FsResult<NodeId>> {
		let created = false;
		const snapshot = this.snapshotState();

		// Ensure the /System/AppData container exists (seeded on clean disks,
		// recreated here for older disks).
		if (!this.nodes.has(APPDATA_ID)) {
			const system = this.nodes.get(SYSTEM_ID);
			if (!system) return fail('not_found', `System folder "${SYSTEM_ID}" not found`);

			const now = Date.now();
			const container: FsFolder = {
				id: APPDATA_ID,
				volumeId: this.volume.id,
				kind: 'folder',
				parentId: SYSTEM_ID,
				name: 'AppData',
				flags: { system: true, protected: true },
				createdAt: now,
				updatedAt: now
			};
			this.nodes.set(APPDATA_ID, container);
			created = true;
		}

		// Find this app's folder by name within the container.
		for (const n of this.nodes.values()) {
			if (n.parentId === APPDATA_ID && n.kind === 'folder' && n.name === appId) {
				if (created) {
					const persistResult = await this.debouncedPersist();
					if (!persistResult.ok) {
						this.restoreState(snapshot);
						return persistResult as FsResult<NodeId>;
					}
				}
				return ok(n.id);
			}
		}

		// Not found — create a normal (non-system) folder named by appId.
		const now = Date.now();
		const folderId = generateUniqueId();
		const folder: FsFolder = {
			id: folderId,
			volumeId: this.volume.id,
			kind: 'folder',
			parentId: APPDATA_ID,
			name: appId,
			createdAt: now,
			updatedAt: now
		};
		this.nodes.set(folderId, folder);

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<NodeId>;
		}

		this.notifyChange([folderId], [APPDATA_ID], 'create_folder');
		return ok(folderId);
	}

	async createTextFile(parentId: NodeId, name: string, text: string): Promise<FsResult<FsFile>> {
		const parent = this.nodes.get(parentId);
		if (!parent) return fail('not_found', `Parent "${parentId}" not found`);
		if (parent.kind !== 'folder') return fail('not_folder', `Parent "${parentId}" is not a folder`);

		if (hasSiblingConflict(name, this.siblings(parentId))) {
			return fail('duplicate_name', `A node named "${name}" already exists in this folder`);
		}

		const now = Date.now();
		const nodeId = generateUniqueId();
		const file: FsFile = {
			id: nodeId,
			volumeId: this.volume.id,
			kind: 'file',
			parentId,
			name,
			fileType: 'text',
			opensWith: 'textedit',
			bodyRef: { kind: 'inline-text', text },
			createdAt: now,
			updatedAt: now
		};
		const snapshot = this.snapshotState();
		this.nodes.set(nodeId, file);

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'create_file',
			label: `Create file "${name}"`,
			undoData: { type: 'delete_node', nodeId }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsFile>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([nodeId], [parentId], 'create_file');
		return ok(file);
	}

	async createFile(
		parentId: NodeId,
		name: string,
		opts: { appId?: AppId; fileType?: FileType; text?: string }
	): Promise<FsResult<FsFile>> {
		const parent = this.nodes.get(parentId);
		if (!parent) return fail('not_found', `Parent "${parentId}" not found`);
		if (parent.kind !== 'folder') return fail('not_folder', `Parent "${parentId}" is not a folder`);

		if (hasSiblingConflict(name, this.siblings(parentId))) {
			return fail('duplicate_name', `A node named "${name}" already exists in this folder`);
		}

		const now = Date.now();
		const nodeId = generateUniqueId();
		const file: FsFile = {
			id: nodeId,
			volumeId: this.volume.id,
			kind: 'file',
			parentId,
			name,
			fileType: opts.fileType ?? 'data',
			opensWith: opts.appId,
			appId: opts.appId,
			bodyRef: opts.text !== undefined ? { kind: 'inline-text', text: opts.text } : undefined,
			createdAt: now,
			updatedAt: now
		};
		const snapshot = this.snapshotState();
		this.nodes.set(nodeId, file);

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'create_file',
			label: `Create file "${name}"`,
			undoData: { type: 'delete_node', nodeId }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsFile>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([nodeId], [parentId], 'create_file');
		return ok(file);
	}

	async createBlobFile(
		parentId: NodeId,
		name: string,
		data: ArrayBuffer,
		opts: { appId?: AppId; opensWith?: PersistedAppId; fileType?: FileType; contentType?: string }
	): Promise<FsResult<FsFile>> {
		const parent = this.nodes.get(parentId);
		if (!parent) return fail('not_found', `Parent "${parentId}" not found`);
		if (parent.kind !== 'folder') return fail('not_folder', `Parent "${parentId}" is not a folder`);

		if (hasSiblingConflict(name, this.siblings(parentId))) {
			return fail('duplicate_name', `A node named "${name}" already exists in this folder`);
		}

		const nodeId = generateUniqueId();
		const bodyId: BodyId = `body_${generateUniqueId()}`;

		// Write the bytes first so a quota failure aborts before a dangling node exists.
		const w = await this.bodies.write(bodyId, data);
		if (!w.ok) return w as FsResult<FsFile>;

		const now = Date.now();
		const bodyRef: BodyRef = {
			kind: 'indexeddb-blob',
			bodyId,
			size: data.byteLength,
			...(opts.contentType !== undefined ? { contentType: opts.contentType } : {})
		};
		const file: FsFile = {
			id: nodeId,
			volumeId: this.volume.id,
			kind: 'file',
			parentId,
			name,
			fileType: opts.fileType ?? 'data',
			// appId is the creator; opensWith is the handler that opens it. They
			// were collapsed before. Defaulting opensWith to appId keeps every
			// existing caller unchanged; a caller that differs (a recording made by
			// 'recorder' but opened by the system 'player') passes opensWith.
			opensWith: opts.opensWith ?? opts.appId,
			appId: opts.appId,
			bodyRef,
			createdAt: now,
			updatedAt: now
		};
		const snapshot = this.snapshotState();
		this.nodes.set(nodeId, file);

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'create_file',
			label: `Create file "${name}"`,
			undoData: { type: 'delete_node', nodeId }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsFile>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([nodeId], [parentId], 'create_file');
		return ok(file);
	}

	async replaceBlobFileBody(
		fileId: NodeId,
		data: ArrayBuffer,
		opts: { contentType?: string | null } = {}
	): Promise<FsResult<FsFile>> {
		const node = this.nodes.get(fileId);
		if (!node) return fail('not_found', `Node "${fileId}" not found`);
		if (node.kind !== 'file') return fail('not_found', `Node "${fileId}" is not a file`);

		const previousBodyRef = node.bodyRef;
		const bodyId: BodyId = `body_${generateUniqueId()}`;

		// Write the new immutable body before the manifest points at it.
		const writeResult = await this.bodies.write(bodyId, data);
		if (!writeResult.ok) return writeResult as FsResult<FsFile>;

		const preservedContentType =
			previousBodyRef?.kind === 'indexeddb-blob' ? previousBodyRef.contentType : undefined;
		const contentType = opts.contentType === undefined ? preservedContentType : opts.contentType;
		const bodyRef: BodyRef = {
			kind: 'indexeddb-blob',
			bodyId,
			size: data.byteLength,
			...(contentType != null ? { contentType } : {})
		};
		const updated: FsFile = {
			...node,
			bodyRef,
			updatedAt: Date.now()
		};
		const snapshot = this.snapshotState();
		this.nodes.set(fileId, updated);

		const shouldCollectGarbage = previousBodyRef?.kind === 'indexeddb-blob';
		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsFile>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([fileId], [node.parentId], 'write');
		return ok(updated);
	}

	async writeText(fileId: NodeId, text: string): Promise<FsResult<FsFile>> {
		const node = this.nodes.get(fileId);
		if (!node) return fail('not_found', `Node "${fileId}" not found`);
		if (node.kind !== 'file') return fail('not_found', `Node "${fileId}" is not a file`);

		const shouldCollectGarbage = node.bodyRef?.kind === 'indexeddb-blob';
		const updated: FsFile = {
			...node,
			bodyRef: { kind: 'inline-text', text },
			updatedAt: Date.now()
		};
		const snapshot = this.snapshotState();
		this.nodes.set(fileId, updated);

		// No undo for writes — text editors handle their own undo
		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsFile>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([fileId], [node.parentId], 'write');
		return ok(updated);
	}

	async rename(nodeId: NodeId, newName: string): Promise<FsResult<FsNode>> {
		const node = this.nodes.get(nodeId);
		if (!node) return fail('not_found', `Node "${nodeId}" not found`);

		if (this.isProtected(node)) {
			return fail('protected_node', `Cannot rename protected node "${node.name}"`);
		}

		// Check sibling conflicts if the node has a parent
		if (node.parentId) {
			const siblingsExcludingSelf = this.siblings(node.parentId).filter(
				(s) => s.name !== node.name
			);
			if (hasSiblingConflict(newName, siblingsExcludingSelf)) {
				return fail(
					'duplicate_name',
					`A node named "${newName}" already exists in the parent folder`
				);
			}
		}

		const previousName = node.name;
		const updated: FsNode = { ...node, name: newName, updatedAt: Date.now() };
		const snapshot = this.snapshotState();
		this.nodes.set(nodeId, updated);

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'rename',
			label: `Rename "${previousName}" to "${newName}"`,
			undoData: { type: 'rename_back', nodeId, previousName }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsNode>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([nodeId], node.parentId ? [node.parentId] : [], 'rename');
		return ok(updated);
	}

	async move(nodeId: NodeId, targetFolderId: NodeId): Promise<FsResult<FsNode>> {
		const node = this.nodes.get(nodeId);
		if (!node) return fail('not_found', `Node "${nodeId}" not found`);

		if (this.isProtected(node)) {
			return fail('protected_node', `Cannot move protected node "${node.name}"`);
		}

		const target = this.nodes.get(targetFolderId);
		if (!target) return fail('not_found', `Target folder "${targetFolderId}" not found`);
		if (target.kind !== 'folder') {
			return fail('not_folder', `Target "${targetFolderId}" is not a folder`);
		}

		// Cycle detection: walk from target up; if we hit nodeId, it's a cycle
		if (node.kind === 'folder' && this.isAncestor(targetFolderId, nodeId)) {
			return fail('invalid_move', 'Cannot move a folder into itself or its descendants');
		}

		// Name conflict in target
		if (hasSiblingConflict(node.name, this.siblings(targetFolderId))) {
			return fail(
				'duplicate_name',
				`A node named "${node.name}" already exists in the target folder`
			);
		}

		const previousParentId = node.parentId;
		if (!previousParentId) {
			return fail('protected_node', 'Cannot move the root node');
		}

		const updated: FsNode = {
			...node,
			parentId: targetFolderId,
			updatedAt: Date.now()
		} as FsNode;
		const snapshot = this.snapshotState();
		this.nodes.set(nodeId, updated);

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'move',
			label: `Move "${node.name}"`,
			undoData: { type: 'move_back', nodeId, previousParentId }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsNode>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([nodeId], [previousParentId, targetFolderId], 'move');
		return ok(updated);
	}

	async duplicate(nodeId: NodeId): Promise<FsResult<FsNode>> {
		const node = this.nodes.get(nodeId);
		if (!node) return fail('not_found', `Node "${nodeId}" not found`);

		const parentId = node.parentId;
		if (!parentId) return fail('protected_node', 'Cannot duplicate the root node');

		const siblings = this.siblings(parentId);
		const copyName = generateCopyName(node.name, siblings);
		const now = Date.now();

		const newNodes = deepDuplicate(nodeId, parentId, this.nodes, this.volume.id, now);
		if (newNodes.length === 0) {
			return fail('not_found', 'Failed to duplicate node');
		}

		// Set the top-level copy's name
		const topNode = newNodes[0];
		(topNode as FsNode & { name: string }).name = copyName;

		// Add all new nodes to the map
		const snapshot = this.snapshotState();
		const newIds: NodeId[] = [];
		for (const n of newNodes) {
			this.nodes.set(n.id, n);
			newIds.push(n.id);
		}

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'duplicate',
			label: `Duplicate "${node.name}"`,
			undoData: { type: 'delete_nodes', nodeIds: newIds }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsNode>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange(newIds, [parentId], 'duplicate');
		return ok(topNode);
	}

	async trash(nodeId: NodeId): Promise<FsResult<FsNode>> {
		const node = this.nodes.get(nodeId);
		if (!node) return fail('not_found', `Node "${nodeId}" not found`);

		if (this.isProtected(node)) {
			return fail('protected_node', `Cannot trash protected node "${node.name}"`);
		}

		if (nodeId === TRASH_ID) {
			return fail('protected_node', 'Cannot trash the Trash folder');
		}

		const previousParentId = node.parentId;
		if (!previousParentId) {
			return fail('protected_node', 'Cannot trash the root node');
		}

		const updated: FsNode = {
			...node,
			parentId: TRASH_ID,
			updatedAt: Date.now()
		} as FsNode;
		const snapshot = this.snapshotState();
		this.nodes.set(nodeId, updated);

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'trash',
			label: `Trash "${node.name}"`,
			undoData: { type: 'move_back', nodeId, previousParentId }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsNode>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([nodeId], [previousParentId, TRASH_ID], 'trash');
		return ok(updated);
	}

	async emptyTrash(): Promise<FsResult<{ deletedCount: number }>> {
		// Collect all descendants of Trash (but not Trash itself)
		const trashChildren: NodeId[] = [];
		for (const n of this.nodes.values()) {
			if (n.parentId === TRASH_ID) {
				trashChildren.push(...this.collectDescendants(n.id));
			}
		}

		const snapshot = this.snapshotState();
		for (const id of trashChildren) {
			this.nodes.delete(id);
		}

		// Clear undo — emptyTrash is destructive and irreversible.
		const shouldCollectGarbage =
			trashChildren.length > 0 || this.undoRecordRetainsBlobBodies(this.lastUndo);
		this.lastUndo = null;

		await this.flushPersist();
		const persistResult = await this.persist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<{ deletedCount: number }>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange(trashChildren, [TRASH_ID], 'empty_trash');
		return ok({ deletedCount: trashChildren.length });
	}

	async createAlias(
		parentId: NodeId,
		targetNodeId: NodeId,
		name?: string
	): Promise<FsResult<FsAlias>> {
		const parent = this.nodes.get(parentId);
		if (!parent) return fail('not_found', `Parent "${parentId}" not found`);
		if (parent.kind !== 'folder') return fail('not_folder', `Parent "${parentId}" is not a folder`);

		const target = this.nodes.get(targetNodeId);
		if (!target) return fail('not_found', `Target "${targetNodeId}" not found`);

		const aliasName = name ?? target.name;

		if (hasSiblingConflict(aliasName, this.siblings(parentId))) {
			return fail('duplicate_name', `A node named "${aliasName}" already exists in this folder`);
		}

		const targetKind: 'file' | 'folder' | 'app' =
			target.kind === 'folder'
				? 'folder'
				: target.kind === 'file' && target.fileType === 'app'
					? 'app'
					: 'file';

		const now = Date.now();
		const aliasId = generateUniqueId();
		const alias: FsAlias = {
			id: aliasId,
			volumeId: this.volume.id,
			kind: 'alias',
			parentId,
			name: aliasName,
			target: {
				nodeId: targetNodeId,
				originalPath: derivePath(targetNodeId, this.nodes),
				originalName: target.name,
				targetKind,
				fingerprint: buildFingerprint(target)
			},
			createdAt: now,
			updatedAt: now
		};
		const snapshot = this.snapshotState();
		this.nodes.set(aliasId, alias);

		const shouldCollectGarbage = this.setLastUndo({
			kind: 'create_alias',
			label: `Create alias "${aliasName}"`,
			undoData: { type: 'delete_node', nodeId: aliasId }
		});

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsAlias>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange([aliasId], [parentId], 'create_alias');
		return ok(alias);
	}

	async resolveAlias(aliasId: NodeId): Promise<FsResult<FsNode>> {
		const node = this.nodes.get(aliasId);
		if (!node) return fail('not_found', `Node "${aliasId}" not found`);
		if (node.kind !== 'alias') return fail('not_found', `Node "${aliasId}" is not an alias`);

		const result = resolveAliasTarget(node, this.nodes);

		switch (result.status) {
			case 'resolved':
				return ok(result.node);
			case 'repaired': {
				// Apply the repair — update the alias in the node map
				const snapshot = this.snapshotState();
				this.nodes.set(aliasId, result.alias);
				const persistResult = await this.debouncedPersist();
				if (!persistResult.ok) {
					this.restoreState(snapshot);
					return persistResult as FsResult<FsNode>;
				}
				this.notifyChange([aliasId], [], 'repair_alias');
				return ok(result.node);
			}
			case 'broken':
				return fail('broken_alias', result.reason);
		}
	}

	async undoLast(): Promise<FsResult<string>> {
		const undo = this.lastUndo;
		if (!undo) return fail('not_found', 'Nothing to undo');

		const { undoData, label } = undo;
		const snapshot = this.snapshotState();
		const affectedNodeIds: NodeId[] = [];
		const affectedFolderIds: NodeId[] = [];

		switch (undoData.type) {
			case 'delete_node': {
				const node = this.nodes.get(undoData.nodeId);
				if (node?.parentId) affectedFolderIds.push(node.parentId);
				affectedNodeIds.push(undoData.nodeId);
				this.nodes.delete(undoData.nodeId);
				break;
			}

			case 'delete_nodes':
				for (const id of undoData.nodeIds) {
					const node = this.nodes.get(id);
					if (node?.parentId) affectedFolderIds.push(node.parentId);
					affectedNodeIds.push(id);
					this.nodes.delete(id);
				}
				break;

			case 'move_back': {
				const node = this.nodes.get(undoData.nodeId);
				if (node) {
					if (node.parentId) affectedFolderIds.push(node.parentId);
					affectedFolderIds.push(undoData.previousParentId);
					affectedNodeIds.push(undoData.nodeId);
					const restored: FsNode = {
						...node,
						parentId: undoData.previousParentId,
						updatedAt: Date.now()
					} as FsNode;
					this.nodes.set(undoData.nodeId, restored);
				}
				break;
			}

			case 'rename_back': {
				const node = this.nodes.get(undoData.nodeId);
				if (node) {
					affectedNodeIds.push(undoData.nodeId);
					if (node.parentId) affectedFolderIds.push(node.parentId);
					const restored: FsNode = {
						...node,
						name: undoData.previousName,
						updatedAt: Date.now()
					};
					this.nodes.set(undoData.nodeId, restored);
				}
				break;
			}

			case 'restore_nodes':
				for (const n of undoData.nodes) {
					affectedNodeIds.push(n.id);
					if (n.parentId) affectedFolderIds.push(n.parentId);
					this.nodes.set(n.id, n);
				}
				break;
		}

		// One-level undo: clear after executing
		this.lastUndo = null;

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<string>;
		}
		await this.collectGarbageAfterCommit(true);

		this.notifyChange(affectedNodeIds, affectedFolderIds, 'undo');
		return ok(label);
	}

	async getUndoLabel(): Promise<FsResult<string>> {
		if (!this.lastUndo) return fail('not_found', 'Nothing to undo');
		return ok(this.lastUndo.label);
	}

	// --- App install/uninstall ---

	// The install/ownership methods below take PersistedAppId: the UI passes ids
	// straight from disk (My Shelf, the Store, restored windows), and each method
	// re-validates against the catalog (getAppDef) or the node graph and fails
	// gracefully on an unknown id. That is the disk→catalog boundary in action.
	async installApp(appId: PersistedAppId): Promise<FsResult<FsFile>> {
		const appDef = getAppDef(appId);
		if (!appDef) return fail('missing_app', `App "${appId}" not found in AppLibrary`);

		// Check if already installed
		const existing = findAppFile(appId, this.nodes);
		if (existing) return fail('duplicate_name', `App "${appDef.name}" is already installed`);

		const now = Date.now();
		const fileId = generateUniqueId();

		// Create app file in /Applications
		const file: FsFile = {
			id: fileId,
			volumeId: this.volume.id,
			kind: 'file',
			parentId: APPLICATIONS_ID,
			name: appDef.fileName,
			fileType: 'app',
			opensWith: appId,
			appId: appId,
			flags: {
				system: appDef.category === 'system',
				protected: !appDef.removable
			},
			createdAt: now,
			updatedAt: now
		};
		const snapshot = this.snapshotState();
		this.nodes.set(fileId, file);

		// Create desktop alias if configured
		if (appDef.desktopAliasByDefault) {
			if (!hasSiblingConflict(appDef.fileName, this.siblings(DESKTOP_ID))) {
				const aliasId = generateUniqueId();
				const alias: FsAlias = {
					id: aliasId,
					volumeId: this.volume.id,
					kind: 'alias',
					parentId: DESKTOP_ID,
					name: appDef.fileName,
					target: {
						nodeId: fileId,
						originalPath: derivePath(fileId, this.nodes),
						originalName: appDef.fileName,
						targetKind: 'app',
						fingerprint: appId
					},
					createdAt: now,
					updatedAt: now
				};
				this.nodes.set(aliasId, alias);
			}
		}

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<FsFile>;
		}

		this.notifyChange([fileId], [APPLICATIONS_ID, DESKTOP_ID], 'install_app');

		return ok(file);
	}

	async uninstallApp(appId: PersistedAppId): Promise<FsResult<{ removedFiles: number }>> {
		const appDef = getAppDef(appId);
		if (!appDef) return fail('missing_app', `App "${appId}" not found in AppLibrary`);

		if (!appDef.removable) {
			return fail('protected_node', `"${appDef.name}" is a core OS app and cannot be uninstalled`);
		}

		// Find the app file (fileType: 'app' only — never user documents)
		const appFile = findAppFile(appId, this.nodes);
		if (!appFile) return fail('not_found', `App "${appDef.name}" is not installed`);

		// Safety: only delete files in /Applications or /System
		if (appFile.parentId !== APPLICATIONS_ID && appFile.parentId !== SYSTEM_ID) {
			return fail('protected_node', `Cannot uninstall: file is not in Applications`);
		}

		// Remove the app file
		const snapshot = this.snapshotState();
		this.nodes.delete(appFile.id);

		// Remove desktop aliases that point to this app file
		const removedAliasIds: NodeId[] = [];
		for (const node of this.nodes.values()) {
			if (node.kind === 'alias' && node.target.nodeId === appFile.id) {
				removedAliasIds.push(node.id);
			}
		}
		for (const id of removedAliasIds) {
			this.nodes.delete(id);
		}

		// Clear undo since uninstall involves multiple nodes.
		const shouldCollectGarbage = this.clearLastUndo() || this.nodeReferencesBlobBody(appFile);

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<{ removedFiles: number }>;
		}
		await this.collectGarbageAfterCommit(shouldCollectGarbage);

		this.notifyChange(
			[appFile.id, ...removedAliasIds],
			[APPLICATIONS_ID, DESKTOP_ID],
			'uninstall_app'
		);

		return ok({ removedFiles: 1 + removedAliasIds.length });
	}

	async isAppInstalled(appId: PersistedAppId): Promise<FsResult<boolean>> {
		return ok(this.isAppInstalledSync(appId));
	}

	isAppInstalledSync(appId: PersistedAppId): boolean {
		return findAppFile(appId, this.nodes) !== undefined;
	}

	getInstalledApps(): InstalledApp[] {
		const apps: InstalledApp[] = [];
		for (const node of this.nodes.values()) {
			if (node.kind !== 'file' || node.fileType !== 'app' || !node.appId) continue;
			const def = getAppDef(node.appId);
			const windowId = getAppWindowId(node.appId);
			if (!def || !windowId) continue;
			apps.push({ id: node.appId, name: def.name, icon: def.icon, windowId });
		}
		return apps;
	}

	// --- Ownership (buy/return) ---

	isAppOwned(appId: PersistedAppId): boolean {
		return checkOwned(appId, this.volume.ownedApps ?? []);
	}

	getOwnedApps(): PersistedAppId[] {
		return this.volume.ownedApps ?? [];
	}

	async buyApp(appId: PersistedAppId): Promise<FsResult<void>> {
		const appDef = getAppDef(appId);
		if (!appDef) return fail('missing_app', `App "${appId}" not found in AppLibrary`);

		if (this.isAppOwned(appId)) {
			return fail('duplicate_name', `App "${appDef.name}" is already owned`);
		}

		const owned = this.volume.ownedApps ?? [];
		const snapshot = this.snapshotState();
		this.volume = { ...this.volume, ownedApps: [...owned, appId] };

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult;
		}

		this.notifyChange([], [], 'buy_app');
		return ok(undefined);
	}

	async returnApp(appId: PersistedAppId): Promise<FsResult<void>> {
		const appDef = getAppDef(appId);
		if (!appDef) return fail('missing_app', `App "${appId}" not found in AppLibrary`);

		if (!this.isAppOwned(appId)) {
			return fail('not_found', `App "${appDef.name}" is not owned`);
		}

		// Cannot return an app that is currently installed
		const installed = findAppFile(appId, this.nodes) !== undefined;
		if (installed) {
			return fail('protected_node', `Uninstall "${appDef.name}" before returning it`);
		}

		const owned = this.volume.ownedApps ?? [];
		const snapshot = this.snapshotState();
		this.volume = { ...this.volume, ownedApps: owned.filter((id) => id !== appId) };

		const persistResult = await this.debouncedPersist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult;
		}

		this.notifyChange([], [], 'return_app');
		return ok(undefined);
	}

	// --- Body storage ---

	async collectGarbage(): Promise<FsResult<BodyGcReport>> {
		let storedBodyIds: BodyId[];
		try {
			storedBodyIds = await this.bodies.listBodyIds();
		} catch (e) {
			return fail('corrupt_disk', 'Failed to list blob bodies for garbage collection', e);
		}

		let reachable: Set<BodyId>;
		try {
			reachable = await this.reachableBodyIdsForGarbageCollection();
		} catch (e) {
			return fail('corrupt_disk', 'Failed to load manifest reachability for garbage collection', e);
		}

		const stored = new Set(storedBodyIds);
		const reachableStored = new Set<BodyId>();
		for (const bodyId of stored) {
			if (reachable.has(bodyId)) {
				reachableStored.add(bodyId);
			}
		}

		const failedBodyIds: BodyId[] = [];
		let deleted = 0;

		for (const bodyId of stored) {
			if (reachable.has(bodyId)) continue;

			try {
				await this.bodies.delete(bodyId);
				deleted++;
			} catch {
				failedBodyIds.push(bodyId);
			}
		}

		return ok({
			stored: stored.size,
			reachable: reachableStored.size,
			unreachable: stored.size - reachableStored.size,
			deleted,
			failed: failedBodyIds.length,
			failedBodyIds
		});
	}

	async readBody(bodyId: BodyId): Promise<FsResult<ArrayBuffer>> {
		const data = await this.bodies.read(bodyId);
		if (!data) return fail('not_found', `Body "${bodyId}" not found`);
		return ok(data);
	}

	// --- Disk usage ---

	async getDiskUsage(): Promise<FsResult<DiskUsage>> {
		const blobBytes = await this.bodies.getUsedBytes();
		return ok(computeDiskUsage(this.nodes, blobBytes));
	}

	// --- Watchers ---

	/** Watch all filesystem changes. Returns unsubscribe function. */
	watch(callback: FsWatchCallback): () => void {
		return this.watcherRegistry.watch(callback);
	}

	/** Watch changes to a specific node. Returns unsubscribe function. */
	watchNode(nodeId: NodeId, callback: FsWatchCallback): () => void {
		return this.watcherRegistry.watchNode(nodeId, callback);
	}

	/** Watch changes to a folder's children. Returns unsubscribe function. */
	watchFolder(folderId: NodeId, callback: FsWatchCallback): () => void {
		return this.watcherRegistry.watchFolder(folderId, callback);
	}

	// --- Backup / Restore ---

	async exportBackup(preferences?: BackupPreferences): Promise<FsResult<BackupFileV3>> {
		const validation = validateDiskForExport(this.volume, this.nodes);
		if (!validation.ok) return validation as FsResult<BackupFileV3>;

		// Collect blob bytes from the body store, keyed by bodyId. Inline text
		// rides inside the node, so only indexeddb-blob refs need exporting.
		const bodies: Record<string, string> = {};
		for (const node of this.nodes.values()) {
			if (node.flags?.hidden) continue;
			if (node.kind !== 'file' || node.bodyRef?.kind !== 'indexeddb-blob') continue;

			const { bodyId } = node.bodyRef;
			const data = await this.bodies.read(bodyId);
			if (!data) {
				return fail('not_found', `Body "${bodyId}" for "${node.name}" not found`);
			}
			bodies[bodyId] = arrayBufferToBase64(data);
		}

		const backup = buildBackup(this.volume, this.nodes, preferences, bodies);
		return ok(backup);
	}

	async validateBackup(data: unknown): Promise<FsResult<BackupRestoreResult>> {
		const validated = validateBackup(data);
		if (!validated.ok) return validated as FsResult<BackupRestoreResult>;

		const preview = previewBackup(validated.value);
		return ok(preview);
	}

	async restoreBackup(data: unknown): Promise<FsResult<BackupRestoreResult>> {
		const validated = validateBackup(data);
		if (!validated.ok) return validated as FsResult<BackupRestoreResult>;

		const backup = validated.value;

		// Fail loud BEFORE mutating any state: a v3 backup must carry the bytes
		// for every blob its nodes reference, or restore would leave dangling
		// pointers.
		if (backup.version === 3) {
			for (const node of backup.nodes) {
				if (node.kind !== 'file' || node.bodyRef?.kind !== 'indexeddb-blob') continue;
				const { bodyId } = node.bodyRef;
				if (!(bodyId in backup.bodies)) {
					return fail(
						'invalid_backup',
						`Backup references missing body "${bodyId}" for "${node.name}"`
					);
				}
			}
		}

		const preview = previewBackup(backup);

		await this.flushPersist();

		const nextNodes = new Map<NodeId, FsNode>();
		for (const node of backup.nodes) {
			nextNodes.set(node.id, node as FsNode);
		}

		// Restore ownedApps from v2/v3 backups (always set — even if empty/undefined)
		const nextVolume =
			backup.version !== 1
				? { ...this.volume, ownedApps: backup.disk.ownedApps ?? [] }
				: this.volume;

		const oldVolume = this.volume;
		const oldNodes = Array.from(this.nodes.values());
		const rollbackManifest = async (
			restoreError: unknown
		): Promise<FsResult<BackupRestoreResult>> => {
			const rollback = await this.manifest.save(oldVolume, oldNodes);
			if (!rollback.ok) {
				return fail(
					'corrupt_disk',
					'Restore failed and Terminal HD could not roll back its manifest. Reload Terminal OS, then restore from the backup file again.',
					{ restoreError, rollbackError: rollback.error }
				);
			}
			if (restoreError instanceof InvalidBackupBodyError) {
				return fail(
					'invalid_backup',
					`Backup body "${restoreError.bodyId}" is not valid base64`,
					restoreError.cause
				);
			}
			if (
				restoreError &&
				typeof restoreError === 'object' &&
				'ok' in restoreError &&
				restoreError.ok === false
			) {
				return restoreError as FsResult<BackupRestoreResult>;
			}
			return fail('corrupt_disk', 'Restore failed while replacing backup bodies', restoreError);
		};

		// Save the staged manifest before replacing bodies. The body store stages
		// its writes and leaves active bodies unchanged on normal failure, so this
		// ordering lets restore roll the manifest back without snapshotting old
		// blob bytes in memory.
		const manifestResult = await this.manifest.save(nextVolume, Array.from(nextNodes.values()));
		if (!manifestResult.ok) return manifestResult as FsResult<BackupRestoreResult>;

		try {
			const bodyResult = await this.bodies.replaceAll(backupBodyEntries(backup));
			if (!bodyResult.ok) {
				return rollbackManifest(bodyResult);
			}
		} catch (e) {
			return rollbackManifest(e);
		}

		// Clear undo — restore is a full disk replacement
		this.lastUndo = null;
		this.volume = nextVolume;
		this.nodes = nextNodes;
		await this.collectGarbageAfterCommit(true);

		// Notify watchers
		const allNodeIds = Array.from(this.nodes.keys());
		this.notifyChange(allNodeIds, allNodeIds, 'restore');

		const result: BackupRestoreResult = {
			...preview,
			preferences: backup.version !== 1 ? backup.preferences : undefined
		};
		return ok(result);
	}

	// --- Reinstall ---

	async reinstallOS(): Promise<FsResult<void>> {
		await this.flushPersist();
		const snapshot = this.snapshotState();
		this.nodes.clear();

		// Rebuild factory defaults by creating a fresh disk and copying its state
		const fresh = TerminalFS.createCleanDisk(this.manifest, this.bodies);
		const freshNodes = fresh.getAllNodes();
		for (const [id, node] of freshNodes) {
			this.nodes.set(id, node);
		}
		this.volume = fresh.getVolume();

		// Clear undo before the manifest commit. Blob bodies from the previous
		// disk are reclaimed only after this save succeeds.
		this.lastUndo = null;

		const persistResult = await this.persist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult;
		}
		await this.collectGarbageAfterCommit(true);

		// Notify watchers
		const allNodeIds = Array.from(this.nodes.keys());
		this.notifyChange(allNodeIds, allNodeIds, 'reinstall');

		return ok(undefined);
	}

	async deleteNode(nodeId: NodeId): Promise<FsResult<void>> {
		const node = this.nodes.get(nodeId);
		if (!node) return fail('not_found', `Node "${nodeId}" not found`);

		if (this.isProtected(node)) {
			return fail('protected_node', `Cannot delete protected node "${node.name}"`);
		}

		const toDelete = this.collectDescendants(nodeId);
		const parentId = node.parentId;

		const snapshot = this.snapshotState();
		const deletedNodes: FsNode[] = [];
		for (const id of toDelete) {
			const n = this.nodes.get(id);
			if (n) deletedNodes.push(n);
			this.nodes.delete(id);
		}

		this.lastUndo = {
			kind: 'trash',
			label: `Delete "${node.name}"`,
			undoData: { type: 'restore_nodes', nodes: deletedNodes }
		};

		await this.flushPersist();
		const persistResult = await this.persist();
		if (!persistResult.ok) {
			this.restoreState(snapshot);
			return persistResult as FsResult<void>;
		}
		await this.collectGarbageAfterCommit(true);

		this.notifyChange(toDelete, parentId ? [parentId] : [], 'delete');
		return ok(undefined);
	}

	// Matches nodes whose stored appId fingerprint equals the argument — a
	// persisted-string comparison, so it takes PersistedAppId.
	findByApp(appId: PersistedAppId, parentId?: NodeId): FsFile[] {
		const results: FsFile[] = [];
		for (const node of this.nodes.values()) {
			if (node.kind === 'file' && node.appId === appId) {
				if (parentId === undefined || node.parentId === parentId) {
					results.push(node);
				}
			}
		}
		return results;
	}

	readText(fileId: NodeId): string | null {
		const node = this.nodes.get(fileId);
		if (!node || node.kind !== 'file') return null;
		if (node.bodyRef?.kind === 'inline-text') return node.bodyRef.text;
		return null;
	}

	exists(parentId: NodeId, name: string): boolean {
		return hasSiblingConflict(name, this.siblings(parentId));
	}

	/** Flush pending writes, clean up BroadcastChannel and all watchers. */
	destroy(): void {
		if (this.persistTimer) {
			clearTimeout(this.persistTimer);
			this.persistTimer = null;
			const resolvers = this.persistResolvers.splice(0);
			this.persist()
				.then((result) => {
					for (const r of resolvers) r.resolve(result);
				})
				.catch(() => {
					const err = fail<void>('corrupt_disk', 'Persist failed during destroy');
					for (const r of resolvers) r.resolve(err);
				});
		}
		if (this.broadcastChannel) {
			this.broadcastChannel.onmessage = null;
			this.broadcastChannel.close();
			this.broadcastChannel = null;
		}
		this.watcherRegistry.clear();
	}
}
