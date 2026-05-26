/**
 * Compatibility shim: exposes the original synchronous filesystem API
 * while storing data in the TerminalFS manifest format.
 *
 * Reads and mutations operate on an in-memory Record<string, FSNode> cache.
 * Persistence targets the `terminalos.manifest` localStorage key in the
 * same { volume, nodes } shape that TerminalFS.open() / LocalStorageManifestStore
 * expects. This means both the compat layer and any future TerminalFS-based
 * code see the same data.
 *
 * The old filesystem-seed.ts is replaced by TerminalFS.createCleanDisk(),
 * which produces the full default disk including app files and desktop aliases.
 */

import {
	TerminalFS,
	ROOT_ID as TFS_ROOT_ID,
	APPLICATIONS_ID as TFS_APPS_ID,
	DOCUMENTS_ID as TFS_DOCS_ID,
	DESKTOP_ID as TFS_DESKTOP_ID,
	SYSTEM_ID as TFS_SYSTEM_ID,
	RECORDINGS_ID as TFS_RECORDINGS_ID,
	TRASH_ID as TFS_TRASH_ID
} from '$lib/terminalos';
import type { FsNode, TerminalVolume } from '$lib/terminalos';

// ---------------------------------------------------------------------------
// Compat types — identical signatures to the old API
// ---------------------------------------------------------------------------

export interface FSFolder {
	id: string;
	name: string;
	type: 'folder';
	parentId: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface FSFile {
	id: string;
	name: string;
	type: 'file';
	parentId: string;
	appId: string;
	data: string;
	createdAt: number;
	updatedAt: number;
}

export interface FSAlias {
	id: string;
	name: string;
	type: 'alias';
	parentId: string;
	targetId: string;
	createdAt: number;
	updatedAt: number;
}

export type FSNode = FSFolder | FSFile | FSAlias;

// ---------------------------------------------------------------------------
// Well-known IDs (re-export from TerminalFS so consumers keep the same names)
// ---------------------------------------------------------------------------

export const ROOT_ID = TFS_ROOT_ID;
export const SYSTEM_ID = TFS_SYSTEM_ID;
export const APPS_ID = TFS_APPS_ID;
export const DOCS_ID = TFS_DOCS_ID;
export const RECORDINGS_ID = TFS_RECORDINGS_ID;
export const TRASH_ID = TFS_TRASH_ID;
export const DESKTOP_ID = TFS_DESKTOP_ID;

// ---------------------------------------------------------------------------
// Conversion helpers: FsNode (new) <-> FSNode (old)
// ---------------------------------------------------------------------------

function toOldNode(node: FsNode): FSNode {
	switch (node.kind) {
		case 'folder':
			return {
				id: node.id,
				name: node.name,
				type: 'folder',
				parentId: node.parentId,
				createdAt: node.createdAt,
				updatedAt: node.updatedAt
			};
		case 'file': {
			const text = node.bodyRef?.kind === 'inline-text' ? node.bodyRef.text : '';
			return {
				id: node.id,
				name: node.name,
				type: 'file',
				parentId: node.parentId,
				appId: node.appId ?? node.opensWith ?? '',
				data: text,
				createdAt: node.createdAt,
				updatedAt: node.updatedAt
			};
		}
		case 'alias':
			return {
				id: node.id,
				name: node.name,
				type: 'alias',
				parentId: node.parentId,
				targetId: node.target.nodeId,
				createdAt: node.createdAt,
				updatedAt: node.updatedAt
			};
	}
}

/** Default volume definition for the compat layer. */
const COMPAT_VOLUME: TerminalVolume = {
	id: 'volume_terminal_hd',
	name: 'Terminal HD',
	kind: 'local',
	rootNodeId: ROOT_ID
};

function toNewNode(node: FSNode): FsNode {
	switch (node.type) {
		case 'folder':
			return {
				id: node.id,
				volumeId: COMPAT_VOLUME.id,
				kind: 'folder',
				parentId: node.parentId,
				name: node.name,
				createdAt: node.createdAt,
				updatedAt: node.updatedAt
			};
		case 'file':
			return {
				id: node.id,
				volumeId: COMPAT_VOLUME.id,
				kind: 'file',
				parentId: node.parentId,
				name: node.name,
				fileType: inferFileType(node.appId, node.parentId),
				opensWith: node.appId || undefined,
				appId: node.appId || undefined,
				bodyRef: node.data ? { kind: 'inline-text', text: node.data } : undefined,
				createdAt: node.createdAt,
				updatedAt: node.updatedAt
			};
		case 'alias':
			return {
				id: node.id,
				volumeId: COMPAT_VOLUME.id,
				kind: 'alias',
				parentId: node.parentId,
				name: node.name,
				target: {
					nodeId: node.targetId,
					originalPath: '',
					originalName: node.name,
					targetKind: 'file'
				},
				createdAt: node.createdAt,
				updatedAt: node.updatedAt
			};
	}
}

function inferFileType(
	appId: string,
	parentId: string
): 'text' | 'sticky' | 'recording' | 'app' | 'data' | 'unknown' {
	if (parentId === APPS_ID || parentId === SYSTEM_ID) return 'app';
	if (!appId) return 'unknown';
	if (appId === 'textedit') return 'text';
	if (appId === 'stickies') return 'sticky';
	if (appId === 'recorder') return 'recording';
	return 'app';
}

// ---------------------------------------------------------------------------
// Storage — reads/writes the TerminalFS manifest format
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'terminalos.manifest';
const OLD_STORAGE_KEY = 'terminal.fs';

let _cache: Record<string, FSNode> | null = null;

function seed(): Record<string, FSNode> {
	const fs = TerminalFS.createCleanDisk();
	const nodes = fs.getAllNodes();
	const store: Record<string, FSNode> = {};
	for (const node of nodes.values()) {
		store[node.id] = toOldNode(node);
	}
	return store;
}

function load(): Record<string, FSNode> {
	if (_cache) return { ..._cache };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			// TerminalFS format: { volume, nodes: FsNode[] }
			if (parsed && Array.isArray(parsed.nodes) && parsed.volume) {
				const store: Record<string, FSNode> = {};
				for (const node of parsed.nodes as FsNode[]) {
					store[node.id] = toOldNode(node);
				}
				if (store[ROOT_ID]) {
					_cache = store;
					return { ..._cache };
				}
			}
		}

