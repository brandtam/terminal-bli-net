import { describe, it, expect } from 'vitest';
import {
	TerminalFS,
	ROOT_ID,
	APPLICATIONS_ID,
	DOCUMENTS_ID,
	DESKTOP_ID,
	SYSTEM_ID,
	RECORDINGS_ID,
	TRASH_ID
} from './terminal-fs';
import { hasSiblingConflict } from './names';
import type { FsFolder, FsFile, FsAlias } from './types';

function createDisk() {
	return TerminalFS.createCleanDisk();
}

describe('TerminalFS.createCleanDisk', () => {
	it('has required system folders', () => {
		const fs = createDisk();
		const nodes = fs.getAllNodes();

		expect(nodes.has(ROOT_ID)).toBe(true);
		expect(nodes.has(APPLICATIONS_ID)).toBe(true);
		expect(nodes.has(DOCUMENTS_ID)).toBe(true);
		expect(nodes.has(DESKTOP_ID)).toBe(true);
		expect(nodes.has(SYSTEM_ID)).toBe(true);
		expect(nodes.has(RECORDINGS_ID)).toBe(true);
		expect(nodes.has(TRASH_ID)).toBe(true);
	});

	it('system folders have correct flags', () => {
		const fs = createDisk();
		const nodes = fs.getAllNodes();

		const folderIds = [
			APPLICATIONS_ID,
			DOCUMENTS_ID,
			DESKTOP_ID,
			SYSTEM_ID,
			RECORDINGS_ID,
			TRASH_ID
		];
		for (const id of folderIds) {
			const node = nodes.get(id) as FsFolder;
			expect(node.kind).toBe('folder');
			expect(node.flags?.system).toBe(true);
			expect(node.flags?.protected).toBe(true);
		}
	});

	it('has correct volume info', () => {
		const fs = createDisk();
		const vol = fs.getVolume();

		expect(vol.id).toBe('volume_terminal_hd');
		expect(vol.name).toBe('Terminal HD');
		expect(vol.kind).toBe('local');
		expect(vol.rootNodeId).toBe(ROOT_ID);
	});

	it('default app files are installed in /Applications', async () => {
		const fs = createDisk();
		const result = await fs.listFolder(APPLICATIONS_ID);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const names = result.value.map((n) => n.name);
		expect(names).toContain('TV Guide.app');
		expect(names).toContain('chatrbot.app');
		expect(names).toContain('TextEdit.app');
		expect(names).toContain('Stickies');
		expect(names).toContain('Camera.app');
		expect(names).toContain('Stats.app');
		expect(names).toContain('DO_NOT_OPEN');
		expect(names).toContain('My Shelf.app');
	});

	it('system-prefs and about-terminal are in /System', async () => {
		const fs = createDisk();
		const result = await fs.listFolder(SYSTEM_ID);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const names = result.value.map((n) => n.name);
		expect(names).toContain('System Preferences');
		expect(names).toContain('About This Terminal');
	});

	it('non-filesystem apps are not installed as files', async () => {
		const fs = createDisk();
		const nodes = fs.getAllNodes();

		// finder and trash should NOT have file nodes anywhere
		const allFiles = Array.from(nodes.values()).filter((n): n is FsFile => n.kind === 'file');
		const finderFiles = allFiles.filter((f) => f.appId === 'finder');
		const trashFiles = allFiles.filter((f) => f.appId === 'trash');

		expect(finderFiles).toHaveLength(0);
		expect(trashFiles).toHaveLength(0);
	});

	it('desktop aliases point to correct app files', async () => {
		const fs = createDisk();
		const result = await fs.listFolder(DESKTOP_ID);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const aliases = result.value.filter((n): n is FsAlias => n.kind === 'alias');
		const aliasNames = aliases.map((a) => a.name);

		// These apps have desktopAliasByDefault: true
		expect(aliasNames).toContain('TV Guide.app');
		expect(aliasNames).toContain('My Shelf.app');
		expect(aliasNames).toContain('Stickies');
		expect(aliasNames).toContain('Camera.app');
		expect(aliasNames).toContain('Stats.app');
		expect(aliasNames).toContain('DO_NOT_OPEN');

		// Each alias should point to an existing app file with targetKind 'app'
		for (const alias of aliases) {
			expect(alias.target.targetKind).toBe('app');
			expect(fs.getAllNodes().has(alias.target.nodeId)).toBe(true);
		}
	});

	it('chatrbot has no desktop alias', async () => {
		const fs = createDisk();
		const result = await fs.listFolder(DESKTOP_ID);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const aliases = result.value.filter((n): n is FsAlias => n.kind === 'alias');
		const aliasNames = aliases.map((a) => a.name);
		expect(aliasNames).not.toContain('chatrbot.app');
	});

	it('default documents exist in /Documents', async () => {
		const fs = createDisk();
		const result = await fs.listFolder(DOCUMENTS_ID);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const names = result.value.map((n) => n.name);
		expect(names).toContain('README.TXT');
		expect(names).toContain('Pricing.txt');

		const readme = result.value.find((n) => n.name === 'README.TXT') as FsFile;
		expect(readme.kind).toBe('file');
		expect(readme.fileType).toBe('text');
		expect(readme.opensWith).toBe('textedit');
		expect(readme.bodyRef?.kind).toBe('inline-text');
		if (readme.bodyRef?.kind === 'inline-text') {
			expect(readme.bodyRef.text).toContain('Terminal is a desktop OS');
		}

		const pricing = result.value.find((n) => n.name === 'Pricing.txt') as FsFile;
		expect(pricing.kind).toBe('file');
		expect(pricing.bodyRef?.kind).toBe('inline-text');
		if (pricing.bodyRef?.kind === 'inline-text') {
			expect(pricing.bodyRef.text).toContain('BASIC');
		}
	});
});

