<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { isShowOnAir } from '$lib/schedule';
	import { saveWindows, appRead } from '$lib/persistence';
	import { OsApiClass } from '$lib/os/os-api.svelte';
	import { TerminalFS, LocalStorageManifestStore } from '$lib/terminalos';
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
	import { findDocByName } from '$lib/apps/textedit/textedit-docs';
	import {
		readFile,
		findByApp,
		createFile,
		writeFile,
		deleteNode,
		trash,
		createAlias,
		list,
		resolveAlias,
		onFsChange,
		ensureSystemFolders,
		DOCS_ID,
		DESKTOP_ID,
		ROOT_ID,
		SYSTEM_ID,
		APPS_ID,
		RECORDINGS_ID,
		TRASH_ID
	} from '$lib/os/filesystem';
	import type { FSFile, FSNode } from '$lib/os/filesystem';
	import StatsWindow from '$lib/apps/stats/StatsWindow.svelte';
	import ErrorDialog from '$lib/apps/finder/ErrorDialog.svelte';
	import AboutAppWindow from '$lib/apps/finder/AboutAppWindow.svelte';
	import AboutTerminal from '$lib/apps/finder/AboutTerminal.svelte';
	import RecorderWindow from '$lib/apps/recorder/RecorderWindow.svelte';
	import StickiesNote from '$lib/apps/stickies/StickiesNote.svelte';
	import type { StickyNote } from '$lib/apps/stickies/StickiesNote.svelte';
	import FinderWindow from '$lib/apps/finder/FinderWindow.svelte';
	import TerminalPrefs from './TerminalPrefs.svelte';
	import TVGuidePrefs from './TVGuidePrefs.svelte';
	import ChatrbotPrefs from './ChatrbotPrefs.svelte';
	import { getAppWindowId, getAppIconKind } from '$lib/terminalos/apps/app-install';
	import SoftwareShopWindow from '$lib/apps/software-shop/SoftwareShopWindow.svelte';

	const SYS7_PATTERNS = [
		'128',
		'129',
		'130',
		'131',
		'132',
		'133',
		'134',
		'136',
		'137',
		'139',
		'141',
		'142',
		'144',
		'145',
		'146',
		'147',
		'148',
		'149',
		'150',
		'151',
		'547',
		'870',
		'987',
		'1111',
		'1969',
		'1970',
		'1971',
		'1972',
		'1973',
		'1974',
		'1975',
		'1976',
		'1977',
		'1978',
		'2767',
		'3727',
		'4193',
		'6006',
		'6741',
		'7041',
		'7321',
		'7344',
		'7527',
		'8388',
		'8448',
		'9695',
		'10042',
		'11703',
		'12484',
		'12593',
		'12821',
		'13096',
		'13665',
		'16825',
		'16974',
		'17803',
		'18078',
		'19688',
		'20318',
		'20446',
		'21225',
		'22348',
		'23295',
		'24517',
		'24642',
		'24817',
		'28851',
		'28920',
		'29907',
		'30711',
		'30930',
		'31689',
		'32307',
		'32623'
	];

	let booted = $state(false);
	let os = $state<OsApiClass>(undefined!);

	let selectedIconId = $state<string | null>(null);

	let stickyNotes = $state<StickyNote[]>([]);
	let desktopItems = $state<FSNode[]>([]);
	let desktopFsRev = $state(0);

	function stickyFromFile(f: FSFile): StickyNote {
		try {
			const parsed = JSON.parse(f.data) as { title?: string; body?: string; color?: string };
			return {
				id: f.id,
				title: parsed.title ?? '',
				body: parsed.body ?? '',
				color: parsed.color ?? '#f9bd2b'
			};
		} catch {
			return { id: f.id, title: '', body: '', color: '#f9bd2b' };
		}
	}

	function loadStickyNotes(): StickyNote[] {
		const files = findByApp('stickies');
		if (files.length > 0) return files.map(stickyFromFile);

		// Migrate from legacy appRead persistence if present
		const legacy = appRead<StickyNote[] | null>('stickies', 'notes', null);
		if (legacy && legacy.length > 0) {
			const migrated: StickyNote[] = [];
			for (const note of legacy) {
				const name = note.title || 'Untitled Note';
				const data = JSON.stringify({ title: note.title, body: note.body, color: note.color });
				try {
					const file = createFile(DOCS_ID, name, 'stickies', data);
					migrated.push({ ...note, id: file.id });
				} catch {
					// duplicate name -- append a suffix
					const file = createFile(DOCS_ID, `${name} (${note.id.slice(-4)})`, 'stickies', data);
					migrated.push({ ...note, id: file.id });
				}
			}
			return migrated;
		}

		// Seed a default note for first-time users
		const defaultData = JSON.stringify({
			title: 'v1 launch — todo',
			body: '☑ ship Seinfeld\n☑ ship The Office\n☒ get sued\n☐ teach Kramer to type\n☐ figure out Joey/Phoebe\n☐ "try Succession?"',
			color: '#f9bd2b'
		});
		const file = createFile(DOCS_ID, 'v1 launch — todo', 'stickies', defaultData);
		return [stickyFromFile(file)];
	}

	function refreshStickyNotes() {
		stickyNotes = findByApp('stickies').map(stickyFromFile);
	}

	function createStickyNote() {
		let name = 'Untitled Note';
		let suffix = 1;
		const existing = findByApp('stickies');
		const names = new Set(existing.map((f) => f.name));
		while (names.has(name)) {
			suffix++;
			name = `Untitled Note ${suffix}`;
		}
		const data = JSON.stringify({ title: '', body: '', color: '#f9bd2b' });
		const file = createFile(DOCS_ID, name, 'stickies', data);
		refreshStickyNotes();
		os.openWindow(`sticky-${file.id}`);
	}

	function deleteStickyNote(id: string) {
		deleteNode(id);
		refreshStickyNotes();
		os.closeWindow(`sticky-${id}`);
	}

	function updateStickyNote(updated: StickyNote) {
		const data = JSON.stringify({ title: updated.title, body: updated.body, color: updated.color });
		try {
			writeFile(updated.id, data);
		} catch {
			// file may have been deleted
		}
		refreshStickyNotes();
	}

	function colorStickyNote(noteId: string, color: string) {
		const note = stickyNotes.find((n) => n.id === noteId);
		if (!note) return;
		updateStickyNote({ ...note, color });
	}

	function openDesktopNode(node: FSNode) {
		if (node.type === 'alias') {
			const target = resolveAlias(node);
			if (target) openDesktopNode(target);
			return;
		}
		if (node.type === 'file') {
			const file = node as FSFile;
			const appId = file.appId;
			if (!appId) {
				os.openWindow(file.id);
				return;
			}
			// Special apps need their own handling
			if (appId === 'stickies') {
				createStickyNote();
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

	function desktopIconKind(node: FSNode): string {
		if (node.type === 'alias') {
			const target = resolveAlias(node);
			if (target) return desktopIconKind(target);
			return 'doc';
		}
		if (node.type === 'file') {
			const file = node as FSFile;
			if (file.appId) return getAppIconKind(file.appId);
			return 'doc';
		}
		return 'doc';
	}

	let deskCtxNode = $state<FSNode | null>(null);
	let deskCtxOpen_: (() => void) | null = $state(null);
	let deskCtxCanAlias = $state(false);
	let deskCtxCanTrash = $state(false);
	let deskCtxX = $state(0);
	let deskCtxY = $state(0);
	let deskCtxEl = $state<HTMLDivElement | null>(null);

	const PROTECTED_DESKTOP_IDS = new Set([
		ROOT_ID,
		SYSTEM_ID,
		APPS_ID,
		DESKTOP_ID,
		RECORDINGS_ID,
		TRASH_ID
	]);

	function showDesktopCtx(
		e: MouseEvent,
		opts: { open: () => void; node?: FSNode; canAlias?: boolean; canTrash?: boolean }
	) {
		deskCtxNode = opts.node ?? null;
		deskCtxOpen_ = opts.open;
		deskCtxCanAlias = opts.canAlias ?? false;
		deskCtxCanTrash = opts.canTrash ?? false;
		deskCtxX = e.clientX;
		deskCtxY = e.clientY;
		requestAnimationFrame(() => {
			if (!deskCtxEl) return;
			const rect = deskCtxEl.getBoundingClientRect();
			if (rect.right > window.innerWidth) deskCtxX = e.clientX - rect.width;
			if (rect.bottom > window.innerHeight) deskCtxY = e.clientY - rect.height;
		});
	}

	function handleDesktopContextMenu(e: MouseEvent, node: FSNode) {
		showDesktopCtx(e, {
			open: () => openDesktopNode(node),
			node,
			canAlias: node.type === 'file',
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

	function deskCtxMakeAlias() {
		if (!deskCtxNode) return;
		try {
			createAlias(DESKTOP_ID, deskCtxNode.name + ' alias', deskCtxNode.id);
		} catch {
			/* alias already exists */
		}
		closeDeskCtx();
	}

	function deskCtxTrash() {
		if (!deskCtxNode) return;
		trash(deskCtxNode.id);
		closeDeskCtx();
	}

	function openTextEditFile(name: string) {
		const file = findDocByName(name);
		if (file) os.openWindow(`textedit-${file.id}`);
	}

	let cameraRecording = $state(false);

	onMount(async () => {
		const bootStart = Date.now();

		// Open filesystem
		const fs = await TerminalFS.open(new LocalStorageManifestStore());

		// Create OS API
		os = new OsApiClass(fs);

		// Load stickies and desktop items (still uses compat shim)
		ensureSystemFolders();
		stickyNotes = loadStickyNotes();
		desktopItems = list(DESKTOP_ID);

		// Register app launch handlers
		os.registerLaunchHandler('stickies', (payload) => {
			if (payload?.action === 'new') {
				createStickyNote();
				return;
			}
			if (payload?.action === 'color' && payload?.color) {
				if (os.activeId?.startsWith('sticky-')) {
					const noteId = os.activeId.replace('sticky-', '');
					colorStickyNote(noteId, payload.color as string);
				}
				return;
			}
			createStickyNote();
		});

		os.registerLaunchHandler('textedit', (payload) => {
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

	// Filesystem change watcher (stays the same -- still uses compat shim)
	$effect(() =>
		onFsChange(() => {
			desktopFsRev++;
		})
	);

	$effect(() => {
		desktopFsRev;
		if (booted) desktopItems = list(DESKTOP_ID);
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
				const file = readFile(fileId);
				return file?.name === 'Pricing.txt';
			})
		)
			ids.push('pricing');
		if (
			os.windows.some((w) => {
				if (!w.id.startsWith('textedit-')) return false;
				const fileId = w.id.replace('textedit-', '');
				const file = readFile(fileId);
				return file?.name === 'README.TXT';
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
					{#each desktopItems as node (node.id)}
						<DesktopIcon
							label={node.name}
							alias={node.type === 'alias'}
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

			{#if deskCtxOpen_}
				<div
					class="desktop-context-menu"
					role="menu"
					tabindex="-1"
					bind:this={deskCtxEl}
					style="left: {deskCtxX}px; top: {deskCtxY}px;"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => {
						if (e.key === 'Escape') {
							closeDeskCtx();
						}
					}}
				>
					<button class="desktop-context-item" onclick={deskCtxOpen}>Open</button>
					{#if deskCtxCanAlias}
						<div class="desktop-context-sep"></div>
						<button class="desktop-context-item" onclick={deskCtxMakeAlias}>Make Alias</button>
					{/if}
					{#if deskCtxCanTrash}
						<div class="desktop-context-sep"></div>
						<button class="desktop-context-item" onclick={deskCtxTrash}>Move to Trash</button>
					{/if}
				</div>
			{/if}

			{#each os.windows as w (w.id)}
				{@const def = os.getWindowDef(w.id)}
				{@const stickyNote = w.id.startsWith('sticky-')
					? stickyNotes.find((n) => n.id === w.id.replace('sticky-', ''))
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
						<TextEditWindow docId={fileId} />
					{:else if w.id === 'about'}
						<AboutTerminal {os} />
					{:else if w.id.startsWith('about-')}
						{@const aboutAppId = w.id.replace('about-', '')}
						{@const aboutApp = APPS[aboutAppId]}
						{#if aboutApp?.about}
							<AboutAppWindow about={aboutApp.about} />
						{/if}
					{:else if w.id === 'software-shop'}
						<SoftwareShopWindow {os} />
					{:else if w.id === 'stats'}
						<StatsWindow
							showCount={os.groups.filter((g) => g.active).length}
							botCount={os.bots.length}
						/>
					{:else if w.id === 'error'}
						<ErrorDialog onclose={() => os.closeWindow('error')} />
					{:else if w.id === 'trash'}
						<FinderWindow {os} folderId="trash" />
					{:else if w.id === 'recorder'}
						<RecorderWindow bind:recording={cameraRecording} />
					{:else if w.id.startsWith('recorder-')}
						{@const recFileId = w.id.replace('recorder-', '')}
						{@const recFile = readFile(recFileId)}
						{#if recFile?.data}
							<div class="recording-playback">
								<video src={recFile.data} controls autoplay class="recording-video">
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
						{@const note = stickyNotes.find((n) => n.id === noteId)}
						{#if note}
							<StickiesNote {note} ondelete={deleteStickyNote} onupdate={updateStickyNote} />
						{/if}
					{:else if w.id === 'finder'}
						<FinderWindow {os} />
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
						class="system-alert window"
						role="alertdialog"
						tabindex="-1"
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => {
							if (e.key === 'Escape') os.dismissAlert();
						}}
					>
						<div class="window-titlebar" style="cursor: default;">
							<div class="btns">
								<button
									class="window-btn close"
									onclick={() => os.dismissAlert()}
									aria-label="close"
								></button>
							</div>
							<div class="title">{os.alertSpec.title || 'System Alert'}</div>
						</div>
						<div class="window-body" style="padding: 18px; display: flex; gap: 14px;">
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
	.desktop-context-menu {
		position: fixed;
		background: var(--chrome-menubar-bg, var(--paper));
		color: var(--chrome-menubar-fg, var(--ink));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		box-shadow: 3px 3px 0 var(--shadow);
		min-width: 160px;
		padding: 4px 0;
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		font-size: 14px;
		z-index: 12000;
	}
	.desktop-context-item {
		padding: 4px 12px;
		cursor: pointer;
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		text-align: left;
		width: 100%;
	}
	.desktop-context-item:hover {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}
	.desktop-context-sep {
		height: 1px;
		background: var(--chrome-menubar-fg, var(--ink));
		margin: 4px 8px;
		opacity: 0.2;
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
	:global(.system-alert) {
		position: relative !important;
		width: 420px;
		max-width: calc(100vw - 40px);
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
