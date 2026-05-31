import type { AppId, PersistedAppId } from './app-ids';
import type { AppDef } from '$lib/os/os-api';
import type { TerminalAppDefinition } from './app-types';
import type { WindowSpec } from './app-manifest';
import { MANIFESTS } from './manifests';
import { vcrPrefs } from '$lib/apps/vcr/vcr-prefs.svelte';

/**
 * The catalog: synthesizes the legacy app structures from the manifest array.
 * Each old structure becomes a pure derivation, so call sites stay
 * byte-identical while the manifest becomes the single source of truth.
 *
 * Phase 1 only synthesizes. Later phases cut over the consumers and delete the
 * old hand-synced files entirely.
 */

type WindowDef = { title: string; w: number; h: number; minW?: number; minH?: number };

/**
 * Non-app OS chrome windows. These have no owning app in the manifest sense.
 *
 * - `welcome` is the first-visit greeter.
 * - The `about-*` / `about` entries carry the About-dialog geometry. The
 *   manifest's `about` key is just `{ id }` (the shared AboutAppWindow renders
 *   them), so the per-dialog title/size — which today vary entry to entry —
 *   live here as chrome, not on each app.
 *
 * windowAppId() maps welcome → finder; about dialogs map to their owning app
 * (handled by synthWindowAppMap from each manifest's `about.id`).
 */
const STATIC_WINDOWS: Record<string, WindowDef> = {
	welcome: { title: 'Welcome.app', w: 460, h: 540 },
	about: { title: 'About This Terminal', w: 380, h: 380 },
	'about-chatrbot': { title: 'About chatrbot', w: 420, h: 460 },
	'about-tvguide': { title: 'About TV Guide', w: 420, h: 460 },
	'about-textedit': { title: 'About TextEdit', w: 420, h: 380 },
	'about-stats': { title: 'About Stats', w: 420, h: 360 },
	'about-stickies': { title: 'About Stickies', w: 420, h: 380 },
	'about-recorder': { title: 'About Recorder', w: 420, h: 360 },
	'about-software-shop': { title: 'About My Shelf', w: 420, h: 380 },
	'about-computer-store': { title: 'About Computer Store', w: 420, h: 380 },
	'about-vcr': { title: 'About VCR', w: 420, h: 460 }
};

/**
 * Window-ids that WINDOW_APP_MAP routes to a different app than the one whose
 * manifest declares them. These are OS chrome the Finder shell owns even though
 * the window-id matches another app (e.g. `terminal-prefs` is system-prefs'
 * window, but the menu-bar/app routing treats it as Finder chrome). Preserved
 * verbatim from the original WINDOW_APP_MAP.
 */
const WINDOW_APP_OVERRIDES: Record<string, AppId> = {
	'terminal-prefs': 'finder',
	welcome: 'finder',
	about: 'finder',
	error: 'finder',
	trash: 'finder'
};

/** The prefix routing from the original windowAppId(). */
type PrefixRoute = { prefix: string; appId: AppId };
const PREFIX_ROUTES: PrefixRoute[] = MANIFESTS.filter((m) => m.window?.idPrefix).map((m) => ({
	prefix: m.window!.idPrefix!,
	appId: m.id
}));

// ── Flat-model window resolution ─────────────────────────────────────────────

/** A window-id matched to its owning app, WindowSpec, and parsed args. */
export type MatchedWindow = { appId: AppId; spec: WindowSpec; args: Record<string, string> };

/**
 * Parse a window-id to its WindowSpec, owning app, and named args, using the
 * flat `windows` model. This is the ONE place the prefix rule lives — every
 * `id.startsWith('chat-')` the OS hand-writes today collapses to a call here as
 * apps migrate. Pure over the static MANIFESTS, so it is safe to call before a
 * window exists (e.g. to size a window being opened). Returns null for ids no
 * manifest claims via `windows` (legacy windows, until they migrate). Lives
 * here, not in window-host, so app-catalog has no import cycle through
 * app-registry.
 */
export function matchWindow(id: string): MatchedWindow | null {
	for (const m of MANIFESTS) {
		for (const w of m.windows ?? []) {
			if (w.match.kind === 'exact') {
				if (w.match.id === id) return { appId: m.id, spec: w, args: {} };
			} else if (id.startsWith(w.match.prefix)) {
				return {
					appId: m.id,
					spec: w,
					args: { [w.match.arg]: id.slice(w.match.prefix.length) }
				};
			}
		}
	}
	return null;
}

// ── Library (APP_LIBRARY) ───────────────────────────────────────────────────

export function synthAppLibrary(): TerminalAppDefinition[] {
	return MANIFESTS.map((m) => {
		const def: TerminalAppDefinition = {
			id: m.id,
			name: m.name,
			fileName: m.fileName,
			category: m.category,
			description: m.description,
			icon: m.icon,
			removable: m.removable,
			desktopAliasByDefault: m.desktopAliasByDefault,
			isSystem: m.isSystem
		};
		if (m.status !== undefined) def.status = m.status;
		return def;
	});
}

// ── App registry (APPS) ─────────────────────────────────────────────────────

