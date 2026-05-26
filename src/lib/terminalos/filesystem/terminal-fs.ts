import type {
	NodeId,
	BodyId,
	AppId,
	FileType,
	FsNode,
	FsFolder,
	FsFile,
	FsAlias,
	FsResult,
	TerminalVolume
} from './types';
import { ok, fail } from './errors';
import { generateUniqueId, hasSiblingConflict } from './names';
import { derivePath } from './paths';
import { resolveAlias as resolveAliasTarget, buildFingerprint } from './aliases';
import { getDefaultInstalledApps, getDesktopAliasApps, getAppDef } from '../apps/app-library';
import { findAppFile } from '../apps/software-shop';
import type { UndoRecord } from './operations';
import { buildBackup, validateBackup, previewBackup, validateDiskForExport } from './backup';
import type { BackupFile, BackupPreview } from './backup';
import type { ManifestStore, BodyStore } from './storage/storage-types';
import { InMemoryManifestStore, InMemoryBodyStore } from './storage/storage-types';
import { computeDiskUsage } from './usage';
import type { DiskUsage } from './usage';
import { WatcherRegistry } from './watchers';
import type { FsChangeEvent, FsWatchCallback } from './watchers';

// Well-known IDs
export const ROOT_ID: NodeId = 'root_terminal_hd';
export const APPLICATIONS_ID: NodeId = 'folder_applications';
export const DOCUMENTS_ID: NodeId = 'folder_documents';
export const DESKTOP_ID: NodeId = 'folder_desktop';
export const SYSTEM_ID: NodeId = 'folder_system';
export const RECORDINGS_ID: NodeId = 'folder_recordings';
export const TRASH_ID: NodeId = 'folder_trash';

const VOLUME_ID = 'volume_terminal_hd';