		// Attempt migration from old key
		const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
		if (oldRaw) {
			const oldParsed = JSON.parse(oldRaw) as Record<string, FSNode>;
			if (oldParsed && oldParsed['root']) {
				// Migrate old-format data: convert old IDs to new IDs
				const migrated = migrateOldData(oldParsed);
				_cache = migrated;
				persistSync(migrated);
				localStorage.removeItem(OLD_STORAGE_KEY);
				return { ..._cache };
			}
		}

		// No existing data — create a fresh disk
		_cache = seed();
		persistSync(_cache);
		return { ..._cache };
	} catch {
		_cache = seed();
		persistSync(_cache);
		return { ..._cache };
	}
}

/** Map old well-known IDs to new ones. */
const ID_MIGRATION_MAP: Record<string, string> = {
	root: TFS_ROOT_ID,
	system: TFS_SYSTEM_ID,
	applications: TFS_APPS_ID,
	documents: TFS_DOCS_ID,
	recordings: TFS_RECORDINGS_ID,
	trash: TFS_TRASH_ID,
	desktop: TFS_DESKTOP_ID
};

function migrateOldData(old: Record<string, FSNode>): Record<string, FSNode> {
	const migrated: Record<string, FSNode> = {};
	for (const node of Object.values(old)) {
		const newId = ID_MIGRATION_MAP[node.id] ?? node.id;
		const newParentId =
			node.parentId === null ? null : (ID_MIGRATION_MAP[node.parentId] ?? node.parentId);

		if (node.type === 'alias') {
			const alias = node as FSAlias;
			const newTargetId = ID_MIGRATION_MAP[alias.targetId] ?? alias.targetId;
			migrated[newId] = { ...alias, id: newId, parentId: newParentId!, targetId: newTargetId };
		} else if (node.type === 'file') {
			migrated[newId] = { ...node, id: newId, parentId: newParentId! };
		} else {
			migrated[newId] = { ...node, id: newId, parentId: newParentId };
		}
	}
	return migrated;
}

