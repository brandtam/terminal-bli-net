<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { saveWindows } from '$lib/persistence';
	import { OsApiClass } from '$lib/os/os-api.svelte';
	import {
		TerminalFS,
		LocalStorageManifestStore,
		IndexedDBBodyStore,
		DOCUMENTS_ID,
		DESKTOP_ID,
		ROOT_ID,
		SYSTEM_ID,
		APPLICATIONS_ID,
		RECORDINGS_ID,
		TRASH_ID
	} from '$lib/terminalos';
	import type { FsFile, FsNode, FsAlias } from '$lib/terminalos';
	import { createFolderView } from '$lib/terminalos';
	import { resolveWindow } from '$lib/os/window-host';
	import Window from './Window.svelte';
	import WindowHost from './WindowHost.svelte';
	import MenuBar from './MenuBar.svelte';
	import DesktopIcon from './DesktopIcon.svelte';
	import PixelIcon from './PixelIcon.svelte';
	import Dock from './Dock.svelte';
	import BootScreen from './BootScreen.svelte';
	import {
		createStickyNote,
		seedDefaultStickies,
		setStickyColor
	} from '$lib/apps/stickies/stickies-manager.svelte';
	import DesktopContextMenu from './DesktopContextMenu.svelte';
	import { getAppWindowId, getAppIconKind } from '$lib/terminalos/apps/app-install';
	import { matchWindow } from '$lib/terminalos/apps/app-catalog';
	import { vcrPrefs } from '$lib/apps/vcr/vcr-prefs.svelte';

	// A window is "flat-migrated" when a manifest claims it via windows[]: those
	// render through the single generic WindowHost path. With Finder and Trash
	// migrated, every live window is flat — WindowHost lazy-loads each app's chunk
	// when its window opens (see manifests.ts). Brief 05 collapses the remaining
	// {:else} arm and matchWindow becomes the sole render gate.
	const isFlatWindow = (id: string) => matchWindow(id) !== null;

	let booted = $state(false);
	let os = $state<OsApiClass>(undefined!);
	let terminalFs = $state<TerminalFS>(undefined!);

	let selectedIconId = $state<string | null>(null);

	let desktopView: ReturnType<typeof createFolderView> | null = $state(null);

	function resolveAliasSync(node: FsNode, seen?: Set<string>): FsNode | null {
		if (node.kind !== 'alias') return null;
		const alias = node as FsAlias;
		const visited = seen ?? new Set<string>();
		if (visited.has(alias.id)) return null;
		visited.add(alias.id);
		const target = terminalFs.peekNode(alias.target.nodeId);
		if (!target) return null;
		if (target.kind === 'alias') return resolveAliasSync(target, visited);
		return target;
	}

	async function openDesktopNode(node: FsNode) {
		if (node.kind === 'alias') {
			const target = resolveAliasSync(node);
			if (target) openDesktopNode(target);
			return;
		}
		if (node.kind === 'file') {
			const file = node as FsFile;
			const appId = file.appId;
			if (!appId) {
				os.openWindow(file.id);
				return;
			}
			// Special apps need their own handling
			if (appId === 'stickies') {
				const id = await createStickyNote(terminalFs);
				if (id) os.openWindow(`sticky:${id}`);
				return;
			}
			// Generic: look up the window ID
			const windowId = getAppWindowId(appId);
			if (windowId) {
				os.openWindow(windowId);
				return;
			}
			// Fallback for files opened by their app (textedit docs, recordings)
			os.openWindow(file.id);
		}
	}

	function desktopIconKind(node: FsNode): string {
		if (node.kind === 'alias') {
			const target = resolveAliasSync(node);
			if (target) return desktopIconKind(target);
			return 'doc';
		}
		if (node.kind === 'file') {
			const file = node as FsFile;
			if (file.appId) return getAppIconKind(file.appId);
			return 'doc';
		}
		return 'doc';
	}

	let deskCtxNode = $state<FsNode | null>(null);
	let deskCtxOpen_: (() => void) | null = $state(null);
	let deskCtxCanAlias = $state(false);
	let deskCtxCanTrash = $state(false);
	let deskCtxX = $state(0);
	let deskCtxY = $state(0);

	const PROTECTED_DESKTOP_IDS = new Set([
		ROOT_ID,
		SYSTEM_ID,
		APPLICATIONS_ID,
		DESKTOP_ID,
		RECORDINGS_ID,
		TRASH_ID
	]);

	function showDesktopCtx(
		e: MouseEvent,
		opts: { open: () => void; node?: FsNode; canAlias?: boolean; canTrash?: boolean }
	) {
		deskCtxNode = opts.node ?? null;
		deskCtxOpen_ = opts.open;
		deskCtxCanAlias = opts.canAlias ?? false;
		deskCtxCanTrash = opts.canTrash ?? false;
		deskCtxX = e.clientX;
		deskCtxY = e.clientY;
	}

	function handleDesktopContextMenu(e: MouseEvent, node: FsNode) {
		showDesktopCtx(e, {
			open: () => openDesktopNode(node),
			node,
			canAlias: node.kind === 'file',
			canTrash: !PROTECTED_DESKTOP_IDS.has(node.id)
		});
	}

	function closeDeskCtx() {
		deskCtxNode = null;
		deskCtxOpen_ = null;
	}

	function deskCtxOpen() {
		deskCtxOpen_?.();
		closeDeskCtx();
	}

	async function deskCtxMakeAlias() {
		if (!deskCtxNode) return;
		await terminalFs.createAlias(DESKTOP_ID, deskCtxNode.id, deskCtxNode.name + ' alias');
		closeDeskCtx();
	}

	async function deskCtxTrash() {
		if (!deskCtxNode) return;
		await terminalFs.trash(deskCtxNode.id);
		closeDeskCtx();
	}

	function openTextEditFile(name: string) {
		const files = terminalFs.findByApp('textedit', DOCUMENTS_ID);
		const file = files.find((f) => f.name === name);
		if (file) os.openWindow(`textedit:${file.id}`);
	}

	onMount(async () => {
		const bootStart = Date.now();

		// Open filesystem
		// Bodies persist to IndexedDB (blob bytes), nodes to localStorage (the
		// manifest). Backup round-trips blobs as base64, so this is safe to wire
		// before any app writes a blob.
		const fs = await TerminalFS.open(new LocalStorageManifestStore(), new IndexedDBBodyStore());
		terminalFs = fs;

		// Create OS API
		os = new OsApiClass(fs);

		// Seed the first-run note (notes live as files; the filesystem is the
		// source of truth, so there is no manager cache to initialize).
		seedDefaultStickies(fs);
		desktopView = createFolderView(fs, DESKTOP_ID);

		// Register app launch handlers
		os.registerLaunchHandler('stickies', async (payload) => {
			if (payload?.action === 'new') {
				const id = await createStickyNote(terminalFs);
				if (id) os.openWindow(`sticky:${id}`);
				return;
			}
			if (payload?.action === 'color' && payload?.color) {
				if (os.activeId?.startsWith('sticky:')) {
					const noteId = os.activeId.replace('sticky:', '');
					setStickyColor(terminalFs, noteId, payload.color as string);
				}
				return;
			}
			const id = await createStickyNote(terminalFs);
			if (id) os.openWindow(`sticky:${id}`);
		});

		os.registerLaunchHandler('textedit', (payload) => {
			if (payload?.action === 'new') {
				const base = 'Untitled';
				const ext = '.txt';
				let name = `${base}${ext}`;
				if (terminalFs.exists(DOCUMENTS_ID, name)) {
					let i = 2;
					while (terminalFs.exists(DOCUMENTS_ID, `${base} ${i}${ext}`)) i++;
					name = `${base} ${i}${ext}`;
				}
				terminalFs.createTextFile(DOCUMENTS_ID, name, '').then((result) => {
					if (result.ok) os.openWindow(`textedit:${result.value.id}`);
				});
				return;
			}
			if (payload?.action === 'open') {
				const docs = terminalFs.findByApp('textedit', DOCUMENTS_ID);
				const buttons = docs.map((d) => ({
					label: d.name,
					action: () => os.openWindow(`textedit:${d.id}`)
				}));
				os.alert({
					title: 'Open Document',
					body: docs.length > 0 ? 'Choose a document to open:' : 'No documents found.',
					buttons: [...buttons, { label: 'Cancel', primary: true }]
				});
				return;
			}
			if (payload?.open) {
				openTextEditFile(payload.open as string);
				return;
			}
			openTextEditFile('README.TXT');
		});

		os.registerLaunchHandler('chatrbot', (payload) => {
			if (payload?.showId) {
				const showId = payload.showId as string;
				const group = os.groups.find((g) => g.slug === showId);
				if (group) os.openChat(group);
			}
		});

		// Init dock aliases (for symbolic dock IDs like 'pricing', 'readme')
		os.initDockAliases(openTextEditFile);

		// Initialize OsApi (fetches API data, restores windows, starts clock, keyboard shortcuts)
		await os.init();

		// Ensure minimum boot time for retro boot ceremony (matches smiley rotation)
		const elapsed = Date.now() - bootStart;
		if (elapsed < 2400) {
			await new Promise((resolve) => setTimeout(resolve, 2400 - elapsed));
		}

		booted = true;
	});

	onDestroy(() => {
		if (booted) os.destroy();
		desktopView?.destroy();
		terminalFs?.destroy();
	});

	// Accent CSS sync
	$effect(() => {
		if (!booted) return;
		document.documentElement.style.setProperty('--accent', os.tweaks.accent);
	});

	// Hash routing
	$effect(() => {
		if (typeof window === 'undefined' || !booted) return;
		const hash = os.activeId || '';
		window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
	});

	// Resize an open VCR window to fit the newly-selected device.
	let prevVcrDevice = vcrPrefs.device;
	$effect(() => {
		const device = vcrPrefs.device;
		if (!booted || device === prevVcrDevice) return;
		prevVcrDevice = device;
		if (os.listWindows().some((w) => w.id === 'vcr')) {
			const def = os.getWindowDef('vcr');
			os.resizeWindow('vcr', def.w, def.h);
		}
	});

	// Window save debounce
	$effect(() => {
		if (!os?.mounted) return;
		const snapshot = os.windows;
		const tid = setTimeout(() => saveWindows(snapshot), 300);
		return () => clearTimeout(tid);
	});

	const chatContextInfo = $derived.by((): string | undefined => {
		if (!booted) return undefined;
		if (os.activeApp.id === 'chatrbot' && os.activeId?.startsWith('chat:')) {
			const showSlug = os.activeId.replace('chat:', '');
			const group = os.groups.find((g) => g.slug === showSlug);
			return group?.name;
		}
		return undefined;
	});

	/** Map real window IDs back to symbolic Dock item IDs for active indicators */
	const dockOpenIds = $derived.by(() => {
		if (!booted) return [];
		const ids = os.windows.map((w) => w.id);
		if (os.windows.some((w) => w.id.startsWith('chat:'))) ids.push('chat');
		if (
			os.windows.some((w) => {
				if (!w.id.startsWith('textedit:')) return false;
				const fileId = w.id.replace('textedit:', '');
				return terminalFs.peekNode(fileId)?.name === 'Pricing.txt';
			})
		)
			ids.push('pricing');
		if (
			os.windows.some((w) => {
				if (!w.id.startsWith('textedit:')) return false;
				const fileId = w.id.replace('textedit:', '');
				return terminalFs.peekNode(fileId)?.name === 'README.TXT';
			})
		)
			ids.push('readme');
		return ids;
	});
