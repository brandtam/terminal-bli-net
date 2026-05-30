import type { AppCategory, AppStatus } from './app-types';
import type { AppMenuSpec, AboutSpec, StatusExtra, OsApi } from '$lib/os/os-api';

/**
 * The window an app owns. An app may have a fixed window (`id`), minted
 * instances (`idPrefix`), or both — `recorder` has both `id: 'recorder'` and
 * `idPrefix: 'recorder-'`. Window-ids that differ from the app-id stay
 * explicit here; they are never derived (e.g. tvguide → 'tv-guide').
 */
export type AppWindowSpec = {
	id?: string;
	idPrefix?: string;
	title: string;
	w: number;
	h: number;
	minW?: number;
	minH?: number;
};

/**
 * The app's About dialog. OS chrome, not the app's own window — rendered by the
 * shared AboutAppWindow. Just an id; the content lives in `about` (AboutSpec).
 */
export type AppAboutWindowSpec = {
	id: string;
};

/**
 * The app's Preferences dialog. OS chrome with its own window-def. Each prefs
 * UI is a distinct component; Phase 1 only carries the window metadata so
 * getWindowDef synthesizes identically. The component is wired in Phase 3.
 */
export type AppPrefsWindowSpec = {
	id: string;
	title: string;
	w: number;
	h: number;
};

/**
 * The single source of truth for one app's identity. Replaces the values today
 * spread across APP_LIBRARY, APPS, WINDOW_APP_MAP, getWindowDef, getAppWindowId
 * and getAppIconKind. The catalog synthesizes those structures from these.
 */
export type TerminalAppManifest = {
	// ── Library / lifecycle (from APP_LIBRARY) ──────────────────────────────
	// The manifest is the SOURCE of the AppId union — `id` is a plain string in
	// the type, but defineApp() infers each literal so the union stays closed.
	// Typing this as AppId would be circular (AppId is derived from these ids).
	id: string;
	name: string;
	fileName: string;
	category: AppCategory;
	description: string;
	/** Emoji / short string used by the store and library lists. */
	icon: string;
	removable: boolean;
	desktopAliasByDefault: boolean;
	isSystem: boolean;
	/** Store-app lifecycle. Undefined for system apps. */
	status?: AppStatus;

	// ── Icon sprite (from getAppIconKind) ───────────────────────────────────
	/** Reference to a shared PixelIcon sprite (e.g. 'tv', 'hd', 'floppy', 'doc'). */
	iconKind: string;

	// ── Windows ─────────────────────────────────────────────────────────────
	/** The app's own window. Absent for apps with no fixed window (e.g. chatrbot is minted per show). */
	window?: AppWindowSpec;
	/** The app's About dialog (OS chrome). */
	about?: AppAboutWindowSpec;
	/** The app's Preferences dialog (OS chrome). */
	prefs?: AppPrefsWindowSpec;

	// ── Menus / about content / status (from APPS) ──────────────────────────
	menus: (os: OsApi) => AppMenuSpec[];
	/** The About dialog content (AboutSpec), shown by AboutAppWindow. */
	aboutSpec: AboutSpec;
	statusExtra?: (os: OsApi) => StatusExtra | null;

	// ── App window component (Phase 3 wires this; declared now, left unset) ──
	component?: () => Promise<unknown>;
};

/**
 * Identity helper. Authors a manifest with full type-checking; returns it
 * unchanged. Using this (rather than a bare object literal) lets the compiler
 * flag a missing required field at the definition site.
 *
 * It is generic over the literal `id` only, so `AppId` can be the closed union
 * of the real ids rather than `string`. The return type is the full
 * `TerminalAppManifest` with `id` narrowed to that literal — keeping every
 * optional key (`window`, `prefs`, `status`, …) present on every element, so the
 * catalog's `m.window?.id` lookups still type-check. (A bare `satisfies` on the
 * array would instead drop absent optional keys from each element's type.)
 */
export function defineApp<const Id extends string>(
	manifest: TerminalAppManifest & { id: Id }
): TerminalAppManifest & { id: Id } {
	return manifest;
}
