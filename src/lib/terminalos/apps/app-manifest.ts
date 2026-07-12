import type { Component } from 'svelte';
import type { AppCategory, AppStatus } from './app-types';
import type { AppMenuSpec, AboutSpec, StatusExtra, OsApi } from '$lib/os/os-api';
// Imported from their source files rather than the $lib/terminalos barrel to
// avoid a barrel→apps→barrel import cycle (this file lives inside terminalos).
import type { TerminalFS } from '../filesystem/terminal-fs';
import type { FileType } from '../filesystem/types';

// ── Flat window model ────────────────────────────────────────────────────────
// An app declares its windows as a flat `windows: WindowSpec[]` — fixed, minted,
// prefs and about as uniform entries. The OS learns everything it needs about a
// window from one of these, so adding an app never edits OS code. (The legacy
// window?/about?/prefs?/component fields this replaced are gone as of the Slice 6
// collapse.)

/**
 * How a window-id maps to its spec, and how the id is parsed into named args.
 * The prefix rule lives ONLY here — `kind: 'prefix'` both matches `player:42`
 * and names the tail (`arg: 'fileId'` → `args.fileId === '42'`), and is
 * invertible (build `player:42` from the arg) so document-open needs no second
 * table. Replaces every hand-written `startsWith('player-')` across the OS.
 */
export type WindowMatch =
	// `args` lets an exact window declare static params (e.g. Finder and Trash are
	// the same component pointed at different folders: { folder: ROOT_ID } vs
	// { folder: TRASH_ID }). They flow into ctx.window.args exactly like a prefix
	// window's parsed args, so the component stays zero-id-branch.
	| { kind: 'exact'; id: string; args?: Record<string, string> }
	| { kind: 'prefix'; prefix: string; arg: string };

/**
 * What `title`/`size` are derived from. Deliberately NOT the reactive os: these
 * are pure functions of (parsed args, filesystem) so they can run inside
 * openWindow before the window — and its reactive context — exists, and so app
 * domain logic never leaks into window geometry.
 */
export type SpecCtx = { args: Record<string, string>; fs: TerminalFS };

export type Geometry = { w: number; h: number; minW?: number; minH?: number };

/** Routing-only tag (menu bar / active-app), never a render branch. */
export type WindowRole = 'app' | 'prefs' | 'about' | 'chrome';

export type AppLaunchPayload = Record<string, unknown>;
export type AppLaunchContext = {
	os: OsApi;
	fs: TerminalFS;
};
export type AppLaunchHandler = (
	ctx: AppLaunchContext,
	payload?: AppLaunchPayload
) => void | Promise<void>;

export type AppLaunchMetadata = { kind: 'custom'; handler: AppLaunchHandler } | { kind: 'none' };

// ── Store listing ────────────────────────────────────────────────────────────

/** The Computer Store's aisles. Display metadata lives in the store's category table. */
export type StoreCategoryId = 'games' | 'business' | 'ent';

export type StoreSticker = 'STAFF_PICK' | 'SALE' | 'NEW';

/**
 * How an app presents itself in the Computer Store. Lives on the manifest so
 * the store catalog is a pure derivation over MANIFESTS — an app is added to
 * the store by writing this block, never by editing a second hand-kept list.
 * The box title is the manifest `name` uppercased (box art is always caps).
 */
export type StoreListing = {
	/** Which aisle shelves the box. Category display metadata is the store's. */
	category: StoreCategoryId;
	/** Publisher line on the box art (e.g. 'ELORG-ISH'). */
	publisher: string;
	/** One-liner on the box front. */
	tagline: string;
	/** Box-art glyph name (the computer-store PixelIcon set). */
	boxIcon: string;
	sticker?: StoreSticker;
	/** Back-of-box copy. */
	back: string;
	/** "Inside the box" bullet list. */
	inside: string[];
	/** System requirements line. */
	reqs: string;
	/**
	 * Optional sort key within the aisle (lower first, default 0; ties keep
	 * manifest order). Only for when shelf placement must differ from manifest
	 * order — most apps omit it.
	 */
	shelfOrder?: number;
};

/**
 * One window an app owns. Every entry is uniform — a fixed window, a minted
 * instance, a prefs dialog and an about dialog differ only in `match`/`role`,
 * not in shape. Every window has a `component`; there is no "no component" arm.
 * Window components take ZERO props — they read the shared context (getAppContext)
 * and derive what they need — so the host renders them all identically.
 */
export type WindowSpec = {
	match: WindowMatch;
	title: (c: SpecCtx) => string;
	size: (c: SpecCtx) => Geometry;
	component: () => Promise<{ default: Component }>;
	role?: WindowRole;
	/** Sticky-style windows that draw their own chrome. */
	chromeless?: boolean;
	/**
	 * Documents this window opens as a handler (LaunchServices-style). Drives
	 * `os.openDocument`: a file routes to the window whose `opens` covers its
	 * content-type (or coarser fileType), with no per-app id switch.
	 */
	opens?: { contentTypes?: string[]; fileTypes?: FileType[] };
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
	/**
	 * Optional app-supplied pixel sprite: rows of palette characters (one char =
	 * one pixel, `.`/space = transparent — see SPRITE_PALETTE in
	 * $lib/components/pixel-sprite). When present it wins over `iconKind`, so an
	 * app can ship its own icon without adding a glyph to the shared PixelIcon.
	 */
	iconSprite?: string[];

	// ── Windows ─────────────────────────────────────────────────────────────
	/**
	 * The app's windows in the flat model — fixed, minted, prefs and about as
	 * uniform WindowSpec entries. Optional: a few apps own no window (Trash, whose
	 * window lives on the finder manifest; coming-soon games).
	 */
	windows?: WindowSpec[];

	/**
	 * Optional launch override. Apps with a fixed exact `role:'app'` window launch
	 * through that window by default; prefix-only apps declare custom behavior here.
	 */
	launch?: AppLaunchMetadata;

	/**
	 * The app's Computer Store listing. Required for store apps (isSystem: false,
	 * status other than 'deprecated') — a drift test enforces it — and absent on
	 * system apps. The store derives its whole catalog from these blocks.
	 */
	store?: StoreListing;

	// ── Menus / about content / status (from APPS) ──────────────────────────
	menus: (os: OsApi) => AppMenuSpec[];
	/** The About dialog content (AboutSpec), shown by AboutAppWindow. */
	aboutSpec: AboutSpec;
	statusExtra?: (os: OsApi) => StatusExtra | null;
};

/**
 * Identity helper. Authors a manifest with full type-checking; returns it
 * unchanged. Using this (rather than a bare object literal) lets the compiler
 * flag a missing required field at the definition site.
 *
 * It is generic over the literal `id` only, so `AppId` can be the closed union
 * of the real ids rather than `string`. The return type is the full
 * `TerminalAppManifest` with `id` narrowed to that literal — keeping every
 * optional key (`windows`, `status`, …) present on every element, so the
 * catalog's `m.windows?.find(...)` lookups still type-check. (A bare `satisfies`
 * on the array would instead drop absent optional keys from each element's type.)
 */
export function defineApp<const Id extends string>(
	manifest: TerminalAppManifest & { id: Id }
): TerminalAppManifest & { id: Id } {
	return manifest;
}