/**
 * The original APPS only held entries for apps with menus/about/preferences UI.
 * Apps with no APPS entry (system-prefs, about-terminal, trash, error, games)
 * must not appear here, or lookups like `APPS[id]` would change shape.
 */
function hasRegistryEntry(m: (typeof MANIFESTS)[number]): boolean {
	return m.aboutSpec.title !== '';
}

export function synthApps(): Record<string, AppDef> {
	const out: Record<string, AppDef> = {};
	for (const m of MANIFESTS) {
		if (!hasRegistryEntry(m)) continue;
		out[m.id] = {
			id: m.id,
			name: m.name,
			filename: m.fileName,
			about: m.aboutSpec,
			preferences: m.prefs ? m.prefs.id : null,
			menus: m.menus,
			statusExtra: m.statusExtra
		};
	}
	return out;
}

// ── Window → app map (WINDOW_APP_MAP) ────────────────────────────────────────

export function synthWindowAppMap(): Record<string, AppId> {
	const out: Record<string, AppId> = {};
	for (const m of MANIFESTS) {
		if (m.window?.id) out[m.window.id] = m.id;
		if (m.about?.id) out[m.about.id] = m.id;
		if (m.prefs?.id) out[m.prefs.id] = m.id;
	}
	// Chrome windows the Finder shell owns, plus `welcome` (no app window).
	Object.assign(out, WINDOW_APP_OVERRIDES);
	return out;
}

/**
 * Memoized once at module load. The map is a pure function of MANIFESTS (a
 * module constant) and the static overrides, so it never changes within a
 * session. synthWindowAppId reads this on every lookup instead of rebuilding —
 * the lookup is on the hot path (os.activeAppId re-runs it on each reactive
 * read). synthWindowAppMap() stays a fresh-object builder for its own callers.
 */
const WINDOW_APP_MAP = synthWindowAppMap();

export function synthWindowAppId(windowId: string): AppId {
	for (const route of PREFIX_ROUTES) {
		if (windowId.startsWith(route.prefix)) return route.appId;
	}
	const mapped = WINDOW_APP_MAP[windowId];
	if (mapped) return mapped;
	// Flat-model windows (e.g. player:) report their owning app here, so the menu
	// bar and app routing follow them without a hardcoded prefix list.
	const matched = matchWindow(windowId);
	if (matched) return matched.appId;
	return 'finder';
}

// ── Known window ids (KNOWN_WINDOW_IDS) ──────────────────────────────────────

/**
 * The original KNOWN_WINDOW_IDS static set: every fixed window-id, plus the
 * about/prefs dialog ids, plus `welcome`. Minted-prefix windows (chat-,
 * sticky-, textedit-, recorder-) are excluded here — isKnownWindowId() matches
 * those by prefix. Derived from the manifests; matches the original exactly.
 */
export function synthKnownWindowIds(): Set<string> {
	const out = new Set<string>(['welcome']);
	for (const m of MANIFESTS) {
		if (m.window?.id) out.add(m.window.id);
		if (m.about?.id) out.add(m.about.id);
		if (m.prefs?.id) out.add(m.prefs.id);
	}
	return out;
}

// ── Window defs (getWindowDef static map) ────────────────────────────────────

/**
 * The static portion of getWindowDef — title/size per fixed window-id. The
 * dynamic branches (chat-/textedit-/sticky-/recorder- prefixes) and the vcr
 * device-sizing stay in getWindowDef itself; this provides everything else.
 *
 * The vcr window's def varies by selected device, so it is computed here from
 * vcrPrefs.device to stay byte-identical with the original ternary.
 */
export function synthWindowDefs(): Record<string, WindowDef> {
	const out: Record<string, WindowDef> = { ...STATIC_WINDOWS };
	for (const m of MANIFESTS) {
		const w = m.window;
		// Only fixed windows contribute to the static def map. Minted-prefix
		// windows (chat-, sticky-, textedit-, recorder-) are sized dynamically
		// in getWindowDef and must not land here as a static entry.
		if (w?.id) {
			out[w.id] = stripUndefined({
				title: w.title,
				w: w.w,
				h: w.h,
				minW: w.minW,
				minH: w.minH
			});
		}
		if (m.prefs) {
			out[m.prefs.id] = { title: m.prefs.title, w: m.prefs.w, h: m.prefs.h };
		}
	}
	// VCR is sized to the selected device — the AG-500R is wide, the Generic
	// deck near-square. Preserves the original getWindowDef ternary.
	out.vcr =
		vcrPrefs.device === 'generic'
			? { title: 'VCR.app', w: 560, h: 523, minW: 480, minH: 470 }
			: { title: 'VCR.app', w: 900, h: 560, minW: 620, minH: 420 };
	return out;
}

function stripUndefined(d: WindowDef): WindowDef {
	const out: WindowDef = { title: d.title, w: d.w, h: d.h };
	if (d.minW !== undefined) out.minW = d.minW;
	if (d.minH !== undefined) out.minH = d.minH;
	return out;
}

// ── App → window id (getAppWindowId) ─────────────────────────────────────────

