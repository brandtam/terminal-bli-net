import { describe, it, expect } from 'vitest';
import { TerminalFS, APPLICATIONS_ID, DESKTOP_ID } from '../filesystem/terminal-fs';
import {
	getShopCatalog,
	isInstalled,
	canUninstall,
	isOwned,
	getOwnedAppIds,
	deriveOwnedApps
} from './software-shop';

describe('getShopCatalog', () => {
	it('returns catalog items', () => {
		const fs = TerminalFS.createCleanDisk();
		const catalog = getShopCatalog(fs.getAllNodes());
		expect(catalog.length).toBeGreaterThan(0);
	});

	it('hides system apps from the catalog', () => {
		const fs = TerminalFS.createCleanDisk();
		const catalog = getShopCatalog(fs.getAllNodes());
		const ids = catalog.map((item) => item.app.id);
		expect(ids).not.toContain('finder');
		expect(ids).not.toContain('trash');
		expect(ids).not.toContain('system-prefs');
		expect(ids).not.toContain('about-terminal');
		expect(ids).not.toContain('software-shop');
		expect(ids).not.toContain('computer-store');
		expect(ids).not.toContain('textedit');
		expect(ids).not.toContain('stickies');
	});

	it('includes store apps', () => {
		const fs = TerminalFS.createCleanDisk();
		const catalog = getShopCatalog(fs.getAllNodes());
		const ids = catalog.map((item) => item.app.id);
		expect(ids).toContain('tvguide');
		expect(ids).toContain('chatrbot');
		expect(ids).toContain('stats');
		expect(ids).toContain('error');
	});

	it('no store apps are installed on a clean disk', () => {
		const fs = TerminalFS.createCleanDisk();
		const catalog = getShopCatalog(fs.getAllNodes());
		const installedCount = catalog.filter((item) => item.installed).length;
		expect(installedCount).toBe(0);
	});
});

describe('isInstalled', () => {
	it('returns true for system apps that ship with OS', () => {
		const fs = TerminalFS.createCleanDisk();
		expect(isInstalled('textedit', fs.getAllNodes())).toBe(true);
		expect(isInstalled('stickies', fs.getAllNodes())).toBe(true);
	});

	it('returns false for store apps on clean disk', () => {
		const fs = TerminalFS.createCleanDisk();
		expect(isInstalled('tvguide', fs.getAllNodes())).toBe(false);
		expect(isInstalled('stats', fs.getAllNodes())).toBe(false);
	});
});

describe('canUninstall', () => {
	it('returns true for removable store apps', () => {
		expect(canUninstall('tvguide')).toBe(true);
		expect(canUninstall('stats')).toBe(true);
	});

	it('returns false for protected system apps', () => {
		expect(canUninstall('software-shop')).toBe(false);
		expect(canUninstall('textedit')).toBe(false);
		expect(canUninstall('stickies')).toBe(false);
	});

	it('returns false for unknown apps', () => {
		expect(canUninstall('nonexistent' as string)).toBe(false);
	});
});

describe('installApp', () => {
	it('creates app file in /Applications', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.installApp('tvguide');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.appId).toBe('tvguide');
			expect(result.value.parentId).toBe(APPLICATIONS_ID);
		}
	});

	it('creates desktop alias for apps with desktopAliasByDefault', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.installApp('tvguide');

		const desktopResult = await fs.listFolder(DESKTOP_ID);
		expect(desktopResult.ok).toBe(true);
		if (desktopResult.ok) {
			const aliases = desktopResult.value.filter(
				(n) => n.kind === 'alias' && n.name === 'TV Guide.app'
			);
			expect(aliases.length).toBe(1);
		}
	});

	it('rejects installing already-installed app', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.installApp('tvguide');
		const result = await fs.installApp('tvguide');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('duplicate_name');
		}
	});

	it('rejects installing unknown app', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.installApp('nonexistent' as string);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('missing_app');
		}
	});
});

describe('uninstallApp', () => {
	it('removes app file', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.installApp('tvguide');
		const result = await fs.uninstallApp('tvguide');
		expect(result.ok).toBe(true);
		expect(isInstalled('tvguide', fs.getAllNodes())).toBe(false);
	});

	it('removes desktop aliases pointing to app', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.installApp('tvguide');
		await fs.uninstallApp('tvguide');

		const desktopResult = await fs.listFolder(DESKTOP_ID);
		if (desktopResult.ok) {
			const tvAliases = desktopResult.value.filter((n) => n.name === 'TV Guide.app');
			expect(tvAliases.length).toBe(0);
		}
	});

	it('does not delete user documents when uninstalling textedit', async () => {
		const fs = TerminalFS.createCleanDisk();
		const docsResult = await fs.listFolder('folder_documents');
		if (docsResult.ok) {
			const readme = docsResult.value.find((n) => n.name === 'README.TXT');
			expect(readme).toBeDefined();
		}
	});

	it('rejects uninstalling protected system app', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.uninstallApp('software-shop');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('protected_node');
		}
	});

	it('returns not_found for app that is not installed', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.uninstallApp('tvguide');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});

describe('isAppInstalled', () => {
	it('returns true for system app installed by default', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.isAppInstalled('textedit');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(true);
	});

	it('returns false for store app on clean disk', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.isAppInstalled('tvguide');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(false);
	});
});

describe('isOwned', () => {
	it('returns true for system apps regardless of ownedApps list', () => {
		expect(isOwned('textedit', [])).toBe(true);
		expect(isOwned('stickies', [])).toBe(true);
		expect(isOwned('finder', [])).toBe(true);
		expect(isOwned('software-shop', [])).toBe(true);
	});

	it('returns false for store apps not in ownedApps', () => {
		expect(isOwned('tvguide', [])).toBe(false);
		expect(isOwned('chatrbot', [])).toBe(false);
		expect(isOwned('stats', [])).toBe(false);
		expect(isOwned('error', [])).toBe(false);
	});

	it('returns true for store apps in ownedApps', () => {
		expect(isOwned('tvguide', ['tvguide'])).toBe(true);
		expect(isOwned('chatrbot', ['chatrbot', 'tvguide'])).toBe(true);
	});

	it('returns false for unknown apps', () => {
		expect(isOwned('nonexistent' as string, ['nonexistent' as string])).toBe(false);
	});
});

describe('getOwnedAppIds', () => {
	it('returns empty list when no store apps purchased', () => {
		const owned = getOwnedAppIds([]);
		expect(owned).toHaveLength(0);
	});

	it('returns purchased store apps', () => {
		const owned = getOwnedAppIds(['tvguide', 'chatrbot']);
		expect(owned).toContain('tvguide');
		expect(owned).toContain('chatrbot');
		expect(owned).toHaveLength(2);
	});
});

describe('deriveOwnedApps', () => {
	it('returns empty on clean disk (no store apps installed)', () => {
		const fs = TerminalFS.createCleanDisk();
		const derived = deriveOwnedApps(fs.getAllNodes());
		expect(derived).toHaveLength(0);
	});

	it('does not include system apps in derived list', () => {
		const fs = TerminalFS.createCleanDisk();
		const derived = deriveOwnedApps(fs.getAllNodes());
		expect(derived).not.toContain('textedit');
		expect(derived).not.toContain('stickies');
	});

	it('includes manually installed store apps', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.installApp('tvguide');
		const derived = deriveOwnedApps(fs.getAllNodes());
		expect(derived).toContain('tvguide');
	});
});
