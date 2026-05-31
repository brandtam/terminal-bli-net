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
 * The single context every window receives. `os` and `fs` are stable singletons
 * — `os` is the live OsApiClass instance, so its `$state` fields (now, slotNow,
 * groups, …) stay reactive when a window reads them through here. `win` is this
 * window's handle. No window is given props: it reads what it needs from this
 * context and derives the rest itself, which is what lets the OS render every
 * window identically without knowing any app's prop shape.
 */
export type SystemContext = {
	os: OsApiClass;
	fs: TerminalFS;
	win: WindowHandle;
};

/**
 * `setSystem` is called once per window (in WindowHost); `getSystem` is read by
 * the window's component and any descendant. Typed pair — no string keys.
 */
export const [getSystem, setSystem] = createContext<SystemContext>();