let _changeListeners: (() => void)[] = [];

export function onFsChange(fn: () => void): () => void {
	_changeListeners.push(fn);
	return () => {
		_changeListeners = _changeListeners.filter((l) => l !== fn);
	};
}

/** Write cache to localStorage in TerminalFS manifest format. */
function persistSync(store: Record<string, FSNode>): void {
	const nodes: FsNode[] = Object.values(store).map(toNewNode);
	const manifest = { volume: COMPAT_VOLUME, nodes };
	localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
}

function save(store: Record<string, FSNode>): void {
	_cache = store;
	persistSync(store);
	for (const fn of _changeListeners) fn();
}

export function ensureSystemFolders(): void {
	const store = load();
	const now = Date.now();
	const required: [string, string, string | null][] = [
		[ROOT_ID, 'Terminal HD', null],
		[SYSTEM_ID, 'System', ROOT_ID],
		[APPS_ID, 'Applications', ROOT_ID],
		[DOCS_ID, 'Documents', ROOT_ID],
		[RECORDINGS_ID, 'Recordings', ROOT_ID],
		[TRASH_ID, 'Trash', ROOT_ID],
		[DESKTOP_ID, 'Desktop', ROOT_ID]
	];
	let changed = false;
	for (const [id, name, parentId] of required) {
		if (!store[id]) {
			store[id] = { id, name, type: 'folder' as const, parentId, createdAt: now, updatedAt: now };
			changed = true;
		}
	}
	if (changed) save(store);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getNode(id: string): FSNode | null {
	return load()[id] ?? null;
}

export function list(parentId: string): FSNode[] {
	const store = load();
	return Object.values(store)
		.filter((n) => n.parentId === parentId)
		.sort((a, b) => {
			const aIsFolder = a.type === 'folder';
			const bIsFolder = b.type === 'folder';
			if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
}

export function getPath(id: string): string {
	const store = load();
	const parts: string[] = [];
	let current: FSNode | undefined = store[id];
	while (current) {
		parts.unshift(current.name);
		current = current.parentId ? store[current.parentId] : undefined;
	}
	return parts.join('/');
}

export function exists(parentId: string, name: string): boolean {
	return list(parentId).some((n) => n.name === name);
}

export function findByApp(appId: string, parentId?: string): FSFile[] {
	const store = load();
	return Object.values(store).filter(
		(n): n is FSFile =>
			n.type === 'file' && n.appId === appId && (parentId === undefined || n.parentId === parentId)
	);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function uid(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createFolder(parentId: string, name: string): FSFolder {
	const store = load();
	if (!store[parentId] || store[parentId].type !== 'folder') {
		throw new Error(`Parent "${parentId}" is not a folder`);
	}
	if (exists(parentId, name)) {
		throw new Error(`"${name}" already exists in this folder`);
	}
	const now = Date.now();
	const folder: FSFolder = {
		id: uid(),
		name,
		type: 'folder',
		parentId,
		createdAt: now,
		updatedAt: now
	};
	store[folder.id] = folder;
	save(store);
	return folder;
}

export function createFile(
	parentId: string,
	name: string,
	appId: string,
	data: string = ''
): FSFile {
	const store = load();
	if (!store[parentId] || store[parentId].type !== 'folder') {
		throw new Error(`Parent "${parentId}" is not a folder`);
	}
	if (exists(parentId, name)) {
		throw new Error(`"${name}" already exists in this folder`);
	}
	const now = Date.now();
	const file: FSFile = {
		id: uid(),
		name,
		type: 'file',
		parentId,
		appId,
		data,
		createdAt: now,
		updatedAt: now
	};
	store[file.id] = file;
	save(store);
	return file;
}

export function createFileWithId(
	id: string,
	parentId: string,
	name: string,
	appId: string,
	data: string = ''
): FSFile {
	const store = load();
	if (!store[parentId] || store[parentId].type !== 'folder') {
		throw new Error(`Parent "${parentId}" is not a folder`);
	}
	if (exists(parentId, name)) {
		throw new Error(`"${name}" already exists in this folder`);
	}
	const now = Date.now();
	const file: FSFile = {
		id,
		name,
		type: 'file',
		parentId,
		appId,
		data,
		createdAt: now,
		updatedAt: now
	};
	store[file.id] = file;
	save(store);
	return file;
}

export function createAlias(parentId: string, name: string, targetId: string): FSAlias {
	const store = load();
	if (!store[parentId] || store[parentId].type !== 'folder') {
		throw new Error(`Parent "${parentId}" is not a folder`);
	}
	if (exists(parentId, name)) {
		throw new Error(`"${name}" already exists in this folder`);
	}
	if (!store[targetId]) {
		throw new Error(`Target "${targetId}" not found`);
	}
	const now = Date.now();
	const alias: FSAlias = {
		id: uid(),
		name,
		type: 'alias',
		parentId,
		targetId,
		createdAt: now,
		updatedAt: now
	};
	store[alias.id] = alias;
	save(store);
	return alias;
}

export function createAliasWithId(
	id: string,
	parentId: string,
	name: string,
	targetId: string
): FSAlias {
	const store = load();
	if (!store[parentId] || store[parentId].type !== 'folder') {
		throw new Error(`Parent "${parentId}" is not a folder`);
	}
	if (exists(parentId, name)) {
		throw new Error(`"${name}" already exists in this folder`);
	}
	const now = Date.now();
	const alias: FSAlias = {
		id,
		name,
		type: 'alias',
		parentId,
		targetId,
		createdAt: now,
		updatedAt: now
	};
	store[alias.id] = alias;
	save(store);
	return alias;
}

export function resolveAlias(node: FSNode): FSFile | null {
	if (node.type !== 'alias') return null;
	const target = getNode((node as FSAlias).targetId);
	if (!target) return null;
	if (target.type === 'alias') return resolveAlias(target);
	if (target.type === 'file') return target as FSFile;
	return null;
}

export function readFile(id: string): FSFile | null {
	const node = getNode(id);
	return node?.type === 'file' ? (node as FSFile) : null;
}

export function writeFile(id: string, data: string): void {
	const store = load();
	const node = store[id];
	if (!node || node.type !== 'file') throw new Error(`"${id}" is not a file`);
	(node as FSFile).data = data;
	node.updatedAt = Date.now();
	save(store);
}

export function rename(id: string, newName: string): void {
	const store = load();
	const node = store[id];
	if (!node) throw new Error(`Node "${id}" not found`);
	if (node.parentId !== null) {
		const siblings = Object.values(store).filter(
			(n) => n.parentId === node.parentId && n.id !== id
		);
		if (siblings.some((s) => s.name === newName)) {
			throw new Error(`"${newName}" already exists in this folder`);
		}
	}
	node.name = newName;
	node.updatedAt = Date.now();
	save(store);
}

export function moveNode(id: string, newParentId: string): void {
	const store = load();
	const node = store[id];
	if (!node) throw new Error(`Node "${id}" not found`);
	const parent = store[newParentId];
	if (!parent || parent.type !== 'folder') throw new Error(`"${newParentId}" is not a folder`);
	if (exists(newParentId, node.name)) {
		throw new Error(`"${node.name}" already exists in "${parent.name}"`);
	}
	node.parentId = newParentId;
	node.updatedAt = Date.now();
	save(store);
}

export function deleteNode(id: string): void {
	const store = load();
	if (!store[id]) return;
	const toDelete = [id];
	const queue = [id];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const node of Object.values(store)) {
			if (node.parentId === current && !toDelete.includes(node.id)) {
				toDelete.push(node.id);
				queue.push(node.id);
			}
		}
	}
	for (const nid of toDelete) delete store[nid];
	save(store);
}

export function trash(id: string): void {
	moveNode(id, TRASH_ID);
}

export function emptyTrash(): void {
	const trashContents = list(TRASH_ID);
	const store = load();
	for (const node of trashContents) {
		const toDelete = [node.id];
		const queue = [node.id];
		while (queue.length > 0) {
			const current = queue.shift()!;
			for (const n of Object.values(store)) {
				if (n.parentId === current && !toDelete.includes(n.id)) {
					toDelete.push(n.id);
					queue.push(n.id);
				}
			}
		}
		for (const nid of toDelete) delete store[nid];
	}
	save(store);
}