</script>

<BootScreen visible={!booted} />

{#if booted}
	{#if os.isMobile}
		<div class="mobile-fallback">
			<h1>terminal<span class="mobile-accent">.bli.net</span></h1>
			<p class="mobile-tagline">Previously on screens…</p>
			<div class="mobile-body">
				<p>
					Terminal is a retro desktop OS that lives in a browser tab. It's built for screens wide
					enough to drag windows around on.
				</p>
				<p>
					Open this on a laptop or desktop to get the full experience — menu bar, draggable windows,
					a TV Guide, and characters you can chat with.
				</p>
			</div>
			<div class="mobile-footer">terminal.bli.net · one tab, one desktop</div>
		</div>
	{:else}
		<div
			class="desktop"
			data-wallpaper={os.tweaks.wallpaper.startsWith('sys7-') ? undefined : os.tweaks.wallpaper}
			style={os.tweaks.wallpaper.startsWith('sys7-')
				? `background: url(/themes/system7/wallpapers/${os.tweaks.wallpaper.replace('sys7-', '')}.png) repeat; image-rendering: pixelated;`
				: ''}
			role="toolbar"
			tabindex="-1"
			onclick={(e) => {
				selectedIconId = null;
				closeDeskCtx();
				if (e.target === e.currentTarget) os.activeId = null;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					selectedIconId = null;
					closeDeskCtx();
				}
			}}
			oncontextmenu={(e) => {
				e.preventDefault();
				closeDeskCtx();
			}}
		>
			<MenuBar
				app={os.activeApp}
				{os}
				openWindows={os.windows.length}
				contextInfo={chatContextInfo}
				now={os.now}
				timezone={os.timezone}
				onSetTimezone={(tz) => os.setTimezone(tz)}
			/>

			{#if !os.isMobile || os.windows.length === 0}
				<div class="desktop-icons left">
					<DesktopIcon
						label="Terminal HD"
						selected={selectedIconId === 'hd'}
						onselect={() => {
							selectedIconId = 'hd';
						}}
						ondblclick={() => os.openWindow('finder')}
						oncontextmenu={(e) => showDesktopCtx(e, { open: () => os.openWindow('finder') })}
					>
						<PixelIcon kind="hd" />
					</DesktopIcon>
				</div>

				<div class="desktop-icons right">
					{#each desktopView?.items ?? [] as node (node.id)}
						<DesktopIcon
							label={node.name}
							alias={node.kind === 'alias'}
							selected={selectedIconId === node.id}
							onselect={() => {
								selectedIconId = node.id;
							}}
							ondblclick={() => openDesktopNode(node)}
							oncontextmenu={(e) => handleDesktopContextMenu(e, node)}
						>
							<PixelIcon kind={desktopIconKind(node)} />
						</DesktopIcon>
					{/each}
					<DesktopIcon
						label="Trash"
						selected={selectedIconId === 'trash'}
						onselect={() => {
							selectedIconId = 'trash';
						}}
						ondblclick={() => os.openWindow('trash')}
						oncontextmenu={(e) => showDesktopCtx(e, { open: () => os.openWindow('trash') })}
					>
						<PixelIcon kind="trash" />
					</DesktopIcon>
				</div>
			{/if}

			<DesktopContextMenu
				visible={deskCtxOpen_ !== null}
				x={deskCtxX}
				y={deskCtxY}
				canAlias={deskCtxCanAlias}
				canTrash={deskCtxCanTrash}
				onopen={deskCtxOpen}
				onalias={deskCtxMakeAlias}
				ontrash={deskCtxTrash}
				onclose={closeDeskCtx}
			/>

			{#each os.windows as w (w.id)}
				{@const def = os.getWindowDef(w.id)}
				<Window
					id={w.id}
					title={def.title}
					x={w.x}
					y={w.y}
					width={w.w}
					height={w.h}
					z={w.z}
					active={os.activeId === w.id}
					chromeless={resolveWindow(w.id)?.spec?.chromeless ?? false}
					minW={def.minW}
					minH={def.minH}
					onfocus={(id) => os.focusWindow(id)}
					onclose={(id) => os.closeWindow(id)}
					onmove={(id, x, y) => os.moveWindow(id, x, y)}
					onresize={(id, ww, hh) => os.resizeWindow(id, ww, hh)}
				>
					{#if isFlatWindow(w.id)}
						<!-- Generic flat-window render path: every window a manifest claims
						     via windows[] renders identically through WindowHost, which
						     resolves the component and context from the matcher. With Finder
						     and Trash migrated, every live window is flat; the {:else} arm is
						     only reachable by a stale/unknown id (Brief 05 finalizes this). -->
						<WindowHost win={w} {os} fs={terminalFs} />
					{:else}
						<div class="window-content">
							<p>Coming soon...</p>
						</div>
					{/if}
				</Window>
			{/each}

			<Dock
				installedApps={terminalFs.getInstalledApps()}
				onopen={(id) => os.openWindow(id)}
				openIds={dockOpenIds}
			/>

			{#if os.alertSpec}
				<div class="system-alert-backdrop" role="presentation" onclick={(e) => e.stopPropagation()}>
					<div
						class="system-alert"
						role="alertdialog"
						tabindex="-1"
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => {
							if (e.key === 'Escape') os.dismissAlert();
						}}
					>
						<div class="system-alert-body">
							<div class="bomb">⚠</div>
							<div style="flex: 1; min-width: 0;">
								<div
									style="font-family: var(--brand-font-display, 'Press Start 2P', monospace); font-size: 11px; margin-bottom: 10px; line-height: 1.4;"
								>
									{os.alertSpec.title}
								</div>
								<div
									style="font-family: var(--brand-font-body, 'VT323', monospace); font-size: 17px; margin-bottom: 14px; line-height: 1.3;"
								>
									{os.alertSpec.body}
								</div>
								{#if os.alertSpec.progress}
									<div class="progress-track">
										<div
											class="progress-fill"
											style="animation-duration: {os.alertSpec.progress.durationMs}ms;"
										></div>
									</div>
								{:else}
									<div style="display: flex; gap: 8px; flex-wrap: wrap;">
										{#each os.alertSpec.buttons || [{ label: 'OK', primary: true }] as b (b.label)}
											<button
												class="btn {b.primary ? 'primary' : ''}"
												onclick={() => {
													os.dismissAlert();
													b.action?.();
												}}>{b.label}</button
											>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.mobile-fallback {
		position: fixed;
		inset: 0;
		background: var(--brand-color-teal);
		color: var(--brand-color-paper);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 24px;
		text-align: center;
		font-family: var(--brand-font-body, 'VT323', monospace);
	}
	.mobile-fallback h1 {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 20px;
		margin: 0 0 8px;
		font-weight: normal;
		letter-spacing: -0.5px;
	}
	.mobile-accent {
		color: var(--brand-color-orange);
	}
	.mobile-tagline {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 24px;
		margin: 0 0 24px;
		opacity: 0.85;
	}
	.mobile-body {
		font-size: 20px;
		line-height: 1.4;
		max-width: 360px;
	}
	.mobile-body p {
		margin: 0 0 12px;
	}
	.mobile-footer {
		margin-top: 32px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		opacity: 0.5;
		letter-spacing: 0.05em;
	}
	.desktop {
		position: fixed;
		inset: 0;
		overflow: hidden;
		cursor: default;
		user-select: none;
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
	}
	.desktop[data-wallpaper='teal'] {
		background-color: #008080;
		background-image:
			linear-gradient(45deg, #5e8585 25%, transparent 25%, transparent 75%, #5e8585 75%),
			linear-gradient(45deg, #5e8585 25%, transparent 25%, transparent 75%, #5e8585 75%);
		background-size:
			4px 4px,
			4px 4px;
		background-position:
			0 0,
			2px 2px;
	}
	.desktop[data-wallpaper='speckle'] {
		background-color: #e8e1d3;
		background-image:
			radial-gradient(circle at 1px 1px, #c8bda6 1px, transparent 1.5px),
			radial-gradient(circle at 3px 5px, #b8a989 1px, transparent 1.5px);
		background-size:
			6px 6px,
			8px 8px;
		background-position:
			0 0,
			2px 3px;
	}
	.desktop[data-wallpaper='yellow'] {
		background-color: #f9bd2b;
		background-image:
			linear-gradient(45deg, #e3aa20 25%, transparent 25%, transparent 75%, #e3aa20 75%),
			linear-gradient(45deg, #e3aa20 25%, transparent 25%, transparent 75%, #e3aa20 75%);
		background-size:
			4px 4px,
			4px 4px;
		background-position:
			0 0,
			2px 2px;
	}
	.desktop[data-wallpaper='pink'] {
		background-color: #ff79c6;
		background-image:
			linear-gradient(45deg, #ee63b3 25%, transparent 25%, transparent 75%, #ee63b3 75%),
			linear-gradient(45deg, #ee63b3 25%, transparent 25%, transparent 75%, #ee63b3 75%);
		background-size:
			4px 4px,
			4px 4px;
		background-position:
			0 0,
			2px 2px;
	}
	.desktop[data-wallpaper='navy'] {
		background-color: #0e1a2b;
		background-image:
			linear-gradient(45deg, #16243a 25%, transparent 25%, transparent 75%, #16243a 75%),
			linear-gradient(45deg, #16243a 25%, transparent 25%, transparent 75%, #16243a 75%);
		background-size:
			4px 4px,
			4px 4px;
		background-position:
			0 0,
			2px 2px;
	}
	.desktop-icons {
		position: absolute;
		top: 40px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		z-index: 1;
	}
	.desktop-icons.left {
		left: 16px;
	}
	.desktop-icons.right {
		right: 16px;
	}
	.window-content {
		padding: 14px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
		line-height: 1.35;
	}

	/* System alert */
	.system-alert-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 20000;
	}
	.system-alert {
		width: 420px;
		max-width: calc(100vw - 40px);
		background: var(--chrome-window-bg, var(--paper, #fff));
		border: 2px solid var(--chrome-window-border-color, var(--ink, #0a0a0a));
		box-shadow: 4px 4px 0 var(--shadow, rgba(0, 0, 0, 0.25));
	}
	.system-alert-body {
		padding: 18px;
		display: flex;
		gap: 14px;
	}

	/* Progress bar */
	.progress-track {
		height: 18px;
		border: 2px solid var(--ink, #0a0a0a);
		background: var(--paper, #fff);
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		width: 100%;
		background: var(--ink, #0a0a0a);
		transform-origin: left;
		animation: progress-fill-anim linear forwards;
	}
	@keyframes progress-fill-anim {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	@media (max-width: 767px) {
		.desktop-icons {
			position: static;
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: center;
			padding: 40px 16px 16px;
			gap: 12px;
		}
		.desktop-icons.right {
			padding-top: 0;
		}
	}
</style>
