import { describe, it, expect } from 'vitest';
import { TerminalFS, APPLICATIONS_ID, DESKTOP_ID } from '../filesystem/terminal-fs';
import { getShopCatalog, isInstalled, canUninstall } from './software-shop';

describe('getShopCatalog', () => {
	it('returns catalog items', () => {
		const fs = TerminalFS.createCleanDisk();
		const catalog = getShopCatalog(fs.getAllNodes());
		expect(catalog.length).toBeGreaterThan(0);
	});

	it('hides system-only apps (finder, trash, system-prefs, about-terminal)', () => {
		const fs = TerminalFS.createCleanDisk();
		const catalog = getShopCatalog(fs.getAllNodes());
		const ids = catalog.map((item) => item.app.id);
		expect(ids).not.toContain('finder');
		expect(ids).not.toContain('trash');
		expect(ids).not.toContain('system-prefs');
		expect(ids).not.toContain('about-terminal');
	});

	it('marks default apps as installed', () => {
		const fs = TerminalFS.createCleanDisk();
		const catalog = getShopCatalog(fs.getAllNodes());
		const tvGuide = catalog.find((item) => item.app.id === 'tvguide');
		expect(tvGuide?.installed).toBe(true);
	});
});

describe('isInstalled', () => {
	it('returns true for installed app', () => {
		const fs = TerminalFS.createCleanDisk();
		expect(isInstalled('tvguide', fs.getAllNodes())).toBe(true);
	});

	it('returns false for uninstalled app', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.uninstallApp('tvguide');
		expect(isInstalled('tvguide', fs.getAllNodes())).toBe(false);
	});
});

describe('canUninstall', () => {
	it('returns true for removable apps', () => {
		expect(canUninstall('tvguide')).toBe(true);
	});

	it('returns false for protected apps', () => {
		expect(canUninstall('software-shop')).toBe(false);
	});

	it('returns false for unknown apps', () => {
		expect(canUninstall('nonexistent' as string)).toBe(false);
	});
});

describe('installApp', () => {
	it('creates app file in /Applications', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.uninstallApp('tvguide');

		const result = await fs.installApp('tvguide');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.appId).toBe('tvguide');
			expect(result.value.parentId).toBe(APPLICATIONS_ID);
		}
	});

	it('creates desktop alias for apps with desktopAliasByDefault', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.uninstallApp('tvguide');

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
		const result = await fs.uninstallApp('tvguide');
		expect(result.ok).toBe(true);
		expect(isInstalled('tvguide', fs.getAllNodes())).toBe(false);
	});

	it('removes desktop aliases pointing to app', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.uninstallApp('tvguide');

		const desktopResult = await fs.listFolder(DESKTOP_ID);
		if (desktopResult.ok) {
			const tvAliases = desktopResult.value.filter((n) => n.name === 'TV Guide.app');
			expect(tvAliases.length).toBe(0);
		}
	});

	it('does not delete user documents', async () => {
		const fs = TerminalFS.createCleanDisk();
		// TextEdit documents exist in /Documents
		await fs.uninstallApp('textedit');

		// README.TXT should still be there (it's a document, not an app file)
		const docsResult = await fs.listFolder('folder_documents');
		if (docsResult.ok) {
			const readme = docsResult.value.find((n) => n.name === 'README.TXT');
			expect(readme).toBeDefined();
		}
	});

	it('rejects uninstalling protected app', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.uninstallApp('software-shop');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('protected_node');
		}
	});

	it('returns not_found for uninstalled app', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.uninstallApp('tvguide');
		const result = await fs.uninstallApp('tvguide');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('not_found');
		}
	});
});

describe('isAppInstalled', () => {
	it('returns true for installed app', async () => {
		const fs = TerminalFS.createCleanDisk();
		const result = await fs.isAppInstalled('tvguide');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(true);
	});

	it('returns false after uninstall', async () => {
		const fs = TerminalFS.createCleanDisk();
		await fs.uninstallApp('tvguide');
		const result = await fs.isAppInstalled('tvguide');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(false);
	});
});