const README_CONTENT = `README.TXT — Terminal v1.0

Terminal is a desktop OS that lives in a browser tab. Apps run inside it.
You drag windows. You open the menu bar. You change the timezone by clicking the clock.
The whole thing is meant to feel like a computer from 1995 that someone restored for you.

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

/** Apps that exist as concepts (shell, folder) but not as installable file nodes. */
const NON_FILE_APPS = new Set(['finder', 'trash']);

/** System apps that go in /System instead of /Applications. */
const SYSTEM_FOLDER_APPS = new Set(['system-prefs', 'about-terminal']);

/** IDs of system-folder apps that are always seeded regardless of defaultInstalled. */
const SYSTEM_FOLDER_APP_IDS = ['system-prefs', 'about-terminal'];

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

	private constructor(
		volume: TerminalVolume,
		nodes: Map<NodeId, FsNode>,
		manifest: ManifestStore,
		bodies: BodyStore
	) {
		this.volume = volume;
		this.nodes = nodes;
		this.manifest = manifest;
		this.bodies = bodies;

		// Set up cross-tab notifications (browser only)
		if (typeof BroadcastChannel !== 'undefined') {
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

	private async reloadFromManifest(): Promise<void> {
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

		// 1. Volume
		const volume: TerminalVolume = {
			id: VOLUME_ID,
			name: 'Terminal HD',
			kind: 'local',
			rootNodeId: ROOT_ID
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

		// 4. Seed app file nodes
		//    - defaultInstalled apps go into /Applications
		//    - system-folder apps (system-prefs, about-terminal) always go into /System
		//    - non-file apps (finder, trash) are never created as files
		const appsToSeed = [
			...getDefaultInstalledApps(),
			// System-folder apps aren't defaultInstalled (they don't go in /Applications)
			// but they always get seeded into /System
			...SYSTEM_FOLDER_APP_IDS.map((id) => getAppDef(id)).filter(Boolean)
		] as import('../apps/app-types').TerminalAppDefinition[];

		const appFileIds = new Map<string, NodeId>(); // appId -> file nodeId
		const seenAppIds = new Set<string>();

		for (const appDef of appsToSeed) {
			if (NON_FILE_APPS.has(appDef.id)) continue;
			if (seenAppIds.has(appDef.id)) continue;
			seenAppIds.add(appDef.id);

			const parentId = SYSTEM_FOLDER_APPS.has(appDef.id) ? SYSTEM_ID : APPLICATIONS_ID;
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

		return new TerminalFS(volume, nodes, manifestStore, bodyStore);
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
		this.nodes.set(nodeId, folder);

		this.lastUndo = {
			kind: 'create_folder',
			label: `Create folder "${name}"`,
			undoData: { type: 'delete_node', nodeId }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsFolder>;

		this.notifyChange([nodeId], [parentId], 'create_folder');
		return ok(folder);
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
		this.nodes.set(nodeId, file);

		this.lastUndo = {
			kind: 'create_file',
			label: `Create file "${name}"`,
			undoData: { type: 'delete_node', nodeId }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsFile>;

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
		this.nodes.set(nodeId, file);

		this.lastUndo = {
			kind: 'create_file',
			label: `Create file "${name}"`,
			undoData: { type: 'delete_node', nodeId }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsFile>;

		this.notifyChange([nodeId], [parentId], 'create_file');
		return ok(file);
	}

	async writeText(fileId: NodeId, text: string): Promise<FsResult<FsFile>> {
		const node = this.nodes.get(fileId);
		if (!node) return fail('not_found', `Node "${fileId}" not found`);
		if (node.kind !== 'file') return fail('not_found', `Node "${fileId}" is not a file`);

		const updated: FsFile = {
			...node,
			bodyRef: { kind: 'inline-text', text },
			updatedAt: Date.now()
		};
		this.nodes.set(fileId, updated);

		// No undo for writes — text editors handle their own undo
		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsFile>;

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
		this.nodes.set(nodeId, updated);

		this.lastUndo = {
			kind: 'rename',
			label: `Rename "${previousName}" to "${newName}"`,
			undoData: { type: 'rename_back', nodeId, previousName }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsNode>;

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
		this.nodes.set(nodeId, updated);

		this.lastUndo = {
			kind: 'move',
			label: `Move "${node.name}"`,
			undoData: { type: 'move_back', nodeId, previousParentId }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsNode>;

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
		const newIds: NodeId[] = [];
		for (const n of newNodes) {
			this.nodes.set(n.id, n);
			newIds.push(n.id);
		}

		this.lastUndo = {
			kind: 'duplicate',
			label: `Duplicate "${node.name}"`,
			undoData: { type: 'delete_nodes', nodeIds: newIds }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsNode>;

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
		this.nodes.set(nodeId, updated);

		this.lastUndo = {
			kind: 'trash',
			label: `Trash "${node.name}"`,
			undoData: { type: 'move_back', nodeId, previousParentId }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsNode>;

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

		for (const id of trashChildren) {
			this.nodes.delete(id);
		}

		// Clear undo — emptyTrash is destructive and irreversible
		this.lastUndo = null;

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<{ deletedCount: number }>;

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
		this.nodes.set(aliasId, alias);

		this.lastUndo = {
			kind: 'create_alias',
			label: `Create alias "${aliasName}"`,
			undoData: { type: 'delete_node', nodeId: aliasId }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsAlias>;

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
				this.nodes.set(aliasId, result.alias);
				await this.persist();
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

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<string>;

		this.notifyChange(affectedNodeIds, affectedFolderIds, 'undo');
		return ok(label);
	}

	async getUndoLabel(): Promise<FsResult<string>> {
		if (!this.lastUndo) return fail('not_found', 'Nothing to undo');
		return ok(this.lastUndo.label);
	}

	// --- App install/uninstall ---

	async installApp(appId: AppId): Promise<FsResult<FsFile>> {
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

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<FsFile>;

		this.notifyChange([fileId], [APPLICATIONS_ID, DESKTOP_ID], 'install_app');

		return ok(file);
	}

	async uninstallApp(appId: AppId): Promise<FsResult<{ removedFiles: number }>> {
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

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<{ removedFiles: number }>;

		this.notifyChange(
			[appFile.id, ...removedAliasIds],
			[APPLICATIONS_ID, DESKTOP_ID],
			'uninstall_app'
		);

		// Clear undo since uninstall involves multiple nodes
		this.lastUndo = null;

		return ok({ removedFiles: 1 + removedAliasIds.length });
	}

	async isAppInstalled(appId: AppId): Promise<FsResult<boolean>> {
		const installed = findAppFile(appId, this.nodes) !== undefined;
		return ok(installed);
	}

	// --- Body storage ---

	async readBody(bodyId: BodyId): Promise<FsResult<ArrayBuffer>> {
		const data = await this.bodies.read(bodyId);
		if (!data) return fail('not_found', `Body "${bodyId}" not found`);
		return ok(data);
	}

	async writeBody(
		bodyId: BodyId,
		data: ArrayBuffer,
		contentType?: string
	): Promise<FsResult<void>> {
		return this.bodies.write(bodyId, data, contentType);
	}

	async deleteBody(bodyId: BodyId): Promise<FsResult<void>> {
		await this.bodies.delete(bodyId);
		return ok(undefined);
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

	async exportBackup(): Promise<FsResult<BackupFile>> {
		const validation = validateDiskForExport(this.volume, this.nodes);
		if (!validation.ok) return validation as FsResult<BackupFile>;

		const backup = buildBackup(this.volume, this.nodes);
		return ok(backup);
	}

	async validateBackup(data: unknown): Promise<FsResult<BackupPreview>> {
		const validated = validateBackup(data);
		if (!validated.ok) return validated as FsResult<BackupPreview>;

		const preview = previewBackup(validated.value);
		return ok(preview);
	}

	async restoreBackup(data: unknown): Promise<FsResult<BackupPreview>> {
		const validated = validateBackup(data);
		if (!validated.ok) return validated as FsResult<BackupPreview>;

		const backup = validated.value;
		const preview = previewBackup(backup);

		// Replace current disk with backup contents
		this.nodes.clear();
		for (const node of backup.nodes) {
			this.nodes.set(node.id, node as FsNode);
		}

		// Persist the restored state
		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<BackupPreview>;

		// Clear undo — restore is a full disk replacement
		this.lastUndo = null;

		// Notify watchers
		const allNodeIds = Array.from(this.nodes.keys());
		this.notifyChange(allNodeIds, allNodeIds, 'restore');

		return ok(preview);
	}

	// --- Reinstall ---

	async reinstallOS(): Promise<FsResult<void>> {
		// Wipe everything
		this.nodes.clear();
		await this.bodies.clear();

		// Rebuild factory defaults by creating a fresh disk and copying its state
		const fresh = TerminalFS.createCleanDisk(this.manifest, this.bodies);
		const freshNodes = fresh.getAllNodes();
		for (const [id, node] of freshNodes) {
			this.nodes.set(id, node);
		}
		this.volume = fresh.getVolume();

		// Persist
		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult;

		// Clear undo
		this.lastUndo = null;

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

		for (const id of toDelete) {
			this.nodes.delete(id);
		}

		this.lastUndo = {
			kind: 'trash',
			label: `Delete "${node.name}"`,
			undoData: { type: 'delete_node', nodeId }
		};

		const persistResult = await this.persist();
		if (!persistResult.ok) return persistResult as FsResult<void>;

		this.notifyChange(toDelete, parentId ? [parentId] : [], 'delete');
		return ok(undefined);
	}

	findByApp(appId: AppId, parentId?: NodeId): FsFile[] {
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

	/** Clean up BroadcastChannel and all watchers. */
	destroy(): void {
		this.broadcastChannel?.close();
		this.broadcastChannel = null;
		this.watcherRegistry.clear();
	}
}
