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
 * Per-app key-value storage, namespaced `terminal.app.<appId>.<key>` in
 * localStorage. Values round-trip through JSON, so store plain data. The
 * namespace is a convention that keeps well-behaved apps out of each other's
 * keys — it is NOT a sandbox and makes no security claim; any code on the page
 * can read any key. Keep bulky bodies in the filesystem (`fs`), not here.
 */
export type AppStorageHandle = {
	readonly appId: string;
	readonly namespace: string;
	get<T>(key: string, fallback: T): T;
	set<T>(key: string, value: T): void;
	delete(key: string): void;
};

/**
 * Typed documentation seam for a future iframe-sandbox capability list. These
 * values are not enforced today; do not treat them as a security guarantee.
 */
export type AppCapabilities = {
	readonly declared?: readonly string[];
};

/**
 * The OS-owned window lifecycle. `onCleanup` callbacks run when this window
 * closes (WindowHost's unmount), so intervals, oscillators, and observers get
 * torn down even if the component forgot its own `onDestroy`. `focused` and
 * `hidden` are reactive — read them in a `$derived`/`$effect` to pause work
 * when the window loses focus or the tab goes to the background.
 */
export type AppLifecycle = {
	onCleanup(cb: () => void): void;
	/** True while this window is the active (frontmost) window. Reactive. */
	readonly focused: boolean;
	/** True while the browser tab is hidden (`document.hidden`). Reactive. */
	readonly hidden: boolean;
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
	lifecycle: AppLifecycle;
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
