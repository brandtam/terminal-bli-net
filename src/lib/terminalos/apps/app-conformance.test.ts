import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MANIFESTS } from './manifests';
import { synthAboutWindowId, synthWindowComponent } from './app-catalog';
import type { TerminalAppManifest } from './app-manifest';
import { vcrPrefs } from '$lib/apps/vcr/vcr-prefs.svelte';

/**
 * Conformance test: the manifest list is the single source of truth, so every
 * launchable app must fully resolve from it alone. If any of these assertions
 * fail, an app would be half-registered — shows in the store but won't open, or
 * opens but has a dead About box, or points its component loader at a path that
 * no longer exists. This is the test that makes the manifest self-enforcing
 * (issue #28's acceptance criteria).
 */

/**
 * The set of icon glyphs PixelIcon actually knows how to draw.
 *
 * Read straight out of the component source rather than hardcoding a second
 * copy here, so the test can't drift from the real glyph set. PixelIcon is a
 * chain of `{#if kind === 'x'}` / `{:else if kind === 'y' || kind === 'z'}`
 * branches; we scrape every `kind === '...'` literal out of it.
 */
function knownPixelIconKinds(): Set<string> {
	const src = readFileSync(
		fileURLToPath(new URL('../../components/PixelIcon.svelte', import.meta.url)),
		'utf8'
	);
	const kinds = [...src.matchAll(/kind\s*===\s*'([^']+)'/g)].map((m) => m[1]);
	expect(kinds.length).toBeGreaterThan(0);
	return new Set(kinds);
}

/**
 * Every manifest that opens a desktop window is launchable from the store/Dock.
 * That is the surface the conformance contract has to hold for. Games with
 * status 'coming-soon' declare no window and are correctly excluded.
 */
const launchable: TerminalAppManifest[] = MANIFESTS.filter((m) => m.window);

describe('manifest conformance', () => {
	it('covers every launchable app', () => {
		// Guard against an empty filter silently passing the whole suite.
		expect(launchable.length).toBeGreaterThan(0);
	});

	describe.each(launchable.map((m) => [m.id, m] as const))('%s', (_id, manifest) => {
		it('resolves a window id', () => {
			const win = manifest.window!;
			// A window needs either a fixed id or a per-instance prefix.
			expect(Boolean(win.id ?? win.idPrefix)).toBe(true);
		});

		it('declares non-empty about / prefs ids when present', () => {
			if (manifest.about) {
				expect(manifest.about.id).toBeTruthy();
			}
			if (manifest.prefs) {
				expect(manifest.prefs.id).toBeTruthy();
			}
		});

		it('resolves an icon to a real PixelIcon kind', () => {
			expect(manifest.icon).toBeTruthy();
			expect(manifest.iconKind).toBeTruthy();
			// iconKind must name a glyph PixelIcon can actually draw, or every
			// icon for this app renders blank.
			expect(knownPixelIconKinds().has(manifest.iconKind)).toBe(true);
		});

		it('resolves an about target', () => {
			// Either the app's own About box or the shared system fallback
			// ('about'). synthAboutWindowId is what openAbout() routes through.
			expect(synthAboutWindowId(manifest.id)).toBeTruthy();
		});

		it('loads its window component', async () => {
			// Apps whose window is rendered inline by Desktop (recorder- clip
			// playback) have no component on the prefix; the fixed window still
			// does, so a manifest with a `component` must be invokable.
			if (!manifest.component) return;
			expect(typeof manifest.component).toBe('function');
			// The whole point: actually invoke the dynamic import so a bad path
			// fails the test here instead of at runtime in the browser.
			//
			// VCR is the one device-aware loader — it returns a different deck per
			// vcrPrefs.device (see manifests.ts). Invoking it once would only ever
			// hit the ag500r default, so a broken import in the generic deck would
			// slip through CI. Exercise both decks and restore the prior setting.
			if (manifest.id === 'vcr') {
				const prev = vcrPrefs.device;
				try {
					for (const device of ['ag500r', 'generic'] as const) {
						vcrPrefs.setDevice(device);
						const mod = (await manifest.component()) as { default?: unknown };
						expect(mod.default, `vcr deck for device=${device}`).toBeTruthy();
					}
				} finally {
					vcrPrefs.setDevice(prev);
				}
				return;
			}
			const mod = (await manifest.component()) as { default?: unknown };
			expect(mod.default).toBeTruthy();
		});

		it('loads its preferences component when declared', async () => {
			const loader = manifest.prefs?.component;
			if (!loader) return;
			expect(typeof loader).toBe('function');
			const mod = (await loader()) as { default?: unknown };
			expect(mod.default).toBeTruthy();
		});

		it('resolves a renderable component for its fixed window id', () => {
			// For a fixed-window app the Desktop render chain must find a loader
			// via synthWindowComponent. (error/about/trash reuse shared chrome
			// components, which is fine — they still resolve a loader.)
			if (!manifest.window?.id || !manifest.component) return;
			expect(synthWindowComponent(manifest.window.id)).toBeTypeOf('function');
		});
	});

	it('has unique window / about / prefs ids across all manifests', () => {
		// A collision would mean two apps fighting over one window in the window
		// manager — the singleton would clobber the other.
		assertUnique(
			'window.id',
			MANIFESTS.map((m) => m.window?.id).filter((v): v is string => Boolean(v))
		);
		assertUnique(
			'about.id',
			MANIFESTS.map((m) => m.about?.id).filter((v): v is string => Boolean(v))
		);
		assertUnique(
			'prefs.id',
			MANIFESTS.map((m) => m.prefs?.id).filter((v): v is string => Boolean(v))
		);
	});
});

function assertUnique(label: string, values: string[]) {
	const seen = new Set<string>();
	const duplicates: string[] = [];
	for (const v of values) {
		if (seen.has(v)) duplicates.push(v);
		seen.add(v);
	}
	expect(duplicates, `duplicate ${label}: ${duplicates.join(', ')}`).toEqual([]);
}