describe('TerminalFS.listFolder', () => {
	it('returns sorted children — folders first, then alphabetical', async () => {
		const fs = createDisk();
		const result = await fs.listFolder(ROOT_ID);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const children = result.value;
		// All children of root should be folders
		for (const child of children) {
			expect(child.kind).toBe('folder');
		}

		// Check alphabetical within folders
		const names = children.map((c) => c.name);
		const sorted = [...names].sort((a, b) => a.localeCompare(b));
		expect(names).toEqual(sorted);
	});

	it('returns error for non-folder', async () => {
		const fs = createDisk();
		// Find a file node
		const nodes = fs.getAllNodes();
		const file = Array.from(nodes.values()).find((n) => n.kind === 'file');
		expect(file).toBeDefined();
		if (!file) return;

		const result = await fs.listFolder(file.id);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_folder');
		}
	});

	it('returns error for missing folder', async () => {
		const fs = createDisk();
		const result = await fs.listFolder('nonexistent_id');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});

describe('TerminalFS.getNode', () => {
	it('returns a node that exists', async () => {
		const fs = createDisk();
		const result = await fs.getNode(ROOT_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(ROOT_ID);
			expect(result.value.name).toBe('Terminal HD');
		}
	});

	it('returns not_found for missing ID', async () => {
		const fs = createDisk();
		const result = await fs.getNode('does_not_exist');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});

describe('TerminalFS.getPath', () => {
	it('derives correct path for root', async () => {
		const fs = createDisk();
		const result = await fs.getPath(ROOT_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe('Terminal HD');
		}
	});

	it('derives correct path for a document', async () => {
		const fs = createDisk();
		const docsResult = await fs.listFolder(DOCUMENTS_ID);
		expect(docsResult.ok).toBe(true);
		if (!docsResult.ok) return;

		const readme = docsResult.value.find((n) => n.name === 'README.TXT');
		expect(readme).toBeDefined();
		if (!readme) return;

		const pathResult = await fs.getPath(readme.id);
		expect(pathResult.ok).toBe(true);
		if (pathResult.ok) {
			expect(pathResult.value).toBe('Terminal HD/Documents/README.TXT');
		}
	});

	it('returns not_found for missing node', async () => {
		const fs = createDisk();
		const result = await fs.getPath('nonexistent');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});

describe('hasSiblingConflict (case-insensitive duplicate detection)', () => {
	it('detects duplicate names case-insensitively', () => {
		const siblings = [{ name: 'README.TXT' }, { name: 'Pricing.txt' }];
		expect(hasSiblingConflict('readme.txt', siblings)).toBe(true);
		expect(hasSiblingConflict('PRICING.TXT', siblings)).toBe(true);
		expect(hasSiblingConflict('Notes.txt', siblings)).toBe(false);
	});
});

describe('TerminalFS.createFile', () => {
	it('creates a file with appId and fileType', async () => {
		const fs = createDisk();
		const result = await fs.createFile(DOCUMENTS_ID, 'test.sticky', {
			appId: 'stickies',
			fileType: 'sticky',
			text: '{"title":"Test","body":"Hello","color":"#f9bd2b"}'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.appId).toBe('stickies');
			expect(result.value.fileType).toBe('sticky');
			expect(result.value.bodyRef?.kind).toBe('inline-text');
		}
	});

	it('defaults fileType to data when not specified', async () => {
		const fs = createDisk();
		const result = await fs.createFile(DOCUMENTS_ID, 'blob.bin', {});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.fileType).toBe('data');
		}
	});

	it('rejects duplicate names', async () => {
		const fs = createDisk();
		await fs.createFile(DOCUMENTS_ID, 'dup.txt', { text: '' });
		const result = await fs.createFile(DOCUMENTS_ID, 'dup.txt', { text: '' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('duplicate_name');
		}
	});
});

describe('TerminalFS.findByApp', () => {
	it('finds files by appId', async () => {
		const fs = createDisk();
		const before = fs.findByApp('stickies').length;
		await fs.createFile(DOCUMENTS_ID, 'note1', {
			appId: 'stickies',
			fileType: 'sticky',
			text: '{}'
		});
		await fs.createFile(DOCUMENTS_ID, 'note2', {
			appId: 'stickies',
			fileType: 'sticky',
			text: '{}'
		});
		await fs.createFile(DOCUMENTS_ID, 'doc1', { appId: 'textedit', fileType: 'text', text: '' });
		const stickies = fs.findByApp('stickies');
		expect(stickies.length).toBe(before + 2);
	});

	it('filters by parentId when provided', async () => {
		const fs = createDisk();
		await fs.createFile(DOCUMENTS_ID, 'note1', {
			appId: 'stickies',
			fileType: 'sticky',
			text: '{}'
		});
		await fs.createFile(RECORDINGS_ID, 'note2', {
			appId: 'stickies',
			fileType: 'sticky',
			text: '{}'
		});
		const docsOnly = fs.findByApp('stickies', DOCUMENTS_ID);
		expect(docsOnly.length).toBe(1);
	});
});

describe('TerminalFS.readText', () => {
	it('reads inline text from a file', async () => {
		const fs = createDisk();
		const result = await fs.createFile(DOCUMENTS_ID, 'test.txt', { text: 'hello world' });
		if (result.ok) {
			expect(fs.readText(result.value.id)).toBe('hello world');
		}
	});

	it('returns null for non-existent node', () => {
		const fs = createDisk();
		expect(fs.readText('nonexistent')).toBeNull();
	});
});

describe('TerminalFS.deleteNode', () => {
	it('permanently deletes a node', async () => {
		const fs = createDisk();
		const result = await fs.createFile(DOCUMENTS_ID, 'deleteme', { text: 'bye' });
		expect(result.ok).toBe(true);
		if (result.ok) {
			const nodeId = result.value.id;
			const delResult = await fs.deleteNode(nodeId);
			expect(delResult.ok).toBe(true);
			const getResult = await fs.getNode(nodeId);
			expect(getResult.ok).toBe(false);
		}
	});

	it('refuses to delete protected nodes', async () => {
		const fs = createDisk();
		const result = await fs.deleteNode(DOCUMENTS_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('protected_node');
		}
	});
});

describe('TerminalFS.exists', () => {
	it('returns true when a file with that name exists', async () => {
		const fs = createDisk();
		await fs.createFile(DOCUMENTS_ID, 'check.txt', { text: '' });
		expect(fs.exists(DOCUMENTS_ID, 'check.txt')).toBe(true);
	});

	it('returns false when no file with that name exists', () => {
		const fs = createDisk();
		expect(fs.exists(DOCUMENTS_ID, 'nope.txt')).toBe(false);
	});
});

describe('ownership (buyApp / returnApp)', () => {
	it('buyApp adds app to ownedApps', async () => {
		const fs = createDisk();
		// Clean disk has tvguide pre-owned AND installed.
		// Uninstall first, then return, then buy again.
		await fs.uninstallApp('tvguide');
		await fs.returnApp('tvguide');
		expect(fs.isAppOwned('tvguide')).toBe(false);

		const result = await fs.buyApp('tvguide');
		expect(result.ok).toBe(true);
		expect(fs.isAppOwned('tvguide')).toBe(true);
	});

	it('buyApp rejects already-owned app', async () => {
		const fs = createDisk();
		const result = await fs.buyApp('tvguide'); // already owned on clean disk
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('duplicate_name');
	});

	it('returnApp removes app from ownedApps', async () => {
		const fs = createDisk();
		await fs.uninstallApp('tvguide');
		const result = await fs.returnApp('tvguide');
		expect(result.ok).toBe(true);
		expect(fs.isAppOwned('tvguide')).toBe(false);
	});

	it('returnApp rejects if app is still installed', async () => {
		const fs = createDisk();
		const result = await fs.returnApp('tvguide');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('protected_node');
	});

	it('returnApp rejects if app is not owned', async () => {
		const fs = createDisk();
		await fs.uninstallApp('tvguide');
		await fs.returnApp('tvguide');
		const result = await fs.returnApp('tvguide');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('not_found');
	});

	it('free apps are always owned', () => {
		const fs = createDisk();
		expect(fs.isAppOwned('textedit')).toBe(true);
		expect(fs.isAppOwned('stickies')).toBe(true);
	});

	it('getOwnedApps returns pre-owned store apps on clean disk', () => {
		const fs = createDisk();
		const owned = fs.getOwnedApps();
		expect(owned).toContain('tvguide');
		expect(owned).toContain('chatrbot');
		expect(owned).toContain('recorder');
	});

	it('clean disk has ownedApps set on the volume', () => {
		const fs = createDisk();
		const vol = fs.getVolume();
		expect(vol.ownedApps).toBeDefined();
		expect(Array.isArray(vol.ownedApps)).toBe(true);
	});
});
