<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { WindowState } from '$lib/types';
	import type { OsApiClass } from '$lib/os/os-api.svelte';
	import type { TerminalFS } from '$lib/terminalos';
	import { setAppContext, type WindowHandle } from '$lib/os/os-context';
	import { resolveWindow } from '$lib/os/window-host';
	import { createAppStorage, createCleanupRegistry } from '$lib/os/app-services';
	import { pageVisibility } from '$lib/os/page-visibility.svelte';

	let {
		win,
		os,
		fs,
		turnstileSiteKey = ''
	}: { win: WindowState; os: OsApiClass; fs: TerminalFS; turnstileSiteKey?: string } = $props();

	// win.id is the stable key for this window (the {#each} is keyed by it), but
	// the window object is reassigned on focus/move/resize — so read through it
	// reactively. resolveWindow is memoized by id, so `resolved` keeps a stable
	// identity and the {#await} below never remounts the component on a tick.
	const resolved = $derived(resolveWindow(win.id));

	// The handle and context read os/fs/win lazily (getters / closures), so they
	// always see the current value and never capture a stale initial reference.
	const handle: WindowHandle = {
		get id() {
			return win.id;
		},
		get args() {
			return resolved?.args ?? {};
		},
		close: () => os.closeWindow(win.id),
		focus: () => os.focusWindow(win.id)
	};

	// OS-owned window lifecycle: the registry runs from *this host's* unmount,
	// so a window close tears down whatever the app registered even if the
	// component forgot its own onDestroy.
	const cleanup = createCleanupRegistry();
	onDestroy(() => cleanup.run());

	setAppContext({
		get os() {
			return os;
		},
		get fs() {
			return fs;
		},
		window: handle,
		storage: createAppStorage(() => resolved?.appId ?? 'unknown'),
		capabilities: {},
		lifecycle: {
			onCleanup: cleanup.onCleanup,
			get focused() {
				return os.activeId === win.id;
			},
			get hidden() {
				return pageVisibility.hidden;
			}
		},
		get turnstileSiteKey() {
			return turnstileSiteKey;
		}
	});
</script>

{#if resolved}
	{#await resolved.load() then { default: Component }}
		<Component />
	{:catch}
		<div class="window-content"><p>This app failed to open.</p></div>
	{/await}
{:else}
	<div class="window-content"><p>Unknown window.</p></div>
{/if}
