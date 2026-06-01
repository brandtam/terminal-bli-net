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
	import { getAppIconKind } from '$lib/terminalos/apps/app-install';
	import { matchWindow } from '$lib/terminalos/apps/app-catalog';
	import { vcrPrefs } from '$lib/apps/vcr/vcr-prefs.svelte';
	import { openFilesystemNode } from '$lib/os/filesystem-open';
	import {
		canDragFilesystemNode,
		canDropFilesystemNode,
		clearFilesystemDragNode,
		performFilesystemDrop,
		readFilesystemDragNodeId,
		writeFilesystemDragNode,
		type FilesystemDropTarget
	} from '$lib/os/filesystem-drag';

	// matchWindow is the sole render gate: a window-id renders iff a manifest claims
	// it via windows[]. Every window goes through the one WindowHost path, which
	// lazy-loads the app's chunk when the window opens (see manifests.ts). The OS
	// has no app-specific render branch — adding an app is a manifest entry only.
	const isFlatWindow = (id: string) => matchWindow(id) !== null;

	let booted = $state(false);
	let os = $state<OsApiClass>(undefined!);
	let terminalFs = $state<TerminalFS>(undefined!);

	let selectedIconId = $state<string | null>(null);

	let desktopView: ReturnType<typeof createFolderView> | null = $state(null);
	let desktopDropActive = $state(false);
	let trashDropActive = $state(false);

	function resolveAliasSync(node: FsNode, seen: readonly string[] = []): FsNode | null {
		if (node.kind !== 'alias') return null;
		const alias = node as FsAlias;
		if (seen.includes(alias.id)) return null;
		const visited = [...seen, alias.id];
		const target = terminalFs.peekNode(alias.target.nodeId);
		if (!target) return null;
		if (target.kind === 'alias') return resolveAliasSync(target, visited);
		return target;
	}

	function openDesktopNode(node: FsNode) {
		openFilesystemNode(node, {
			resolveAlias: (alias) => resolveAliasSync(alias),
			openFolder: (folder) => {
				os.openWindow(folder.id === TRASH_ID ? 'trash' : 'finder');
			},
			launchApp: (appId) => os.launchApp(appId),
			openDocument: (file) => os.openDocument(file)
		});
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

	function containsDragRelatedTarget(e: DragEvent): boolean {
		const related = e.relatedTarget;
		return related instanceof Node && (e.currentTarget as HTMLElement).contains(related);
	}

	function clearDropTarget() {
		desktopDropActive = false;
		trashDropActive = false;
		clearFilesystemDragNode();
	}

	function reportDropResult(result: Awaited<ReturnType<typeof performFilesystemDrop>>) {
		if (result.ok) return;
		os.alert({
			title: 'Move Failed',
			body: result.error.message,
			buttons: [{ label: 'OK', primary: true }]
		});
	}

	function draggedNode(e: DragEvent): FsNode | null {
		const nodeId = readFilesystemDragNodeId(e.dataTransfer);
		return nodeId ? (terminalFs.peekNode(nodeId) ?? null) : null;
	}

	function targetAllowsDrop(e: DragEvent, target: FilesystemDropTarget): boolean {
		const node = draggedNode(e);
		return node ? canDropFilesystemNode(node, target) : false;
	}

	function dropOriginIsDesktopSurface(e: DragEvent): boolean {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return false;
		return !target.closest(
			'.window, .dock, .menubar, .desktop-icon, .desktop-context-menu, .system-alert-backdrop'
		);
	}

	function handleDesktopDragStart(e: DragEvent, node: FsNode) {
		if (!writeFilesystemDragNode(e.dataTransfer, node)) {
			e.preventDefault();
			return;
		}
		selectedIconId = node.id;
		closeDeskCtx();
	}

	function handleDesktopDragOver(e: DragEvent) {
		const target: FilesystemDropTarget = { kind: 'folder', folderId: DESKTOP_ID };
		if (!dropOriginIsDesktopSurface(e) || !targetAllowsDrop(e, target)) {
			desktopDropActive = false;
			return;
		}
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		desktopDropActive = true;
		trashDropActive = false;
	}

	function handleDesktopDragLeave(e: DragEvent) {
		if (!containsDragRelatedTarget(e)) desktopDropActive = false;
	}

	async function handleDesktopDrop(e: DragEvent) {
		const nodeId = readFilesystemDragNodeId(e.dataTransfer);
		const target: FilesystemDropTarget = { kind: 'folder', folderId: DESKTOP_ID };
		if (!nodeId || !dropOriginIsDesktopSurface(e) || !targetAllowsDrop(e, target)) {
			clearDropTarget();
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		clearDropTarget();
		selectedIconId = nodeId;
		reportDropResult(await performFilesystemDrop(terminalFs, nodeId, target));
	}

	function handleTrashDragOver(e: DragEvent) {
		const target: FilesystemDropTarget = { kind: 'trash' };
		if (!targetAllowsDrop(e, target)) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		trashDropActive = true;
		desktopDropActive = false;
	}

	function handleTrashDragLeave(e: DragEvent) {
		if (!containsDragRelatedTarget(e)) trashDropActive = false;
	}

	async function handleTrashDrop(e: DragEvent) {
		const nodeId = readFilesystemDragNodeId(e.dataTransfer);
		const target: FilesystemDropTarget = { kind: 'trash' };
		if (!nodeId || !targetAllowsDrop(e, target)) return;
		e.preventDefault();
		e.stopPropagation();
		clearDropTarget();
		selectedIconId = null;
		reportDropResult(await performFilesystemDrop(terminalFs, nodeId, target));
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
			class:drop-active={desktopDropActive}
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
			ondragover={handleDesktopDragOver}
			ondragleave={handleDesktopDragLeave}
			ondrop={handleDesktopDrop}
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
							draggable={canDragFilesystemNode(node)}
							onselect={() => {
								selectedIconId = node.id;
							}}
							ondblclick={() => openDesktopNode(node)}
							oncontextmenu={(e) => handleDesktopContextMenu(e, node)}
							ondragstart={(e) => handleDesktopDragStart(e, node)}
							ondragend={clearDropTarget}
						>
							<PixelIcon kind={desktopIconKind(node)} />
						</DesktopIcon>
					{/each}
					<DesktopIcon
						label="Trash"
						selected={selectedIconId === 'trash'}
						dropTarget={trashDropActive}
						onselect={() => {
							selectedIconId = 'trash';
						}}
						ondblclick={() => os.openWindow('trash')}
						oncontextmenu={(e) => showDesktopCtx(e, { open: () => os.openWindow('trash') })}
						ondragover={handleTrashDragOver}
						ondragleave={handleTrashDragLeave}
						ondrop={handleTrashDrop}
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
					chromeless={resolveWindow(w.id)?.spec.chromeless ?? false}
					minW={def.minW}
					minH={def.minH}
					onfocus={(id) => os.focusWindow(id)}
					onclose={(id) => os.closeWindow(id)}
					onmove={(id, x, y) => os.moveWindow(id, x, y)}
					onresize={(id, ww, hh) => os.resizeWindow(id, ww, hh)}
				>
					{#if isFlatWindow(w.id)}
						<!-- The single render path. Every window a manifest claims via
						     windows[] renders through WindowHost, which resolves the component
						     and context from matchWindow — the OS holds zero app-specific
						     render branches. The {:else} arm is unreachable for any live id
						     (matchWindow gates isFlatWindow); it only catches a stale/unknown
						     saved id that slipped past the restore filter. -->
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
	.desktop.drop-active::after {
		content: '';
		position: fixed;
		inset: 30px 10px 10px;
		border: 2px dashed var(--paper);
		background: rgba(255, 255, 255, 0.08);
		pointer-events: none;
		z-index: 0;
	}
	.desktop[data-wallpaper='teal'] {
		background-color: var(--wallpaper-teal-base);
		background-image:
			linear-gradient(
				45deg,
				var(--wallpaper-teal-dither) 25%,
				transparent 25%,
				transparent 75%,
				var(--wallpaper-teal-dither) 75%
			),
			linear-gradient(
				45deg,
				var(--wallpaper-teal-dither) 25%,
				transparent 25%,
				transparent 75%,
				var(--wallpaper-teal-dither) 75%
			);
		background-size:
			4px 4px,
			4px 4px;
		background-position:
			0 0,
			2px 2px;
	}
	.desktop[data-wallpaper='speckle'] {
		background-color: var(--wallpaper-speckle-base);
		background-image:
			radial-gradient(circle at 1px 1px, var(--wallpaper-speckle-dot-1) 1px, transparent 1.5px),
			radial-gradient(circle at 3px 5px, var(--wallpaper-speckle-dot-2) 1px, transparent 1.5px);
		background-size:
			6px 6px,
			8px 8px;
		background-position:
			0 0,
			2px 3px;
	}
	.desktop[data-wallpaper='yellow'] {
		background-color: var(--wallpaper-yellow-base);
		background-image:
			linear-gradient(
				45deg,
				var(--wallpaper-yellow-dither) 25%,
				transparent 25%,
				transparent 75%,
				var(--wallpaper-yellow-dither) 75%
			),
			linear-gradient(
				45deg,
				var(--wallpaper-yellow-dither) 25%,
				transparent 25%,
				transparent 75%,
				var(--wallpaper-yellow-dither) 75%
			);
		background-size:
			4px 4px,
			4px 4px;
		background-position:
			0 0,
			2px 2px;
	}
	.desktop[data-wallpaper='pink'] {
		background-color: var(--wallpaper-pink-base);
		background-image:
			linear-gradient(
				45deg,
				var(--wallpaper-pink-dither) 25%,
				transparent 25%,
				transparent 75%,
				var(--wallpaper-pink-dither) 75%
			),
			linear-gradient(
				45deg,
				var(--wallpaper-pink-dither) 25%,
				transparent 25%,
				transparent 75%,
				var(--wallpaper-pink-dither) 75%
			);
		background-size:
			4px 4px,
			4px 4px;
		background-position:
			0 0,
			2px 2px;
	}
	.desktop[data-wallpaper='navy'] {
		background-color: var(--wallpaper-navy-base);
		background-image:
			linear-gradient(
				45deg,
				var(--wallpaper-navy-dither) 25%,
				transparent 25%,
				transparent 75%,
				var(--wallpaper-navy-dither) 75%
			),
			linear-gradient(
				45deg,
				var(--wallpaper-navy-dither) 25%,
				transparent 25%,
				transparent 75%,
				var(--wallpaper-navy-dither) 75%
			);
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
