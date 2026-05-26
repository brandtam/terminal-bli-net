import { describe, it, expect } from 'vitest';
import { InMemoryManifestStore, InMemoryBodyStore } from './storage-types';
import type { ManifestStore } from './storage-types';
import { TerminalFS, DOCUMENTS_ID } from '../terminal-fs';

describe('persistence', () => {
	it('persists manifest after createFolder', async () => {
		const manifest = new InMemoryManifestStore();
		const bodies = new InMemoryBodyStore();
		const fs = TerminalFS.createCleanDisk(manifest, bodies);

		await fs.createFolder(DOCUMENTS_ID, 'Test Folder');

		// Load a new FS from the same manifest
		const fs2 = await TerminalFS.open(manifest, bodies);
		const result = await fs2.listFolder(DOCUMENTS_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const names = result.value.map((n) => n.name);
			expect(names).toContain('Test Folder');
		}
	});

	it('persists manifest after createTextFile', async () => {
		const manifest = new InMemoryManifestStore();
		const fs = TerminalFS.createCleanDisk(manifest);

		await fs.createTextFile(DOCUMENTS_ID, 'hello.txt', 'Hello');

		const fs2 = await TerminalFS.open(manifest);
		const result = await fs2.listFolder(DOCUMENTS_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const names = result.value.map((n) => n.name);
			expect(names).toContain('hello.txt');
		}
	});

	it('open returns existing disk when manifest has data', async () => {
		const manifest = new InMemoryManifestStore();
		const fs1 = TerminalFS.createCleanDisk(manifest);
		await fs1.createFolder(DOCUMENTS_ID, 'My Folder');

		const fs2 = await TerminalFS.open(manifest);
		const result = await fs2.listFolder(DOCUMENTS_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.some((n) => n.name === 'My Folder')).toBe(true);
		}
	});

	it('open creates clean disk when manifest is empty', async () => {
		const manifest = new InMemoryManifestStore();
		const fs = await TerminalFS.open(manifest);

		const vol = fs.getVolume();
		expect(vol.name).toBe('Terminal HD');
	});

	it('quota failure returns quota_exceeded error', async () => {
		const failStore: ManifestStore = {
			load: async () => null,
			save: async () => ({
				ok: false as const,
				error: { code: 'quota_exceeded' as const, message: 'Full' }
			}),
			clear: async () => {}
		};

		const fs = TerminalFS.createCleanDisk(failStore);
		const result = await fs.createFolder(DOCUMENTS_ID, 'Will Fail');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('quota_exceeded');
		}
	});
});

describe('disk usage', () => {
	it('reports node counts', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.getDiskUsage();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.nodeCount).toBeGreaterThan(0);
			expect(result.value.folderCount).toBeGreaterThan(0);
			expect(result.value.fileCount).toBeGreaterThan(0);
		}
	});

	it('includes inline text bytes', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.getDiskUsage();
		expect(result.ok).toBe(true);
		if (result.ok) {
			// README.TXT and Pricing.txt have inline content
			expect(result.value.inlineTextBytes).toBeGreaterThan(0);
		}
	});
});

describe('body store', () => {
	it('round-trips a body', async () => {
		const bodies = new InMemoryBodyStore();
		const fs = TerminalFS.createCleanDisk(undefined, bodies);

		const data = new TextEncoder().encode('Hello World').buffer;
		const writeResult = await fs.writeBody('body-1', data);
		expect(writeResult.ok).toBe(true);

		const readResult = await fs.readBody('body-1');
		expect(readResult.ok).toBe(true);
		if (readResult.ok) {
			const text = new TextDecoder().decode(readResult.value);
			expect(text).toBe('Hello World');
		}
	});

	it('returns not_found for missing body', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.readBody('nonexistent');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});
