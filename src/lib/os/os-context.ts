import { createContext } from 'svelte';
import type { OsApiClass } from '$lib/os/os-api.svelte';
import type { TerminalFS } from '$lib/terminalos';

/**
 * A per-window handle the OS hands each window through context. Carries the
 * window's identity, the args the manifest matcher parsed out of its id (e.g.
 * `{ fileId }` for `player:<fileId>`), and the few actions a window performs on
 * itself. Everything is prebound to this window's id, so a component never sees
 * or constructs a raw window-id.
 */
export type WindowHandle = {
	readonly id: string;
	readonly args: Record<string, string>;
	close(): void;
	focus(): void;
};

/**
 * Reserved for #29. The host provides this handle now so every app receives the
 * final AppContext shape, but it deliberately exposes no persistence methods
 * until the scoped storage design lands.
 */
export type AppStorageHandle = {
	readonly appId: string;
	readonly namespace: string;
	readonly status: 'reserved';
};

/**
 * Typed documentation seam for a future iframe-sandbox capability list. These
 * values are not enforced today; do not treat them as a security guarantee.
 */
export type AppCapabilities = {
	readonly declared?: readonly string[];
};

/**
 * Typed documentation seam for #30, where the games SDK can design focus and
 * visibility hooks against a real requestAnimationFrame loop. Svelte lifecycle
 * remains the only active component lifecycle today.
 */
export type AppLifecycle = {
	readonly focusAware?: boolean;
};

/**
 * The single typed context every app window receives. `os` and `fs` are stable
 * singletons — `os` is the live OsApiClass instance, so its `$state` fields stay
 * reactive when a window reads them through here. `window` is this window's
 * handle. No app window is given bespoke props: it reads this context and
 * derives the rest itself, which lets the OS render every app identically.
 */
export type AppContext = {
	os: OsApiClass;
	fs: TerminalFS;
	window: WindowHandle;
	storage: AppStorageHandle;
	capabilities?: AppCapabilities;
	lifecycle?: AppLifecycle;
	/**
	 * Public Turnstile site key, read once from `$env/dynamic/public` at the app
	 * edge and threaded here so leaf windows (the chat) need no env import.
	 * Empty/undefined → Turnstile not configured (dev); the chat gate is bypassed.
	 */
	turnstileSiteKey?: string;
};

/**
 * `setAppContext` is called once per window (in WindowHost); `getAppContext` is
 * read by the window's component and any descendant. Typed pair — no string keys.
 */
export const [getAppContext, setAppContext] = createContext<AppContext>();
