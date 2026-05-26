import { describe, it, expect } from 'vitest';
import { TerminalFS, DOCUMENTS_ID, APPLICATIONS_ID, ROOT_ID } from './terminal-fs';
import { buildBackup, validateBackup, previewBackup, validateDiskForExport } from './backup';

describe('exportBackup', () => {
	it('produces a valid backup file', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.exportBackup();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.format).toBe('terminal-hd');
			expect(result.value.version).toBe(1);
			expect(result.value.disk.name).toBe('Terminal HD');
			expect(result.value.nodes.length).toBeGreaterThan(0);
		}
	});

	it('backup file validates', async () => {
		const fs = TerminalFS.createCleanDisk();
		const exportResult = await fs.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');

		const validationResult = validateBackup(exportResult.value);
		expect(validationResult.ok).toBe(true);
	});

	it('backup does not include hidden nodes', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.exportBackup();
		if (result.ok) {
			const hiddenNodes = result.value.nodes.filter(
				(n: { flags?: { hidden?: boolean } }) => n.flags?.hidden
			);
			expect(hiddenNodes.length).toBe(0);
		}
	});

	it('backup includes inline text bodies', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.exportBackup();
		if (result.ok) {
			// README.TXT and Pricing.txt should have their bodies in the bodies map
			const textFiles = result.value.nodes.filter(
				(n) => n.kind === 'file' && n.bodyRef?.kind === 'inline-text'
			);
			expect(textFiles.length).toBeGreaterThan(0);
			expect(Object.keys(result.value.bodies).length).toBeGreaterThan(0);
		}
	});
});

describe('validateBackup', () => {
	it('rejects invalid data', () => {
		const result = validateBackup({ foo: 'bar' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('invalid_backup');
		}
	});

	it('rejects wrong format', () => {
		const result = validateBackup({
			format: 'wrong',
			version: 1,
			exportedAt: '',
			disk: { id: '', name: '' },
			nodes: [],
			bodies: {}
		});
		expect(result.ok).toBe(false);
	});

	it('rejects wrong version', () => {
		const result = validateBackup({
			format: 'terminal-hd',
			version: 2,
			exportedAt: '',
			disk: { id: '', name: '' },
			nodes: [],
			bodies: {}
		});
		expect(result.ok).toBe(false);
	});
});

describe('previewBackup', () => {
	it('counts files, folders, aliases, apps', async () => {
		const fs = TerminalFS.createCleanDisk();
		const exportResult = await fs.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');

		const preview = previewBackup(exportResult.value);
		expect(preview.diskName).toBe('Terminal HD');
		expect(preview.fileCount).toBeGreaterThan(0);
		expect(preview.folderCount).toBeGreaterThan(0);
		expect(preview.appCount).toBeGreaterThan(0);
		expect(preview.totalNodes).toBeGreaterThan(0);
	});
});

describe('restoreBackup', () => {
	it('restores disk from backup', async () => {
		const fs = TerminalFS.createCleanDisk();

		// Export
		const exportResult = await fs.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');

		// Create a file, then restore (the file should disappear)
		await fs.createTextFile(DOCUMENTS_ID, 'will-vanish.txt', 'bye');

		// Restore
		const restoreResult = await fs.restoreBackup(exportResult.value);
		expect(restoreResult.ok).toBe(true);

		// The file should be gone
		const docsResult = await fs.listFolder(DOCUMENTS_ID);
		if (docsResult.ok) {
			const vanished = docsResult.value.find((n) => n.name === 'will-vanish.txt');
			expect(vanished).toBeUndefined();
		}
	});

	it('restored disk matches exported state', async () => {
		const fs = TerminalFS.createCleanDisk();

		const exportResult = await fs.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');
		const originalNodeCount = exportResult.value.nodes.length;

		// Add some files
		await fs.createTextFile(DOCUMENTS_ID, 'extra1.txt', 'x');
		await fs.createTextFile(DOCUMENTS_ID, 'extra2.txt', 'y');

		// Restore
		await fs.restoreBackup(exportResult.value);

		// Node count should match original
		expect(fs.getAllNodes().size).toBe(originalNodeCount);
	});

	it('rejects invalid backup data', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.restoreBackup({ bad: 'data' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('invalid_backup');
		}
	});

	it('returns preview on success', async () => {
		const fs = TerminalFS.createCleanDisk();
		const exportResult = await fs.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');

		const restoreResult = await fs.restoreBackup(exportResult.value);
		expect(restoreResult.ok).toBe(true);
		if (restoreResult.ok) {
			expect(restoreResult.value.diskName).toBe('Terminal HD');
			expect(restoreResult.value.totalNodes).toBeGreaterThan(0);
		}
	});
});

describe('reinstallOS', () => {
	it('rebuilds factory disk', async () => {
		const fs = TerminalFS.createCleanDisk();

		// Add custom files
		await fs.createTextFile(DOCUMENTS_ID, 'my-file.txt', 'custom content');

		// Reinstall
		const result = await fs.reinstallOS();
		expect(result.ok).toBe(true);

		// Custom file should be gone
		const docsResult = await fs.listFolder(DOCUMENTS_ID);
		if (docsResult.ok) {
			const customFile = docsResult.value.find((n) => n.name === 'my-file.txt');
			expect(customFile).toBeUndefined();
		}
	});

	it('preserves system folders', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.reinstallOS();

		// System folders should exist
		const rootResult = await fs.listFolder(ROOT_ID);
		expect(rootResult.ok).toBe(true);
		if (rootResult.ok) {
			const names = rootResult.value.map((n) => n.name);
			expect(names).toContain('Applications');
			expect(names).toContain('Documents');
			expect(names).toContain('Desktop');
			expect(names).toContain('System');
			expect(names).toContain('Recordings');
			expect(names).toContain('Trash');
		}
	});

	it('reinstalls default apps', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.reinstallOS();

		const appsResult = await fs.listFolder(APPLICATIONS_ID);
		expect(appsResult.ok).toBe(true);
		if (appsResult.ok) {
			const names = appsResult.value.map((n) => n.name);
			expect(names).toContain('TV Guide.app');
			expect(names).toContain('Software Shop.app');
		}
	});
});

describe('validateDiskForExport', () => {
	it('passes for clean disk', () => {
		const fs = TerminalFS.createCleanDisk();
		const result = validateDiskForExport(fs.getVolume(), fs.getAllNodes());
		expect(result.ok).toBe(true);
	});

	it('fails for empty nodes', () => {
		const result = validateDiskForExport(
			{ id: 'v', name: 'V', kind: 'local', rootNodeId: 'r' },
			new Map()
		);
		expect(result.ok).toBe(false);
	});
});
