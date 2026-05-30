import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Desktop.svelte must NOT statically import any app window (or prefs) component
 * that the manifest already lazy-loads. A static import pulls that component
 * into the main desktop chunk, which defeats the code-splitting from Phase 3 —
 * the lazy chunk would end up downloaded twice (once eager, once on open).
 *
 * The two components that intentionally stay static — WelcomeWindow (the
 * first-visit greeter, shown before any lazy chunk could load) and
 * AboutAppWindow (the shared renderer behind every about-* dialog, which would
 * round-trip a chunk on each open) — have no `component` loader in any manifest,
 * so deriving the lazy set from the manifest source excludes them automatically.
 * No hardcoded allowlist to rot.
 *
 * Why parse the manifest's SOURCE rather than call loader.toString(): vitest
 * rewrites `() => import('$lib/...')` into `() => __vite_ssr_dynamic_import__(...)`
 * at runtime, so toString() no longer contains the original `$lib` specifier.
 * Reading the source keeps us anchored to the real import paths.
 */

function read(relPath: string): string {
	return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf8');
}

const manifestSource = read('../terminalos/apps/manifests.ts');
const desktopSource = read('./Desktop.svelte');

/**
 * Every `import('....svelte')` specifier inside a `component:` loader in the
 * manifest — both the window component and any prefs component. This is the set
 * of files that are supposed to be paid for lazily, on window open.
 */
function lazyComponentPaths(): string[] {
	const paths = new Set<string>();
	for (const m of manifestSource.matchAll(/import\(\s*['"]([^'"]+\.svelte)['"]\s*\)/g)) {
		paths.add(m[1]);
	}
	return [...paths];
}

describe('Desktop.svelte does not statically import lazy app components', () => {
	const lazy = lazyComponentPaths();

	it('derives a non-empty lazy set from the manifest source', () => {
		// If this ever hits zero, the per-path check below would pass vacuously.
		expect(lazy.length).toBeGreaterThan(0);
	});

	it.each(lazy)('%s is not statically imported', (path) => {
		// e.g. '$lib/components/TVGuide.svelte' -> base name 'TVGuide'
		const base = path.replace(/^.*\//, '').replace(/\.svelte$/, '');

		// A static import either by the exact $lib path, or by any path ending in
		// that file's base name (covers a relative './X.svelte' re-import too).
		const staticByLibPath = new RegExp(
			`^\\s*import\\s+\\w+\\s+from\\s+['"]${escapeRegExp(path)}['"]`,
			'm'
		);
		const staticByBaseName = new RegExp(
			`^\\s*import\\s+\\w+\\s+from\\s+['"][^'"]*${escapeRegExp(base)}\\.svelte['"]`,
			'm'
		);

		expect(staticByLibPath.test(desktopSource)).toBe(false);
		expect(staticByBaseName.test(desktopSource)).toBe(false);
	});
});

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
