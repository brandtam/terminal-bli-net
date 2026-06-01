import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MANIFESTS } from './manifests';
import { matchWindow, synthAboutWindowId } from './app-catalog';
import type { WindowSpec } from './app-manifest';
import { vcrPrefs } from '$lib/apps/vcr/vcr-prefs.svelte';
import type { AppContext, AppStorageHandle, WindowHandle } from '$lib/os/os-context';

/**
 * Conformance test: the manifest list is the single source of truth, so every
 * app must fully resolve from it alone. Since the Slice 6 collapse there is one
 * window model — the flat `windows[]` — so the contract is: every declared
 * window resolves through matchWindow to its app, loads a real component, and
 * its id is unique. If any of these fail, an app would be half-registered: shows
 * in the store but won't open, or opens a window the matcher can't route.
 */

/**
 * The set of icon glyphs PixelIcon actually knows how to draw. Read straight out
 * of the component source rather than hardcoding a second copy, so the test can't
 * drift from the real glyph set.
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

/** Build a concrete id for a window spec: exact ids verbatim, prefixes + a sample tail. */
function sampleId(w: WindowSpec): string {
	return w.match.kind === 'exact' ? w.match.id : w.match.prefix + 'sample';
}

/** Every app that owns at least one window. (Trash's window lives on finder; games own none.) */
const windowed = MANIFESTS.filter((m) => m.windows && m.windows.length > 0);

describe('manifest conformance', () => {
	it('covers every windowed app', () => {
		expect(windowed.length).toBeGreaterThan(0);
	});

	it('defines the AppContext every window receives', () => {
		expectTypeOf<AppContext>().toHaveProperty('os');
		expectTypeOf<AppContext>().toHaveProperty('fs');
		expectTypeOf<AppContext>().toHaveProperty('window').toMatchTypeOf<WindowHandle>();
		expectTypeOf<AppContext>().toHaveProperty('storage').toMatchTypeOf<AppStorageHandle>();
		expectTypeOf<AppContext>().toHaveProperty('capabilities');
		expectTypeOf<AppContext>().toHaveProperty('lifecycle');
	});

	describe.each(windowed.map((m) => [m.id, m] as const))('%s', (_id, manifest) => {
		it('resolves an icon to a real PixelIcon kind', () => {
			expect(manifest.icon).toBeTruthy();
			expect(manifest.iconKind).toBeTruthy();
			// iconKind must name a glyph PixelIcon can draw, or every icon renders blank.
			expect(knownPixelIconKinds().has(manifest.iconKind)).toBe(true);
		});

		it('resolves an about target', () => {
			// synthAboutWindowId is what openAbout() routes through — either the app's
			// own about:<id> or the shared system About ('about').
			expect(synthAboutWindowId(manifest.id)).toBeTruthy();
		});

		describe.each((manifest.windows ?? []).map((w, i) => [sampleId(w), w, i] as const))(
			'window %s',
			(id, _w, index) => {
				it('routes through matchWindow back to this app', () => {
					const matched = matchWindow(id);
					expect(matched, `matchWindow('${id}')`).not.toBeNull();
					// The error window reads as Finder chrome via WINDOW_APP_OVERRIDES, but
					// matchWindow itself reports the declaring app — assert that.
					expect(matched?.appId).toBe(manifest.id);
					expect(matched?.spec).toBe(manifest.windows![index]);
				});

				it('loads a real component', async () => {
					const w = manifest.windows![index];
					expect(typeof w.component).toBe('function');
					// VCR's main window is device-aware — its component() returns a
					// different deck per vcrPrefs.device. Invoking once would only hit the
					// ag500r default, so a broken generic import would slip through. Drive
					// both decks for that one window; everything else loads once.
					const deviceAware = manifest.id === 'vcr' && w.role === 'app';
					if (deviceAware) {
						const prev = vcrPrefs.device;
						try {
							for (const device of ['ag500r', 'generic'] as const) {
								vcrPrefs.setDevice(device);
								const mod = (await w.component()) as { default?: unknown };
								expect(mod.default, `vcr deck for device=${device}`).toBeTruthy();
							}
						} finally {
							vcrPrefs.setDevice(prev);
						}
						return;
					}
					const mod = (await w.component()) as { default?: unknown };
					expect(mod.default).toBeTruthy();
				});
			}
		);
	});

	it('has unique window ids across all manifests', () => {
		// A collision would mean two apps fighting over one window in the window
		// manager — the singleton would clobber the other. Exact ids and prefixes
		// share one namespace (a prefix must not also be an exact id).
		const ids = MANIFESTS.flatMap((m) => m.windows ?? []).map((w) =>
			w.match.kind === 'exact' ? w.match.id : w.match.prefix
		);
		const seen = new Set<string>();
		const duplicates: string[] = [];
		for (const id of ids) {
			if (seen.has(id)) duplicates.push(id);
			seen.add(id);
		}
		expect(duplicates, `duplicate window ids: ${duplicates.join(', ')}`).toEqual([]);
	});

	it('lets no two windows claim the same opens content-type/fileType', async () => {
		// buildOpeners (window-host) throws at module load if two windows claim the
		// same content-type or fileType, so a collision surfaces as a REJECTED import
		// — `resolves` is the real assertion (a plain `.not.toThrow()` on the async
		// thunk would inspect only the synchronous call and never see the rejection).
		await expect(import('$lib/os/window-host')).resolves.toBeDefined();
	});
});
