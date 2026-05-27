import { describe, it, expect } from 'vitest';
import { TerminalFS, DOCUMENTS_ID, APPLICATIONS_ID, ROOT_ID } from './terminal-fs';
import { validateBackup, previewBackup, validateDiskForExport } from './backup';
import type { BackupPreferences } from './backup';

describe('exportBackup', () => {
	it('produces a valid v2 backup file', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.exportBackup();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.format).toBe('terminal-hd');
			expect(result.value.version).toBe(2);
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
			const textFiles = result.value.nodes.filter(
				(n) => n.kind === 'file' && n.bodyRef?.kind === 'inline-text'
			);
			expect(textFiles.length).toBeGreaterThan(0);
			expect(Object.keys(result.value.bodies).length).toBeGreaterThan(0);
		}
	});

	it('backup disk includes ownedApps', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.buyApp('tvguide');
		await fs.buyApp('recorder');
		const result = await fs.exportBackup();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.disk.ownedApps).toBeDefined();
			expect(result.value.disk.ownedApps).toContain('tvguide');
			expect(result.value.disk.ownedApps).toContain('recorder');
		}
	});

	it('backup includes preferences when provided', async () => {
		const fs = TerminalFS.createCleanDisk();
		const prefs: BackupPreferences = {
			tweaks: {
				wallpaper: 'midnight',
				accent: '#000000',
				tvGridLoop: 200,
				marqueeLoop: 50,
				tvPauseOnHover: true
			},
			timezone: 'America/New_York',
			conversations: {
				seinfeld: {
					botId: 'jerry',
					group: 'seinfeld',
					messages: [{ role: 'user', content: 'hello' }],
					updatedAt: Date.now()
				}
			},
			windows: [{ id: 'finder', x: 10, y: 20, w: 480, h: 420, z: 1 }]
		};
		const result = await fs.exportBackup(prefs);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.preferences).toBeDefined();
			expect(result.value.preferences?.tweaks?.wallpaper).toBe('midnight');
			expect(result.value.preferences?.timezone).toBe('America/New_York');
			expect(result.value.preferences?.conversations?.seinfeld).toBeDefined();
			expect(result.value.preferences?.windows).toHaveLength(1);
		}
	});

	it('backup without preferences has undefined preferences', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.exportBackup();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.preferences).toBeUndefined();
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

	it('still accepts version 1 backups', () => {
		const result = validateBackup({
			format: 'terminal-hd',
			version: 1,
			exportedAt: '2025-01-01T00:00:00.000Z',
			disk: { id: 'v', name: 'V' },
			nodes: [],
			bodies: {}
		});
		expect(result.ok).toBe(true);
	});

	it('accepts version 2 backups', () => {
		const result = validateBackup({
			format: 'terminal-hd',
			version: 2,
			exportedAt: '2025-01-01T00:00:00.000Z',
			disk: { id: 'v', name: 'V', ownedApps: ['tvguide'] },
			nodes: [],
			bodies: {},
			preferences: {
				tweaks: {
					wallpaper: 'teal',
					accent: '#f54e00',
					tvGridLoop: 400,
					marqueeLoop: 100,
					tvPauseOnHover: false
				}
			}
		});
		expect(result.ok).toBe(true);
	});

	it('rejects version 3 (future)', () => {
		const result = validateBackup({
			format: 'terminal-hd',
			version: 3,
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

	it('hasPreferences is true for v2 backup with preferences', async () => {
		const fs = TerminalFS.createCleanDisk();
		const prefs: BackupPreferences = {
			tweaks: {
				wallpaper: 'teal',
				accent: '#f54e00',
				tvGridLoop: 400,
				marqueeLoop: 100,
				tvPauseOnHover: false
			}
		};
		const exportResult = await fs.exportBackup(prefs);
		if (!exportResult.ok) throw new Error('export failed');

		const preview = previewBackup(exportResult.value);
		expect(preview.hasPreferences).toBe(true);
	});

	it('hasPreferences is false for v2 backup without preferences', async () => {
		const fs = TerminalFS.createCleanDisk();
		const exportResult = await fs.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');

		const preview = previewBackup(exportResult.value);
		expect(preview.hasPreferences).toBe(false);
	});

	it('hasPreferences is false for v1 backup', () => {
		const preview = previewBackup({
			format: 'terminal-hd',
			version: 1,
			exportedAt: '2025-01-01T00:00:00.000Z',
			disk: { id: 'v', name: 'V' },
			nodes: [],
			bodies: {}
		});
		expect(preview.hasPreferences).toBe(false);
	});
});

describe('restoreBackup', () => {
	it('restores disk from backup', async () => {
		const fs = TerminalFS.createCleanDisk();

		const exportResult = await fs.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');

		await fs.createTextFile(DOCUMENTS_ID, 'will-vanish.txt', 'bye');

		const restoreResult = await fs.restoreBackup(exportResult.value);
		expect(restoreResult.ok).toBe(true);

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

		await fs.createTextFile(DOCUMENTS_ID, 'extra1.txt', 'x');
		await fs.createTextFile(DOCUMENTS_ID, 'extra2.txt', 'y');

		await fs.restoreBackup(exportResult.value);

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

	it('restores ownedApps to the volume', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.buyApp('tvguide');
		await fs.buyApp('recorder');

		const exportResult = await fs.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');

		const freshFs = TerminalFS.createCleanDisk();
		expect(freshFs.getVolume().ownedApps ?? []).toHaveLength(0);

		const restoreResult = await freshFs.restoreBackup(exportResult.value);
		expect(restoreResult.ok).toBe(true);
		expect(freshFs.getVolume().ownedApps).toContain('tvguide');
		expect(freshFs.getVolume().ownedApps).toContain('recorder');
	});

	it('restoring v2 backup without ownedApps clears existing purchases', async () => {
		const target = TerminalFS.createCleanDisk();
		await target.buyApp('tvguide');
		expect(target.getVolume().ownedApps).toContain('tvguide');

		const source = TerminalFS.createCleanDisk();
		const exportResult = await source.exportBackup();
		if (!exportResult.ok) throw new Error('export failed');

		await target.restoreBackup(exportResult.value);
		expect(target.getVolume().ownedApps).toEqual([]);
	});

	it('returns preferences so caller can apply them', async () => {
		const fs = TerminalFS.createCleanDisk();
		const prefs: BackupPreferences = {
			tweaks: {
				wallpaper: 'midnight',
				accent: '#222',
				tvGridLoop: 100,
				marqueeLoop: 30,
				tvPauseOnHover: true
			},
			timezone: 'Europe/Berlin',
			conversations: {
				test: {
					botId: 'bot1',
					group: 'test',
					messages: [{ role: 'user', content: 'hi' }],
					updatedAt: 1000
				}
			},
			windows: [{ id: 'finder', x: 0, y: 0, w: 480, h: 420, z: 1 }]
		};
		const exportResult = await fs.exportBackup(prefs);
		if (!exportResult.ok) throw new Error('export failed');

		const freshFs = TerminalFS.createCleanDisk();
		const restoreResult = await freshFs.restoreBackup(exportResult.value);
		expect(restoreResult.ok).toBe(true);
		if (restoreResult.ok) {
			expect(restoreResult.value.preferences).toBeDefined();
			expect(restoreResult.value.preferences?.tweaks?.wallpaper).toBe('midnight');
			expect(restoreResult.value.preferences?.timezone).toBe('Europe/Berlin');
			expect(restoreResult.value.preferences?.conversations?.test.botId).toBe('bot1');
			expect(restoreResult.value.preferences?.windows).toHaveLength(1);
		}
	});

	it('restoring v1 backup works and returns no preferences', async () => {
		const fs = TerminalFS.createCleanDisk();
		const v1Backup = {
			format: 'terminal-hd' as const,
			version: 1 as const,
			exportedAt: new Date().toISOString(),
			disk: { id: 'volume_terminal_hd', name: 'Terminal HD' },
			nodes: Array.from(fs.getAllNodes().values()).filter((n) => !n.flags?.hidden),
			bodies: {} as Record<string, string>
		};

		const freshFs = TerminalFS.createCleanDisk();
		const result = await freshFs.restoreBackup(v1Backup);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.preferences).toBeUndefined();
		}
	});

	it('restoring v2 backup with missing preferences uses undefined', async () => {
		const fs = TerminalFS.createCleanDisk();
		const exportResult = await fs.exportBackup(); // no preferences passed
		if (!exportResult.ok) throw new Error('export failed');

		const freshFs = TerminalFS.createCleanDisk();
		const result = await freshFs.restoreBackup(exportResult.value);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.preferences).toBeUndefined();
		}
	});

	it('round-trip preserves ownedApps and node count', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.buyApp('tvguide');
		await fs.createTextFile(DOCUMENTS_ID, 'round-trip.txt', 'content');

		const exported = await fs.exportBackup({
			tweaks: {
				wallpaper: 'pink',
				accent: '#ff0000',
				tvGridLoop: 300,
				marqueeLoop: 80,
				tvPauseOnHover: false
			}
		});
		if (!exported.ok) throw new Error('export failed');

		const freshFs = TerminalFS.createCleanDisk();
		await freshFs.restoreBackup(exported.value);

		const reExported = await freshFs.exportBackup({
			tweaks: {
				wallpaper: 'pink',
				accent: '#ff0000',
				tvGridLoop: 300,
				marqueeLoop: 80,
				tvPauseOnHover: false
			}
		});
		if (!reExported.ok) throw new Error('re-export failed');

		expect(reExported.value.nodes.length).toBe(exported.value.nodes.length);
		expect(reExported.value.disk.ownedApps).toEqual(exported.value.disk.ownedApps);
		expect(reExported.value.preferences?.tweaks?.wallpaper).toBe('pink');
	});
});

describe('reinstallOS', () => {
	it('rebuilds factory disk', async () => {
		const fs = TerminalFS.createCleanDisk();

		await fs.createTextFile(DOCUMENTS_ID, 'my-file.txt', 'custom content');

		const result = await fs.reinstallOS();
		expect(result.ok).toBe(true);

		const docsResult = await fs.listFolder(DOCUMENTS_ID);
		if (docsResult.ok) {
			const customFile = docsResult.value.find((n) => n.name === 'my-file.txt');
			expect(customFile).toBeUndefined();
		}
	});

	it('preserves system folders', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.reinstallOS();

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
			expect(names).toContain('My Shelf.app');
			expect(names).toContain('TextEdit.app');
			expect(names).not.toContain('TV Guide.app');
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
