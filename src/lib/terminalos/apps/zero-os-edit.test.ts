import { describe, it, expect } from 'vitest';
import { MANIFESTS } from './manifests';
import { defineApp, type TerminalAppManifest } from './app-manifest';
import { matchWindow, synthWindowAppId, synthAppWindowId } from './app-catalog';
import { resolveWindow, invalidateWindow } from '$lib/os/window-host';

/**
 * The permanent guardrail for the Window Host redesign. Its whole thesis is that
 * the OS holds ZERO app-specific knowledge: adding an app is a manifest entry plus
 * a zero-prop component, never an OS-code edit. matchWindow is the single funnel
 * every render/identity/launch path flows through.
 *
 * This test proves it operationally: it appends a brand-new app to MANIFESTS at
 * runtime — touching NO OS code — and asserts the OS resolves, routes, launches,
 * and would render it purely from that manifest entry. If a future change reaches
 * back to an app-specific branch (a `startsWith('foo-')`, a hardcoded id map),
 * this fixture won't be covered by it, and the relevant assertion fails here.
 *
 * The fixture is pushed and popped inside the single test, and Vitest isolates
 * test files in separate workers, so the mutation never leaks to the real catalog.
 */
describe('zero-OS-edit proof', () => {
	const fixture = defineApp({
		id: 'proof-fixture-app',
		name: 'Proof Fixture',
		fileName: 'Proof.app',
		category: 'utilities',
		description: 'A manifest-only app that exists solely for this guardrail test.',
		icon: '✶',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		iconKind: 'doc',
		// A real component loader, so "would render" means a real module with a
		// default export resolves — the same shape WindowHost awaits.
		windows: [
			{
				match: { kind: 'exact', id: 'proof-fixture' },
				role: 'app',
				title: () => 'Proof Fixture',
				size: () => ({ w: 320, h: 240 }),
				component: () => import('$lib/apps/stats/StatsWindow.svelte')
			}
		],
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	});

	it('resolves, routes, launches and renders a manifest-only app with no OS edit', async () => {
		// Sanity: before registration the id is unknown to every funnel.
		expect(matchWindow('proof-fixture')).toBeNull();

		// MANIFESTS is typed as the closed union of the real app manifests, so a new
		// id needs a widening cast to append — exactly what a real new app does at
		// authoring time by adding its defineApp(...) literal to the array.
		const catalog = MANIFESTS as TerminalAppManifest[];
		catalog.push(fixture);
		try {
			// 1. Resolution: matchWindow claims the id for the new app, off its spec.
			const matched = matchWindow('proof-fixture');
			expect(matched?.appId).toBe('proof-fixture-app');
			expect(matched?.spec).toBe(fixture.windows![0]);

			// 2. Identity: the menu bar / active-app routing follows it — no override,
			//    purely matchWindow.
			expect(synthWindowAppId('proof-fixture')).toBe('proof-fixture-app');

			// 3. Launch: getAppWindowId finds its exact role:'app' window.
			expect(synthAppWindowId('proof-fixture-app')).toBe('proof-fixture');

			// 4. Render: resolveWindow returns a loader whose module has a default
			//    component — WindowHost would mount it through the one generic path.
			const resolved = resolveWindow('proof-fixture');
			expect(resolved).not.toBeNull();
			expect(resolved?.spec).toBe(fixture.windows![0]);
			const mod = await resolved!.load();
			expect(mod.default).toBeTruthy();
		} finally {
			catalog.pop();
			invalidateWindow('proof-fixture');
		}

		// And it's cleanly gone again — nothing leaked into the catalog.
		expect(matchWindow('proof-fixture')).toBeNull();
	});
});
