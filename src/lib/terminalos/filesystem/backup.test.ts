import { describe, it, expect } from 'vitest';
import { TerminalFS, DOCUMENTS_ID, APPLICATIONS_ID, ROOT_ID } from './terminal-fs';
import { validateBackup, previewBackup, validateDiskForExport } from './backup';
import type { BackupPreferences, BackupFileV3 } from './backup';

describe('exportBackup', () => {
	it('produces a valid v3 backup file', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.exportBackup();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.format).toBe('terminal-hd');
			expect(result.value.version).toBe(3);
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

	it('inline text rides in nodes, not the bodies dict', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.exportBackup();
		if (result.ok) {
			// Inline-text files still survive — their text is inside the node.
			const textFiles = result.value.nodes.filter(
				(n) => n.kind === 'file' && n.bodyRef?.kind === 'inline-text'
			);
			expect(textFiles.length).toBeGreaterThan(0);
			// In v3, bodies is the blob store (bodyId → base64), not inline text.
			// A clean disk has no blobs, so it's empty.
			expect(Object.keys(result.value.bodies).length).toBe(0);
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

describe('blob body round-trip', () => {
	it('export captures blob bytes as base64 keyed by bodyId', async () => {
		const fs = TerminalFS.createCleanDisk();
		const bytes = new TextEncoder().encode('binary clip').buffer as ArrayBuffer;
		const bodyId = 'body_test_1';
		await fs.writeBody(bodyId, bytes);

		// No public API to make a blob-backed file yet (later phase), so attach
		// the ref directly to the live node.
		const created = await fs.createFile(DOCUMENTS_ID, 'clip.webm', { fileType: 'recording' });
		if (!created.ok) throw new Error('createFile failed');
		const node = fs.getAllNodes().get(created.value.id);
		if (!node || node.kind !== 'file') throw new Error('node missing');
		node.bodyRef = { kind: 'indexeddb-blob', bodyId, size: bytes.byteLength };

		const result = await fs.exportBackup();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.version).toBe(3);
			expect(typeof result.value.bodies[bodyId]).toBe('string');
			expect(result.value.bodies[bodyId].length).toBeGreaterThan(0);
		}
	});

	it('round-trip restores blob bytes into a fresh disk', async () => {
		const fs = TerminalFS.createCleanDisk();
		const bytes = new TextEncoder().encode('binary clip').buffer as ArrayBuffer;
		const bodyId = 'body_test_1';
		await fs.writeBody(bodyId, bytes);

		const created = await fs.createFile(DOCUMENTS_ID, 'clip.webm', { fileType: 'recording' });
		if (!created.ok) throw new Error('createFile failed');
		const node = fs.getAllNodes().get(created.value.id);
		if (!node || node.kind !== 'file') throw new Error('node missing');
		node.bodyRef = { kind: 'indexeddb-blob', bodyId, size: bytes.byteLength };

		const exported = await fs.exportBackup();
		if (!exported.ok) throw new Error('export failed');

		const fresh = TerminalFS.createCleanDisk();
		const restored = await fresh.restoreBackup(exported.value);
		expect(restored.ok).toBe(true);

		const read = await fresh.readBody(bodyId);
		expect(read.ok).toBe(true);
		if (read.ok) {
			expect(new TextDecoder().decode(read.value)).toBe('binary clip');
		}

		const restoredNode = fresh.getAllNodes().get(created.value.id);
		expect(restoredNode?.kind).toBe('file');
		if (restoredNode?.kind === 'file') {
			expect(restoredNode.bodyRef?.kind).toBe('indexeddb-blob');
		}
	});

	it('restore fails loud when a referenced body is missing', async () => {
		const fs = TerminalFS.createCleanDisk();
		const fileNode = {
			id: 'node_dangling',
			volumeId: 'volume_terminal_hd',
			kind: 'file' as const,
			parentId: DOCUMENTS_ID,
			name: 'dangling.webm',
			fileType: 'recording' as const,
			bodyRef: { kind: 'indexeddb-blob' as const, bodyId: 'body_missing', size: 10 },
			createdAt: 1,
			updatedAt: 1
		};
		const backup: BackupFileV3 = {
			format: 'terminal-hd',
			version: 3,
			exportedAt: new Date().toISOString(),
			disk: { id: 'volume_terminal_hd', name: 'Terminal HD' },
			nodes: [...Array.from(fs.getAllNodes().values()).filter((n) => !n.flags?.hidden), fileNode],
			bodies: {}
		};

		const result = await fs.restoreBackup(backup);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('invalid_backup');
		}
	});

	it('restoring an older v1/v2 backup clears pre-existing blob bodies', async () => {
		const fs = TerminalFS.createCleanDisk();
		// A blob written under the current (v3) world.
		const bodyId = 'body_stale';
		await fs.writeBody(bodyId, new TextEncoder().encode('stale clip').buffer as ArrayBuffer);
		expect((await fs.readBody(bodyId)).ok).toBe(true);

		// Restore a v2 backup — predates blobs, references none. Restore is a full
		// disk replacement, so the stale blob must not survive.
		const v2Backup = {
			format: 'terminal-hd' as const,
			version: 2 as const,
			exportedAt: new Date().toISOString(),
			disk: { id: 'volume_terminal_hd', name: 'Terminal HD' },
			nodes: Array.from(fs.getAllNodes().values()).filter((n) => !n.flags?.hidden),
			bodies: {} as Record<string, string>
		};

		const result = await fs.restoreBackup(v2Backup);
		expect(result.ok).toBe(true);
		expect((await fs.readBody(bodyId)).ok).toBe(false);
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

	it('rejects v2 backup with malformed preferences', () => {
		const result = validateBackup({
			format: 'terminal-hd',
			version: 2,
			exportedAt: '2025-01-01T00:00:00.000Z',
			disk: { id: 'v', name: 'V' },
			nodes: [],
			bodies: {},
			preferences: {
				tweaks: { wallpaper: 123 }
			}
		});
		expect(result.ok).toBe(false);
	});

	it('accepts version 3 backups', () => {
		const result = validateBackup({
			format: 'terminal-hd',
			version: 3,
			exportedAt: '2025-01-01T00:00:00.000Z',
			disk: { id: 'v', name: 'V', ownedApps: ['tvguide'] },
			nodes: [],
			bodies: { body_x: 'YmluYXJ5' }
		});
		expect(result.ok).toBe(true);
	});

	it('rejects version 4 (future)', () => {
		const result = validateBackup({
			format: 'terminal-hd',
			version: 4,
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

	it('restoring v1 backup does not clear existing ownedApps', async () => {
		const target = TerminalFS.createCleanDisk();
		await target.buyApp('tvguide');

		const source = TerminalFS.createCleanDisk();
		const v1Backup = {
			format: 'terminal-hd' as const,
			version: 1 as const,
			exportedAt: new Date().toISOString(),
			disk: { id: 'volume_terminal_hd', name: 'Terminal HD' },
			nodes: Array.from(source.getAllNodes().values()).filter((n) => !n.flags?.hidden),
			bodies: {} as Record<string, string>
		};

		await target.restoreBackup(v1Backup);
		expect(target.getVolume().ownedApps).toContain('tvguide');
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
