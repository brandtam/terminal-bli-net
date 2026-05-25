const STORAGE_KEY = 'terminal.fs';

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

export const ROOT_ID = 'root';
export const SYSTEM_ID = 'system';
export const APPS_ID = 'applications';
export const DOCS_ID = 'documents';
export const RECORDINGS_ID = 'recordings';
export const TRASH_ID = 'trash';
export const DESKTOP_ID = 'desktop';

function uid(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function seed(): Record<string, FSNode> {
	const now = Date.now();
	const f = (id: string, name: string, parentId: string | null): FSFolder => ({
		id,
		name,
		type: 'folder',
		parentId,
		createdAt: now,
		updatedAt: now
	});
	const store: Record<string, FSNode> = {
		[ROOT_ID]: f(ROOT_ID, 'Terminal HD', null),
		[SYSTEM_ID]: f(SYSTEM_ID, 'System', ROOT_ID),
		[APPS_ID]: f(APPS_ID, 'Applications', ROOT_ID),
		[DOCS_ID]: f(DOCS_ID, 'Documents', ROOT_ID),
		[RECORDINGS_ID]: f(RECORDINGS_ID, 'Recordings', ROOT_ID),
		[TRASH_ID]: f(TRASH_ID, 'Trash', ROOT_ID),
		[DESKTOP_ID]: f(DESKTOP_ID, 'Desktop', ROOT_ID)
	};
	return store;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let _cache: Record<string, FSNode> | null = null;

function load(): Record<string, FSNode> {
	if (_cache) return { ..._cache };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			_cache = seed();
			return { ..._cache };
		}
		const parsed = JSON.parse(raw) as Record<string, FSNode>;
		if (!parsed[ROOT_ID]) {
			_cache = seed();
			return { ..._cache };
		}
		_cache = parsed;
		return { ..._cache };
	} catch {
		_cache = seed();
		return { ..._cache };
	}
}

let _changeListeners: (() => void)[] = [];

export function onFsChange(fn: () => void): () => void {
	_changeListeners.push(fn);
	return () => {
		_changeListeners = _changeListeners.filter((l) => l !== fn);
	};
}

function save(store: Record<string, FSNode>): void {
	_cache = store;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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
	// Collect descendants for folders
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
