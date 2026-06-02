import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function read(relPath: string): string {
	return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf8');
}

function functionBody(source: string, name: string): string {
	const marker = `function ${name}`;
	const start = source.indexOf(marker);
	expect(start).toBeGreaterThanOrEqual(0);

	const openBrace = source.indexOf('{', start);
	expect(openBrace).toBeGreaterThanOrEqual(0);

	let depth = 0;
	for (let i = openBrace; i < source.length; i++) {
		if (source[i] === '{') depth++;
		if (source[i] === '}') depth--;
		if (depth === 0) return source.slice(openBrace, i + 1);
	}
	throw new Error(`Could not read function body for ${name}`);
}

const finderSource = read('../apps/finder/FinderWindow.svelte');
const desktopSource = read('../components/Desktop.svelte');

describe('Finder/Desktop filesystem open policy', () => {
	it('routes Finder opens through the shared filesystem policy', () => {
		const body = functionBody(finderSource, 'handleOpen');

		expect(body).toContain('openFilesystemNode(node');
		expect(body).toContain('os.openFolder(folder.id, { replaceWindowId: appWindow.id })');
		expect(body).toContain('os.launchApp(appId)');
		expect(body).toContain('os.openDocument(file)');
	});

	it('routes Desktop opens through the shared filesystem policy', () => {
		const body = functionBody(desktopSource, 'openDesktopNode');

		expect(body).toContain('openFilesystemNode(node');
		expect(body).toContain('os.openFolder(folder.id)');
		expect(body).toContain('os.launchApp(appId)');
		expect(body).toContain('os.openDocument(file)');
	});

	it('keeps app-specific document policy out of Finder', () => {
		const body = functionBody(finderSource, 'handleOpen');

		expect(body).not.toContain('docApps');
		expect(body).not.toContain('getAppWindowId');
		expect(body).not.toContain('getAppDef');
		expect(body).not.toContain('isInstalled');
		expect(body).not.toContain('openDocFile');
		expect(body).not.toContain("appId === '");
	});

	it('keeps app-specific document policy out of Desktop file opens', () => {
		const body = functionBody(desktopSource, 'openDesktopNode');

		expect(body).not.toContain('getAppWindowId');
		expect(body).not.toContain('createStickyNote');
		expect(body).not.toContain('os.openWindow(file.id)');
		expect(body).not.toContain("appId === '");
	});
});
