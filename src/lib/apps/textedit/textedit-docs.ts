import { readFile, writeFile, createFile, findByApp, exists, DOCS_ID } from '$lib/os/filesystem';
import type { FSFile } from '$lib/os/filesystem';

export function getDoc(id: string): FSFile | null {
	return readFile(id);
}

export function saveDoc(id: string, data: string): void {
	writeFile(id, data);
}

export function listDocs(): FSFile[] {
	return findByApp('textedit');
}

export function createDoc(name?: string): FSFile {
	const base = name || 'Untitled';
	const ext = '.txt';
	let finalName = `${base}${ext}`;

	if (exists(DOCS_ID, finalName)) {
		let i = 2;
		while (exists(DOCS_ID, `${base} ${i}${ext}`)) i++;
		finalName = `${base} ${i}${ext}`;
	}

	return createFile(DOCS_ID, finalName, 'textedit', '');
}

/**
 * Look up a textedit file in Documents by name.
 * Returns the filesystem node ID, or null if not found.
 */
export function findDocByName(name: string): FSFile | null {
	const files = findByApp('textedit', DOCS_ID);
	return files.find((f) => f.name === name) ?? null;
}
