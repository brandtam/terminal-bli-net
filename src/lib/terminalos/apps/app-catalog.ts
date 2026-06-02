import type { AppId, PersistedAppId } from './app-ids';
import type { AppDef } from '$lib/os/os-api';
import type { TerminalAppDefinition } from './app-types';
import type { AppLaunchHandler, WindowSpec } from './app-manifest';
import { MANIFESTS } from './manifests';

/**
 * The catalog: synthesizes the legacy app structures from the manifest array.
 * Each old structure becomes a pure derivation, so call sites stay
 * byte-identical while the manifest becomes the single source of truth.
 *
 * Phase 1 only synthesizes. Later phases cut over the consumers and delete the
 * old hand-synced files entirely.
 */

/**
 * The one window-id whose menu-bar identity matchWindow can't supply. `error`'s
 * flat window has appId `error`, but the System Error dialog reads as Finder
 * chrome, so synthWindowAppId checks this override before matchWindow. Everything
 * else — including `trash` (its flat window lives on the finder manifest), the
 * `welcome` app window, and the `about:`/`terminal-prefs` system windows — gets
 * its identity straight from matchWindow.
 */
const WINDOW_APP_OVERRIDES: Record<string, AppId> = {
	error: 'finder'
};

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
				// Exact windows may declare static args (e.g. finder/trash → folder).
				if (w.match.id === id) return { appId: m.id, spec: w, args: w.match.args ?? {} };
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
 * Apps with no APPS entry (trash, error, the coming-soon games) must not appear
 * here, or lookups like `APPS[id]` would change shape. The `system` app DOES
 * appear — its non-empty aboutSpec.title is what registers it, so the menu bar
 * can read its name + menus when an OS chrome dialog is focused.
 */
function hasRegistryEntry(m: (typeof MANIFESTS)[number]): boolean {
	return m.aboutSpec.title !== '';
}

/**
 * An app's Preferences window-id, read off its flat `windows[]` as the exact
 * `role: 'prefs'` entry (e.g. vcr → 'vcr-prefs'), or null if it has no prefs
 * dialog. The single source the registry + os routing both read.
 */
function flatPrefsId(m: (typeof MANIFESTS)[number]): string | null {
	const prefs = m.windows?.find((w) => w.role === 'prefs' && w.match.kind === 'exact');
	return prefs && prefs.match.kind === 'exact' ? prefs.match.id : null;
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
			preferences: flatPrefsId(m),
			menus: m.menus,
			statusExtra: m.statusExtra
		};
	}
	return out;
}

// ── Window → app map (WINDOW_APP_MAP) ────────────────────────────────────────

/**
 * Window → owning app. Now that every window resolves through matchWindow, this
 * map holds ONLY the overrides matchWindow can't supply (just `error`). Every
 * other id falls through to matchWindow in synthWindowAppId.
 */
export function synthWindowAppMap(): Record<string, AppId> {
	return { ...WINDOW_APP_OVERRIDES };
}

/**
 * The `error` override, memoized at module load. synthWindowAppId reads it before
 * matchWindow on every lookup (the lookup is on the hot path — os.activeAppId
 * re-runs it on each reactive read), so an entry here wins over the flat owner.
 */
const WINDOW_APP_MAP = synthWindowAppMap();

export function synthWindowAppId(windowId: string): AppId {
	const mapped = WINDOW_APP_MAP[windowId];
	if (mapped) return mapped;
	// Every window reports its owning app through matchWindow — fixed, prefix, and
	// the system chrome (about:, terminal-prefs) alike. Unknown → finder.
	const matched = matchWindow(windowId);
	if (matched) return matched.appId;
	return 'finder';
}

// ── App → window id (getAppWindowId) ─────────────────────────────────────────

/**
 * An app's launch window-id: its exact-match, role:'app' window (e.g. finder →
 * 'finder', player → 'player', vcr → 'vcr'). Apps launched by a special handler
 * rather than a fixed window — stickies, chatrbot, textedit (prefix-only), and
 * the system chrome app (no role:'app' window) — have none, so this returns
 * undefined and the launcher uses their handler. Takes PersistedAppId because
 * getAppWindowId is called with ids read off disk; an unknown id → undefined.
 */
export function synthAppWindowId(appId: PersistedAppId): string | undefined {
	const m = MANIFESTS.find((x) => x.id === appId);
	const launch = m?.windows?.find((w) => w.match.kind === 'exact' && (w.role ?? 'app') === 'app');
	return launch && launch.match.kind === 'exact' ? launch.match.id : undefined;
}

export type SynthAppLaunchStrategy =
	| { kind: 'fixed'; windowId: string }
	| { kind: 'custom'; handler: AppLaunchHandler }
	| { kind: 'none' };

export function synthAppLaunchStrategy(appId: PersistedAppId): SynthAppLaunchStrategy {
	const m = MANIFESTS.find((x) => x.id === appId);
	if (!m) return { kind: 'none' };
	if (m.launch?.kind === 'custom') return { kind: 'custom', handler: m.launch.handler };
	if (m.launch?.kind === 'none') return { kind: 'none' };

	const windowId = synthAppWindowId(appId);
	return windowId ? { kind: 'fixed', windowId } : { kind: 'none' };
}

export function synthIsSpecialLaunchApp(appId: PersistedAppId): boolean {
	return synthAppLaunchStrategy(appId).kind === 'custom';
}

// ── App → icon kind (getAppIconKind) ─────────────────────────────────────────

// Takes PersistedAppId for the same disk-boundary reason; unknown ids → 'doc'.
export function synthAppIconKind(appId: PersistedAppId): string {
	const m = MANIFESTS.find((x) => x.id === appId);
	return m?.iconKind ?? 'doc';
}

// ── App → about / prefs window id (os-api routing) ───────────────────────────

/**
 * The About-dialog window-id for an app. The `system` app owns a single flat
 * `about:` prefix window, so every per-app About box is minted as `about:<id>`
 * (e.g. vcr → 'about:vcr'); the shared AboutAppWindow reads the id's `appId`
 * arg and renders that app's spec. A null appId is the system About box —
 * window id 'about' (system's exact entry, rendered by AboutTerminal).
 *
 * Note: because the about: window lives on the `system` app, its menu-bar
 * identity is `system` ("Terminal"), not the named app — opening About-an-app
 * is system chrome, not the app coming forward.
 */
export function synthAboutWindowId(appId: string | null): string {
	return appId ? `about:${appId}` : 'about';
}

/**
 * The Preferences-dialog window-id for an app (its flat exact role:'prefs'
 * window), or null if it has none. Drives openPreferences()'s routing.
 */
export function synthPrefsWindowId(appId: string): string | null {
	const m = MANIFESTS.find((x) => x.id === appId);
	return m ? flatPrefsId(m) : null;
}