/**
 * The original getAppWindowId returned a fixed window-id only for a subset of
 * apps (those launched by "open window X"). Apps with no fixed window (stickies,
 * chatrbot, textedit) returned undefined. The original also returned the
 * Finder-shell window-ids for system-prefs ('terminal-prefs') and
 * about-terminal ('about'), which here come straight from their manifest
 * `window.id`.
 */
// Gate set of catalog ids that resolve to a fixed window. Typed as the AppId
// union (each literal is checked against the union at authoring time) but stored
// as a plain string set so it can be probed with a PersistedAppId off disk.
const APP_WINDOW_ID_APPS = new Set<string>([
	'tvguide',
	'recorder',
	'stats',
	'error',
	'system-prefs',
	'about-terminal',
	'software-shop',
	'computer-store',
	'finder',
	'vcr'
] satisfies AppId[]);

// Takes PersistedAppId: called via getAppWindowId with ids read off disk, so an
// unknown id falls through to undefined.
export function synthAppWindowId(appId: PersistedAppId): string | undefined {
	const m = MANIFESTS.find((x) => x.id === appId);
	// Flat model: an app's launch window is its exact-match, role:'app' window
	// (e.g. player → 'player'). This resolves handler-style apps that carry no
	// legacy `window` field, so launching them no longer falls through to opening
	// the app file's own node id (which had no render arm → "Coming soon").
	const launch = m?.windows?.find((w) => w.match.kind === 'exact' && (w.role ?? 'app') === 'app');
	if (launch && launch.match.kind === 'exact') return launch.match.id;
	// Legacy fixed window, gated to the original subset so unmigrated apps with no
	// window (stickies, chatrbot, textedit) still return undefined.
	if (!APP_WINDOW_ID_APPS.has(appId)) return undefined;
	return m?.window?.id;
}

// ── App → icon kind (getAppIconKind) ─────────────────────────────────────────

// Takes PersistedAppId for the same disk-boundary reason; unknown ids → 'doc'.
export function synthAppIconKind(appId: PersistedAppId): string {
	const m = MANIFESTS.find((x) => x.id === appId);
	return m?.iconKind ?? 'doc';
}

// ── App → about / prefs window id (os-api routing) ───────────────────────────

/**
 * The About-dialog window-id for an app. Each manifest carries its own
 * `about.id` (e.g. vcr → 'about-vcr', finder → 'about'); apps with no About
 * dialog (trash, error, system-prefs, the games, or a null/unknown id) fall
 * back to the shared system 'about'. Replaces openAbout()'s hardcoded chain.
 */
export function synthAboutWindowId(appId: string | null): string {
	if (!appId) return 'about';
	const m = MANIFESTS.find((x) => x.id === appId);
	return m?.about?.id ?? 'about';
}

/**
 * The Preferences-dialog window-id for an app, or null if it has none. Mirrors
 * the original APPS[appId].preferences lookup (prefs.id when the manifest
 * declares a `prefs` block, else null). Replaces openPreferences()'s APPS read.
 */
export function synthPrefsWindowId(appId: string): string | null {
	const m = MANIFESTS.find((x) => x.id === appId);
	return m?.prefs?.id ?? null;
}

// ── Window → lazy component (Desktop render chain) ───────────────────────────

/** A loader returning a module whose `default` is the window's Svelte component. */
export type ComponentLoader = () => Promise<unknown>;

/**
 * Resolves a window-id to the lazy component loader that renders it. Desktop
 * calls this once per open window and awaits the loader, so each app's chunk is
 * fetched only when its window is on screen — nothing eager.
 *
 * Resolution order mirrors the old Desktop if-chain:
 *  1. Prefs dialogs (exact id) — each prefs UI is its own component.
 *  2. Fixed app windows (exact `window.id`) — e.g. tv-guide, stats, vcr.
 *  3. Minted instances (`window.idPrefix`) — e.g. chat-, sticky-, textedit-.
 *
 * VCR returns a device-aware loader (see the manifest) so only the selected deck
 * enters the bundle. Window-ids with no component (about-* dialogs handled by
 * the shared AboutAppWindow, the recorder- playback handled inline) return
 * undefined; Desktop keeps their bespoke markup.
 */
export function synthWindowComponent(windowId: string): ComponentLoader | undefined {
	// 1. Prefs dialogs are matched first — they have distinct ids that never
	//    collide with a window/prefix, and each carries its own component.
	for (const m of MANIFESTS) {
		if (m.prefs?.id === windowId) return m.prefs.component;
	}
	// 2. Fixed app windows.
	for (const m of MANIFESTS) {
		if (m.window?.id === windowId) return m.component;
	}
	// 3. Minted instances by prefix (chat-, sticky-, textedit-). recorder- is the
	//    one prefix whose instances have NO component — they are <video> playback
	//    rendered inline in Desktop. recorder's manifest component is the fixed
	//    'recorder' window (handled in pass 2), so the prefix must return
	//    undefined rather than fall through to it.
	for (const m of MANIFESTS) {
		const prefix = m.window?.idPrefix;
		if (!prefix || !windowId.startsWith(prefix)) continue;
		if (m.id === 'recorder') return undefined;
		return m.component;
	}
	return undefined;
}
