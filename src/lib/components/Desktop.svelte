<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { isShowOnAir } from '$lib/schedule';
	import { saveWindows } from '$lib/persistence';
	import { OsApiClass } from '$lib/os/os-api.svelte';
	import {
		TerminalFS,
		LocalStorageManifestStore,
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
	import { APPS } from '$lib/os/app-registry';
	import Window from './Window.svelte';
	import MenuBar from './MenuBar.svelte';
	import DesktopIcon from './DesktopIcon.svelte';
	import PixelIcon from './PixelIcon.svelte';
	import Dock from './Dock.svelte';
	import BootScreen from './BootScreen.svelte';
	import ChatWindow from './ChatWindow.svelte';
	import TVGuide from './TVGuide.svelte';
	import WelcomeWindow from '$lib/apps/welcome/WelcomeWindow.svelte';
	import TextEditWindow from '$lib/apps/textedit/TextEditWindow.svelte';
	import StatsWindow from '$lib/apps/stats/StatsWindow.svelte';
	import ErrorDialog from '$lib/apps/finder/ErrorDialog.svelte';
	import AboutAppWindow from '$lib/apps/finder/AboutAppWindow.svelte';
	import AboutTerminal from '$lib/apps/finder/AboutTerminal.svelte';
	import RecorderWindow from '$lib/apps/recorder/RecorderWindow.svelte';
	import StickiesNote from '$lib/apps/stickies/StickiesNote.svelte';
	import { createStickiesManager } from '$lib/apps/stickies/stickies-manager.svelte';
	import FinderWindow from '$lib/apps/finder/FinderWindow.svelte';
	import TerminalPrefs from './TerminalPrefs.svelte';
	import DesktopContextMenu from './DesktopContextMenu.svelte';
	import { SYS7_PATTERNS } from './wallpaper-patterns';
	import TVGuidePrefs from './TVGuidePrefs.svelte';
	import ChatrbotPrefs from './ChatrbotPrefs.svelte';
	import { getAppWindowId, getAppIconKind } from '$lib/terminalos/apps/app-install';
	import SoftwareShopWindow from '$lib/apps/software-shop/SoftwareShopWindow.svelte';

	let booted = $state(false);
	let os = $state<OsApiClass>(undefined!);
	let terminalFs = $state<TerminalFS>(undefined!);

	let selectedIconId = $state<string | null>(null);

	let stickies = $state<ReturnType<typeof createStickiesManager>>(undefined!);
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
				const id = await stickies.create();
				if (id) os.openWindow(`sticky-${id}`);
				return;
			}
			if (appId === 'system-prefs') {
				os.openSystemPreferences();
				return;
			}
			if (appId === 'about-terminal') {
				os.openAbout(null);
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
		if (file) os.openWindow(`textedit-${file.id}`);
	}

	let cameraRecording = $state(false);

	onMount(async () => {
		const bootStart = Date.now();

		// Open filesystem
		const fs = await TerminalFS.open(new LocalStorageManifestStore());
		terminalFs = fs;

		// Create OS API
		os = new OsApiClass(fs);

		// Initialize stickies manager and desktop folder view
		stickies = createStickiesManager(fs);
		stickies.init();
		desktopView = createFolderView(fs, DESKTOP_ID);

		// Register app launch handlers
		os.registerLaunchHandler('stickies', async (payload) => {
			if (payload?.action === 'new') {
				const id = await stickies.create();
				if (id) os.openWindow(`sticky-${id}`);
				return;
			}
			if (payload?.action === 'color' && payload?.color) {
				if (os.activeId?.startsWith('sticky-')) {
					const noteId = os.activeId.replace('sticky-', '');
					stickies.setColor(noteId, payload.color as string);
				}
				return;
			}
			const id = await stickies.create();
			if (id) os.openWindow(`sticky-${id}`);
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
					if (result.ok) os.openWindow(`textedit-${result.value.id}`);
				});
				return;
			}
			if (payload?.action === 'open') {
				const docs = terminalFs.findByApp('textedit', DOCUMENTS_ID);
				const buttons = docs.map((d) => ({
					label: d.name,
					action: () => os.openWindow(`textedit-${d.id}`)
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

		// Ensure minimum boot time for retro boot ceremony
		const elapsed = Date.now() - bootStart;
		if (elapsed < 1000) {
			await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
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

	// Window save debounce
	$effect(() => {
		if (!os?.mounted) return;
		const snapshot = os.windows;
		const tid = setTimeout(() => saveWindows(snapshot), 300);
		return () => clearTimeout(tid);
	});

	const chatContextInfo = $derived.by((): string | undefined => {
		if (!booted) return undefined;
		if (os.activeApp.id === 'chatrbot' && os.activeId?.startsWith('chat-')) {
			const showSlug = os.activeId.replace('chat-', '');
			const group = os.groups.find((g) => g.slug === showSlug);
			return group?.name;
		}
		return undefined;
	});

	/** Map real window IDs back to symbolic Dock item IDs for active indicators */
	const dockOpenIds = $derived.by(() => {
		if (!booted) return [];
		const ids = os.windows.map((w) => w.id);
		if (os.windows.some((w) => w.id.startsWith('chat-'))) ids.push('chat');
		if (
			os.windows.some((w) => {
				if (!w.id.startsWith('textedit-')) return false;
				const fileId = w.id.replace('textedit-', '');
				return terminalFs.peekNode(fileId)?.name === 'Pricing.txt';
			})
		)
			ids.push('pricing');
		if (
			os.windows.some((w) => {
				if (!w.id.startsWith('textedit-')) return false;
				const fileId = w.id.replace('textedit-', '');
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
			onclick={() => {
				selectedIconId = null;
				closeDeskCtx();
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
				isRecording={cameraRecording}
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
				{@const stickyNote = w.id.startsWith('sticky-')
					? stickies.notes.find((n) => n.id === w.id.replace('sticky-', ''))
					: null}
				<Window
					id={w.id}
					title={stickyNote?.title || def.title}
					x={w.x}
					y={w.y}
					width={w.w}
					height={w.h}
					z={w.z}
					active={os.activeId === w.id}
					chromeless={w.id.startsWith('sticky-')}
					onfocus={(id) => os.focusWindow(id)}
					onclose={(id) => os.closeWindow(id)}
					onmove={(id, x, y) => os.moveWindow(id, x, y)}
					onresize={(id, ww, hh) => os.resizeWindow(id, ww, hh)}
				>
					{#if w.id === 'welcome'}
						<WelcomeWindow onopen={(id) => os.openWindow(id)} />
					{:else if w.id === 'tv-guide'}
						<TVGuide
							groups={os.groups}
							bots={os.bots}
							channels={os.channels}
							timezone={os.timezone}
							now={os.now}
							slotNow={os.slotNow}
							activeChatGroupSlug={os.activeChatGroupSlug}
							gridLoop={os.tweaks.tvGridLoop}
							marqueeLoop={os.tweaks.marqueeLoop}
							pauseOnHover={os.tweaks.tvPauseOnHover}
							onOpenChat={(group) => os.openChat(group)}
							onFocusChat={(slug) => os.focusWindow(`chat-${slug}`)}
						/>
					{:else if w.id.startsWith('chat-')}
						{@const showSlug = w.id.replace('chat-', '')}
						{@const group = os.groups.find((g) => g.slug === showSlug)}
						{@const showBots = os.bots.filter((b) => b.group === showSlug)}
						{#if group && showBots.length > 0}
							<ChatWindow
								{showSlug}
								showName={group.name}
								castBots={showBots}
								minutesLeft={isShowOnAir(group.slug, os.channels, os.now, os.timezone)
									? 30 - (os.now.getMinutes() % 30)
									: null}
								offAir={!isShowOnAir(group.slug, os.channels, os.now, os.timezone)}
							/>
						{/if}
					{:else if w.id === 'terminal-prefs'}
						<TerminalPrefs
							tweaks={os.tweaks}
							{SYS7_PATTERNS}
							onSetTweak={(k, v) => os.setTweak(k, v)}
						/>
					{:else if w.id === 'tvguide-prefs'}
						<TVGuidePrefs tweaks={os.tweaks} onSetTweak={(k, v) => os.setTweak(k, v)} />
					{:else if w.id === 'chatrbot-prefs'}
						<ChatrbotPrefs />
					{:else if w.id.startsWith('textedit-')}
						{@const fileId = w.id.replace('textedit-', '')}
						<TextEditWindow docId={fileId} fs={terminalFs} />
					{:else if w.id === 'about'}
						<AboutTerminal {os} fs={terminalFs} />
					{:else if w.id.startsWith('about-')}
						{@const aboutAppId = w.id.replace('about-', '')}
						{@const aboutApp = APPS[aboutAppId]}
						{#if aboutApp?.about}
							<AboutAppWindow about={aboutApp.about} />
						{/if}
					{:else if w.id === 'software-shop'}
						<SoftwareShopWindow {os} fs={terminalFs} />
					{:else if w.id === 'stats'}
						<StatsWindow
							showCount={os.groups.filter((g) => g.active).length}
							botCount={os.bots.length}
						/>
					{:else if w.id === 'error'}
						<ErrorDialog onclose={() => os.closeWindow('error')} />
					{:else if w.id === 'trash'}
						<FinderWindow {os} fs={terminalFs} folderId={TRASH_ID} />
					{:else if w.id === 'recorder'}
						<RecorderWindow bind:recording={cameraRecording} fs={terminalFs} />
					{:else if w.id.startsWith('recorder-')}
						{@const recFileId = w.id.replace('recorder-', '')}
						{@const recText = terminalFs.readText(recFileId)}
						{#if recText}
							<div class="recording-playback">
								<video src={recText} controls autoplay class="recording-video">
									<track kind="captions" />
								</video>
							</div>
						{:else}
							<div class="window-content">
								<p>Recording not found.</p>
							</div>
						{/if}
					{:else if w.id.startsWith('sticky-')}
						{@const noteId = w.id.replace('sticky-', '')}
						{@const note = stickies.notes.find((n) => n.id === noteId)}
						{#if note}
							<StickiesNote
								{note}
								ondelete={async (id) => {
									await stickies.remove(id);
									os.closeWindow(`sticky-${id}`);
								}}
								onupdate={(n) => stickies.update(n)}
							/>
						{/if}
					{:else if w.id === 'finder'}
						<FinderWindow {os} fs={terminalFs} />
					{:else}
						<div class="window-content">
							<p>Coming soon...</p>
						</div>
					{/if}
				</Window>
			{/each}

			<Dock onopen={(id) => os.openWindow(id)} openIds={dockOpenIds} />

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
										{#each os.alertSpec.buttons || [{ label: 'OK', primary: true }] as b}
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

	/* Recording playback */
	.recording-playback {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		background: var(--brand-color-ink, #000);
	}
	.recording-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
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
