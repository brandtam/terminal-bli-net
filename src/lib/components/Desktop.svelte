<script lang="ts">
	import { onMount } from 'svelte';
	import type { Bot, Channel, GroupMeta, WindowState, TweaksState } from '$lib/types';
	import type { OsApi, AlertSpec } from '$lib/os/os-api';
	import { windowAppId } from '$lib/os/os-api';
	import { APPS } from '$lib/os/app-registry';
	import { isShowOnAir, getSlotIndex } from '$lib/schedule';
	import {
		loadWindows,
		saveWindows,
		loadTweaks,
		saveTweaks,
		loadTimezone,
		saveTimezone,
		isFirstVisit,
		appRead,
		appWrite
	} from '$lib/persistence';
	import Window from './Window.svelte';
	import MenuBar from './MenuBar.svelte';
	import DesktopIcon from './DesktopIcon.svelte';
	import PixelIcon from './PixelIcon.svelte';
	import Dock from './Dock.svelte';
	import ChatWindow from './ChatWindow.svelte';
	import TVGuide from './TVGuide.svelte';
	import WelcomeWindow from '$lib/apps/welcome/WelcomeWindow.svelte';
	import TextEditWindow from '$lib/apps/textedit/TextEditWindow.svelte';
	import { findDocByName } from '$lib/apps/textedit/textedit-docs';
	import { readFile } from '$lib/os/filesystem';
	import StatsWindow from '$lib/apps/stats/StatsWindow.svelte';
	import ErrorDialog from '$lib/apps/finder/ErrorDialog.svelte';
	import TrashWindow from '$lib/apps/finder/TrashWindow.svelte';
	import AboutAppWindow from '$lib/apps/finder/AboutAppWindow.svelte';
	import RecorderWindow from '$lib/apps/recorder/RecorderWindow.svelte';
	import StickiesNote from '$lib/apps/stickies/StickiesNote.svelte';
	import type { StickyNote } from '$lib/apps/stickies/StickiesNote.svelte';
	import FinderWindow from '$lib/apps/finder/FinderWindow.svelte';
	import { seedFilesystem } from '$lib/os/filesystem-seed';

	const SYS7_PATTERNS = [
		'128', '129', '130', '131', '132', '133', '134', '136', '137', '139',
		'141', '142', '144', '145', '146', '147', '148', '149', '150', '151',
		'547', '870', '987', '1111', '1969', '1970', '1971', '1972', '1973',
		'1974', '1975', '1976', '1977', '1978', '2767', '3727', '4193', '6006',
		'6741', '7041', '7321', '7344', '7527', '8388', '8448', '9695', '10042',
		'11703', '12484', '12593', '12821', '13096', '13665', '16825', '16974',
		'17803', '18078', '19688', '20318', '20446', '21225', '22348', '23295',
		'24517', '24642', '24817', '28851', '28920', '29907', '30711', '30930',
		'31689', '32307', '32623'
	];

	let groups = $state<GroupMeta[]>([]);
	let bots = $state<Bot[]>([]);
	let channels = $state<Channel[]>([]);
	let windows = $state<WindowState[]>([]);
	let zCounter = $state(10);
	let activeId = $state<string | null>(null);
	let mounted = $state(false);
	let tweaks = $state<TweaksState>({
		wallpaper: 'teal',
		accent: '#f54e00',
		tvGridLoop: 400,
		marqueeLoop: 100,
		tvPauseOnHover: false
	});
	let timezone = $state<string | undefined>(undefined);
	let now = $state(new Date());
	let isMobile = $state(false);

	const DEFAULT_NOTES: StickyNote[] = [
		{
			id: 'default-1',
			title: 'v1 launch — todo',
			body: '☑ ship Seinfeld\n☑ ship The Office\n☒ get sued\n☐ teach Kramer to type\n☐ figure out Joey/Phoebe\n☐ "try Succession?"',
			color: '#f9bd2b'
		}
	];

	let stickyNotes = $state<StickyNote[]>([]);

	function loadStickyNotes(): StickyNote[] {
		return appRead<StickyNote[]>('stickies', 'notes', DEFAULT_NOTES);
	}

	function saveStickyNotes() {
		appWrite('stickies', 'notes', stickyNotes);
	}

	function createStickyNote() {
		const note: StickyNote = {
			id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			title: '',
			body: '',
			color: '#f9bd2b'
		};
		stickyNotes = [...stickyNotes, note];
		saveStickyNotes();
		openWindow(`sticky-${note.id}`);
	}

	function deleteStickyNote(id: string) {
		stickyNotes = stickyNotes.filter(n => n.id !== id);
		saveStickyNotes();
		closeWindow(`sticky-${id}`);
	}

	function updateStickyNote(updated: StickyNote) {
		stickyNotes = stickyNotes.map(n => n.id === updated.id ? updated : n);
		saveStickyNotes();
	}

	function colorStickyNote(noteId: string, color: string) {
		stickyNotes = stickyNotes.map(n => n.id === noteId ? { ...n, color } : n);
		saveStickyNotes();
	}

	onMount(() => {
		tweaks = loadTweaks();
		timezone = loadTimezone() || Intl.DateTimeFormat().resolvedOptions().timeZone;
		isMobile = window.innerWidth < 720;
		stickyNotes = loadStickyNotes();
		seedFilesystem(); // seed filesystem default files

		fetch('/api/data')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data) {
					groups = (data as { groups: GroupMeta[]; bots: Bot[]; channels: Channel[] }).groups;
					bots = (data as { groups: GroupMeta[]; bots: Bot[]; channels: Channel[] }).bots;
					channels = (data as { groups: GroupMeta[]; bots: Bot[]; channels: Channel[] }).channels;
				}
			})
			.catch(() => {});

		const saved = loadWindows();
		if (saved.length > 0) {
			windows = saved;
			zCounter = Math.max(zCounter, ...saved.map((w) => w.z));
		} else if (isFirstVisit()) {
			openWindow('tv-guide');
		}

		const hash = window.location.hash.slice(1);
		if (hash && isKnownWindowId(hash)) {
			openWindow(hash);
		}

		const tick = setInterval(() => {
			now = new Date();
		}, 1000);

		const handleResize = () => {
			isMobile = window.innerWidth < 720;
		};
		window.addEventListener('resize', handleResize);

		const handleKeydown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey)) return;
			const key = e.key.toLowerCase();
			if (key === 'g') {
				e.preventDefault();
				openWindow('tv-guide');
			} else if (key === 'w') {
				e.preventDefault();
				if (activeId) closeWindow(activeId);
			} else if (key === 'n') {
				e.preventDefault();
				const app = APPS[activeId ? windowAppId(activeId) : 'finder'];
				const menus = app?.menus(os) ?? [];
				const fileMenu = menus.find((m) => m.label === 'File');
				const newItem = fileMenu?.items.find((it) => it.type === 'action' && it.shortcut === '⌘N');
				if (newItem && newItem.type === 'action' && newItem.action) newItem.action(os);
				else openWindow('tv-guide');
			} else if (key === ',') {
				e.preventDefault();
				const appId = activeId ? windowAppId(activeId) : 'finder';
				const app = APPS[appId];
				if (app?.preferences) os.openPreferences(appId);
				else os.openTweaks();
			}
		};
		window.addEventListener('keydown', handleKeydown);

		mounted = true;

		return () => {
			clearInterval(tick);
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	$effect(() => {
		document.documentElement.style.setProperty('--accent', tweaks.accent);
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const hash = activeId || '';
		window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
	});

	$effect(() => {
		if (!mounted) return;
		saveWindows(windows);
	});

	const KNOWN_WINDOW_IDS = new Set([
		'welcome', 'tv-guide', 'terminal-prefs', 'tvguide-prefs', 'chatrbot-prefs',
		'about', 'about-chatrbot', 'about-tvguide',
		'about-textedit', 'about-stats', 'about-stickies', 'about-recorder',
		'stats', 'error', 'trash', 'recorder', 'finder'
	]);

	function isKnownWindowId(id: string): boolean {
		return KNOWN_WINDOW_IDS.has(id) || id.startsWith('chat-') || id.startsWith('sticky-') || id.startsWith('textedit-');
	}

	function getWindowDef(id: string): { title: string; w: number; h: number } {
		const defs: Record<string, { title: string; w: number; h: number }> = {
			welcome: { title: 'Welcome.app', w: 460, h: 540 },
			'tv-guide': { title: 'TV Guide.app', w: 660, h: 700 },
			'terminal-prefs': { title: 'Terminal Preferences', w: 380, h: 360 },
			'tvguide-prefs': { title: 'TV Guide Preferences', w: 360, h: 360 },
			'chatrbot-prefs': { title: 'chatrbot Preferences', w: 360, h: 280 },
			about: { title: 'About Terminal', w: 420, h: 480 },
			'about-chatrbot': { title: 'About chatrbot', w: 420, h: 460 },
			'about-tvguide': { title: 'About TV Guide', w: 420, h: 460 },
			'about-textedit': { title: 'About TextEdit', w: 420, h: 380 },
			'about-stats': { title: 'About Stats', w: 420, h: 360 },
			'about-stickies': { title: 'About Stickies', w: 420, h: 380 },
			stats: { title: 'Stats.app', w: 360, h: 360 },
			error: { title: 'System Error', w: 420, h: 260 },
			trash: { title: 'Trash — empty', w: 380, h: 320 },
			recorder: { title: 'Camera.app', w: 360, h: 480 },
			'about-recorder': { title: 'About Recorder', w: 420, h: 360 },
			finder: { title: 'Terminal HD', w: 480, h: 420 }
		};
		if (id.startsWith('chat-')) {
			const showSlug = id.replace('chat-', '');
			const group = groups.find((g) => g.slug === showSlug);
			return {
				title: group ? `chatrbot - ${group.name}` : 'Chat',
				w: 440,
				h: 560
			};
		}
		if (id.startsWith('textedit-')) {
			const fileId = id.replace('textedit-', '');
			const file = readFile(fileId);
			return {
				title: file?.name || 'Untitled.txt',
				w: 420,
				h: 400
			};
		}
		if (id.startsWith('sticky-')) {
			const noteId = id.replace('sticky-', '');
			const note = stickyNotes.find((n) => n.id === noteId);
			return {
				title: note?.title || 'Stickies',
				w: 240,
				h: 220
			};
		}
		return defs[id] || { title: 'Unknown', w: 380, h: 320 };
	}

	function focusWindow(id: string) {
		activeId = id;
		zCounter++;
		windows = windows.map((w) => (w.id === id ? { ...w, z: zCounter } : w));
	}

	function moveWindow(id: string, x: number, y: number) {
		windows = windows.map((w) => (w.id === id ? { ...w, x, y } : w));
	}

	function resizeWindow(id: string, w: number, h: number) {
		windows = windows.map((win) => (win.id === id ? { ...win, w, h } : win));
	}

	function closeWindow(id: string) {
		windows = windows.filter((w) => w.id !== id);
		if (activeId === id) activeId = null;
	}

	function openWindow(id: string) {
		if (isMobile) {
			windows = windows.filter((w) => w.id !== id);
		}

		const existing = windows.find((w) => w.id === id);
		if (existing) {
			focusWindow(id);
			return;
		}

		const def = getWindowDef(id);
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
		const offset = (windows.length * 28) % 200;

		const w: WindowState = {
			id,
			x: isMobile ? 0 : Math.max(20, Math.min(vw - def.w - 20, 160 + offset)),
			y: isMobile ? 28 : Math.max(32, Math.min(vh - def.h - 110, 70 + offset)),
			w: isMobile ? vw : Math.min(def.w, vw - 40),
			h: isMobile ? vh - 28 : Math.min(def.h, vh - 140),
			z: ++zCounter
		};

		windows = [...windows, w];
		activeId = id;
	}

	function openChat(group: GroupMeta) {
		if (!isShowOnAir(group.slug, channels, now, timezone)) {
			showAlert({
				title: `${group.name.toUpperCase()} is off air`,
				body: `You can only chat with characters from shows that are currently broadcasting. Check the TV Guide for upcoming broadcasts.`,
				buttons: [
					{ label: 'Browse TV Guide', action: () => { dismissAlert(); openWindow('tv-guide'); } },
					{ label: 'OK', primary: true },
				],
			});
			return;
		}
		const windowId = `chat-${group.slug}`;
		openWindow(windowId);
	}

	function handleSubscribe(_group: GroupMeta) {
		// TODO: open email opt-in
	}

	function openTextEditFile(name: string) {
		const file = findDocByName(name);
		if (file) openWindow(`textedit-${file.id}`);
	}

	let cameraRecording = $state(false);

	const activeChatGroupSlug = $derived.by(() => {
		const chatWindow = windows.find((w) => w.id.startsWith('chat-'));
		if (!chatWindow) return null;
		return chatWindow.id.replace('chat-', '');
	});

	function setTimezone(tz: string) {
		timezone = tz === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;
		saveTimezone(timezone);
	}

	let alertSpec = $state<(AlertSpec & { id: number }) | null>(null);
	function showAlert(spec: AlertSpec) { alertSpec = { ...spec, id: Math.random() }; }
	function dismissAlert() { alertSpec = null; }

	function setTweak(key: string, value: unknown) {
		tweaks = { ...tweaks, [key]: value } as TweaksState;
		saveTweaks(tweaks);
	}

	const os: OsApi = {
		launchApp: (appId, payload) => {
			if (appId === 'tvguide') return openWindow('tv-guide');
			if (appId === 'chatrbot' && payload?.showId) {
				const showId = payload.showId as string;
				const group = groups.find((g) => g.slug === showId);
				if (group) openChat(group);
				return;
			}
			if (appId === 'textedit') {
				if (payload?.open) {
					openTextEditFile(payload.open as string);
					return;
				}
				openTextEditFile('README.TXT');
				return;
			}
			if (appId === 'stickies') {
				if (payload?.action === 'new') {
					createStickyNote();
					return;
				}
				if (payload?.action === 'color' && payload?.color) {
					// Color the currently focused sticky note
					if (activeId?.startsWith('sticky-')) {
						const noteId = activeId.replace('sticky-', '');
						colorStickyNote(noteId, payload.color as string);
					}
					return;
				}
				// Default: open a new note
				createStickyNote();
				return;
			}
			if (appId === 'recorder') return openWindow('recorder');
			if (appId === 'stats') return openWindow('stats');
			if (appId === 'error') return openWindow('error');
			if (appId === 'welcome') return openWindow('welcome');
		},
		closeFocused: () => { if (activeId) closeWindow(activeId); },
		closeWindow,
		focusWindow,
		openWindow,
		openTweaks: () => openWindow('terminal-prefs'),
		openPreferences: (appId) => {
			const a = APPS[appId];
			if (a?.preferences) openWindow(a.preferences);
		},
		openAbout: (appId) => {
			if (appId === 'chatrbot') return openWindow('about-chatrbot');
			if (appId === 'tvguide') return openWindow('about-tvguide');
			if (appId === 'textedit') return openWindow('about-textedit');
			if (appId === 'stats') return openWindow('about-stats');
			if (appId === 'stickies') return openWindow('about-stickies');
			if (appId === 'recorder') return openWindow('about-recorder');
			return openWindow('about');
		},
		get now() { return now; },
		get timezone() { return timezone; },
		get tweaks() { return tweaks; },
		setTweak,
		guide: {
			currentlyAiring: (showId: string) => {
				return isShowOnAir(showId, channels, now, timezone);
			},
			nextAiring: (_showId: string) => {
				return 'Check the TV Guide';
			},
			liveCount: () => {
				const slotIdx = getSlotIndex(now, timezone);
				const liveShowSlugs = new Set(channels.map(ch => ch.schedule[slotIdx]?.showSlug).filter(Boolean));
				return liveShowSlugs.size;
			},
			shows: () => groups.filter((g) => g.active).map((g) => ({
				id: g.slug,
				name: g.name,
				onAir: isShowOnAir(g.slug, channels, now, timezone)
			})),
		},
		listWindows: () => windows,
		alert: showAlert,
		startNewConversation: () => openWindow('tv-guide'),
	};

	const activeAppId = $derived(activeId ? windowAppId(activeId) : 'finder');
	const activeApp = $derived(APPS[activeAppId] || APPS.finder);

	const chatContextInfo = $derived.by((): string | undefined => {
		if (activeApp.id === 'chatrbot' && activeId?.startsWith('chat-')) {
			const showSlug = activeId.replace('chat-', '');
			const group = groups.find((g) => g.slug === showSlug);
			return group?.name;
		}
		return undefined;
	});

	function focusChat(groupSlug: string) {
		const chatWindow = windows.find((w) => w.id === `chat-${groupSlug}`);
		if (chatWindow) {
			focusWindow(chatWindow.id);
		}
	}
</script>

{#if isMobile}
<div class="mobile-fallback">
	<h1>terminal<span class="mobile-accent">.bli.net</span></h1>
	<p class="mobile-tagline">Previously on screens…</p>
	<div class="mobile-body">
		<p>Terminal is a retro desktop OS that lives in a browser tab. It's built for screens wide enough to drag windows around on.</p>
		<p>Open this on a laptop or desktop to get the full experience — menu bar, draggable windows, a TV Guide, and characters you can chat with.</p>
	</div>
	<div class="mobile-footer">terminal.bli.net · built in a garage</div>
</div>
{:else}
<div
	class="desktop"
	data-wallpaper={tweaks.wallpaper.startsWith('sys7-') ? undefined : tweaks.wallpaper}
	style={tweaks.wallpaper.startsWith('sys7-')
		? `background: url(/themes/system7/wallpapers/${tweaks.wallpaper.replace('sys7-', '')}.png) repeat; image-rendering: pixelated;`
		: ''}
>
	<MenuBar
		app={activeApp}
		{os}
		openWindows={windows.length}
		isRecording={cameraRecording}
		contextInfo={chatContextInfo}
		{now}
		{timezone}
		onSetTimezone={setTimezone}
	/>

	{#if !isMobile || windows.length === 0}
		<div class="desktop-icons left">
			<DesktopIcon label="Terminal HD" ondblclick={() => openWindow('finder')}>
				<PixelIcon kind="hd" />
			</DesktopIcon>
			<DesktopIcon label="TV Guide.app" ondblclick={() => openWindow('tv-guide')}>
				<PixelIcon kind="tvguide" />
			</DesktopIcon>
			<DesktopIcon label="README.txt" ondblclick={() => openTextEditFile('README.TXT')}>
				<PixelIcon kind="doc" />
			</DesktopIcon>
		</div>

		<div class="desktop-icons right">
			<DesktopIcon label="Pricing.txt" ondblclick={() => openTextEditFile('Pricing.txt')}>
				<PixelIcon kind="doc" accent />
			</DesktopIcon>
			<DesktopIcon label="Stickies" ondblclick={() => createStickyNote()}>
				<PixelIcon kind="stickies" />
			</DesktopIcon>
			<DesktopIcon label="Camera.app" ondblclick={() => openWindow('recorder')}>
				<PixelIcon kind="tv" />
			</DesktopIcon>
			<DesktopIcon label="Stats.app" ondblclick={() => openWindow('stats')}>
				<PixelIcon kind="calc" />
			</DesktopIcon>
			<DesktopIcon label="DO_NOT_OPEN" ondblclick={() => openWindow('error')}>
				<PixelIcon kind="floppy" />
			</DesktopIcon>
			<DesktopIcon label="Trash" ondblclick={() => openWindow('trash')}>
				<PixelIcon kind="trash" />
			</DesktopIcon>
		</div>
	{/if}

	{#each windows as w (w.id)}
		{@const def = getWindowDef(w.id)}
		<Window
			id={w.id}
			title={def.title}
			x={w.x}
			y={w.y}
			width={w.w}
			height={w.h}
			z={w.z}
			active={activeId === w.id}
			onfocus={focusWindow}
			onclose={closeWindow}
			onmove={moveWindow}
			onresize={resizeWindow}
		>
			{#if w.id === 'welcome'}
				<WelcomeWindow onopen={openWindow} />
			{:else if w.id === 'tv-guide'}
				<TVGuide
					{groups}
					{bots}
					{channels}
					{timezone}
					{now}
					{activeChatGroupSlug}
					gridLoop={tweaks.tvGridLoop}
					marqueeLoop={tweaks.marqueeLoop}
					pauseOnHover={tweaks.tvPauseOnHover}
					onOpenChat={openChat}
					onFocusChat={focusChat}
					onSubscribe={handleSubscribe}
				/>
			{:else if w.id.startsWith('chat-')}
				{@const showSlug = w.id.replace('chat-', '')}
				{@const group = groups.find((g) => g.slug === showSlug)}
				{@const showBots = bots.filter((b) => b.group === showSlug)}
				{#if group && showBots.length > 0}
					<ChatWindow
						{showSlug}
						showName={group.name}
						castBots={showBots}
						minutesLeft={isShowOnAir(group.slug, channels, now, timezone)
							? 30 - (now.getMinutes() % 30)
							: null}
						offAir={!isShowOnAir(group.slug, channels, now, timezone)}
					/>
				{/if}
			{:else if w.id === 'terminal-prefs'}
				<div class="window-content prefs-content">
					<h3 class="prefs-heading">TERMINAL PREFERENCES</h3>
					<div class="pref-row">
						<div class="pref-label">WALLPAPER</div>
						<div class="pref-sublabel">Classic</div>
						<div style="display: flex; gap: 6px; flex-wrap: wrap;">
							{#each [
								{ value: 'teal', label: 'Teal', color: '#5e8585' },
								{ value: 'speckle', label: 'Speckle', color: '#c8bda6' },
								{ value: 'yellow', label: 'Yellow', color: '#f9bd2b' },
								{ value: 'pink', label: 'Pink', color: '#ee63b3' },
								{ value: 'navy', label: 'Navy', color: '#16243a' },
							] as opt}
								<button
									class="btn btn-with-chip {tweaks.wallpaper === opt.value ? 'selected' : ''}"
									onclick={() => setTweak('wallpaper', opt.value)}
								>
									<span class="btn-chip" style:background={opt.color}></span>
									{opt.label}
								</button>
							{/each}
						</div>
						<div class="pref-sublabel" style="margin-top: 10px;">System 7 Patterns</div>
						<div class="pattern-grid">
							{#each SYS7_PATTERNS as pat}
								<button
									class="pattern-thumb {tweaks.wallpaper === `sys7-${pat}` ? 'selected' : ''}"
									style="background-image: url(/themes/system7/wallpapers/{pat}.png);"
									onclick={() => setTweak('wallpaper', `sys7-${pat}`)}
									title="Pattern {pat}"
								></button>
							{/each}
						</div>
						<div class="pref-hint">desktop pattern — survives reload</div>
					</div>
					<div class="pref-row">
						<div class="pref-label">ACCENT</div>
						<div style="display: flex; gap: 6px;">
							{#each ['#f54e00', '#2b6cb0', '#a6f000', '#ff79c6', '#0a0a0a'] as c}
								<button
									class="btn btn-swatch {tweaks.accent === c ? 'selected' : ''}"
									style:background={c}
									onclick={() => setTweak('accent', c)}
									title={c}
								></button>
							{/each}
						</div>
						<div class="pref-hint">primary call-to-action color across the OS</div>
					</div>
					<p class="muted" style="margin-top: 14px; font-size: 15px;">
						App-specific settings live in each app's Help → Preferences menu.
					</p>
				</div>
			{:else if w.id === 'tvguide-prefs'}
				<div class="window-content prefs-content">
					<h3 class="prefs-heading">TV GUIDE PREFERENCES</h3>
					<div class="pref-row">
						<div class="pref-label">GRID LOOP</div>
						<input
							type="range" min={30} max={400} step={5}
							value={tweaks.tvGridLoop}
							oninput={(e) => setTweak('tvGridLoop', parseInt((e.target as HTMLInputElement).value, 10))}
							style="width: 100%;"
						/>
						<div class="pref-hint">{tweaks.tvGridLoop}s · how long for the timeline to scroll a full 24 hours</div>
					</div>
					<div class="pref-row">
						<div class="pref-label">MARQUEE LOOP</div>
						<input
							type="range" min={10} max={120} step={2}
							value={tweaks.marqueeLoop}
							oninput={(e) => setTweak('marqueeLoop', parseInt((e.target as HTMLInputElement).value, 10))}
							style="width: 100%;"
						/>
						<div class="pref-hint">{tweaks.marqueeLoop}s · bottom chyron drift speed</div>
					</div>
					<div class="pref-row">
						<div class="pref-label">PAUSE ON HOVER</div>
						<label style="display: flex; gap: 8px; align-items: center; cursor: pointer;">
							<input
								type="checkbox"
								checked={tweaks.tvPauseOnHover}
								onchange={(e) => setTweak('tvPauseOnHover', (e.target as HTMLInputElement).checked)}
							/>
							<span>{tweaks.tvPauseOnHover ? 'on' : 'off'}</span>
						</label>
						<div class="pref-hint">freeze the auto-scroll when your mouse is over the grid</div>
					</div>
					<p class="muted" style="margin-top: 16px; font-size: 15px;">
						Wallpaper, accent color, and other OS-wide settings live in the <span class="kbd">●</span> menu → Tweaks…
					</p>
				</div>
			{:else if w.id === 'chatrbot-prefs'}
				<div class="window-content prefs-content">
					<h3 class="prefs-heading">CHATRBOT PREFERENCES</h3>
					<p style="opacity: 0.7;">No preferences yet — the chat just chats.</p>
					<p class="muted" style="margin-top: 12px; font-size: 15px;">
						Coming later: typing speed, sound effects, default opener.
					</p>
				</div>
			{:else if w.id.startsWith('textedit-')}
				{@const fileId = w.id.replace('textedit-', '')}
				<TextEditWindow docId={fileId} />
			{:else if w.id === 'about' || w.id.startsWith('about-')}
				{@const aboutAppId = w.id === 'about' ? 'finder' : w.id.replace('about-', '')}
				{@const aboutApp = APPS[aboutAppId]}
				{#if aboutApp?.about}
					<AboutAppWindow about={aboutApp.about} />
				{/if}
			{:else if w.id === 'stats'}
				<StatsWindow showCount={groups.filter((g) => g.active).length} botCount={bots.length} />
			{:else if w.id === 'error'}
				<ErrorDialog onclose={() => closeWindow('error')} />
			{:else if w.id === 'trash'}
				<TrashWindow />
			{:else if w.id === 'recorder'}
				<RecorderWindow bind:recording={cameraRecording} />
			{:else if w.id.startsWith('sticky-')}
				{@const noteId = w.id.replace('sticky-', '')}
				{@const note = stickyNotes.find((n) => n.id === noteId)}
				{#if note}
					<StickiesNote
						{note}
						ondelete={deleteStickyNote}
						onupdate={updateStickyNote}
					/>
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

	<Dock onopen={openWindow} openIds={windows.map((w) => w.id)} />

	{#if alertSpec}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="system-alert-backdrop" onclick={(e) => e.stopPropagation()}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="system-alert window" onclick={(e) => e.stopPropagation()}>
				<div class="window-titlebar" style="cursor: default;">
					<div class="btns">
						<button class="window-btn close" onclick={dismissAlert} aria-label="close"></button>
					</div>
					<div class="title">{alertSpec.title || 'System Alert'}</div>
				</div>
				<div class="window-body" style="padding: 18px; display: flex; gap: 14px;">
					<div class="bomb">⚠</div>
					<div style="flex: 1; min-width: 0;">
						<div style="font-family: 'Press Start 2P', monospace; font-size: 11px; margin-bottom: 10px; line-height: 1.4;">
							{alertSpec.title}
						</div>
						<div style="font-family: 'VT323', monospace; font-size: 17px; margin-bottom: 14px; line-height: 1.3;">
							{alertSpec.body}
						</div>
						<div style="display: flex; gap: 8px; flex-wrap: wrap;">
							{#each alertSpec.buttons || [{ label: 'OK', primary: true }] as b}
								<button
									class="btn {b.primary ? 'primary' : ''}"
									onclick={() => { dismissAlert(); b.action?.(); }}
								>{b.label}</button>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
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
	.mobile-accent { color: var(--brand-color-orange); }
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
	.mobile-body p { margin: 0 0 12px; }
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
		font-family: 'Pixelify Sans', 'VT323', monospace;
	}
	.desktop[data-wallpaper='teal'] {
		background-color: #008080;
		background-image: linear-gradient(
				45deg,
				#5e8585 25%,
				transparent 25%,
				transparent 75%,
				#5e8585 75%
			),
			linear-gradient(45deg, #5e8585 25%, transparent 25%, transparent 75%, #5e8585 75%);
		background-size: 4px 4px, 4px 4px;
		background-position: 0 0, 2px 2px;
	}
	.desktop[data-wallpaper='speckle'] {
		background-color: #e8e1d3;
		background-image: radial-gradient(circle at 1px 1px, #c8bda6 1px, transparent 1.5px),
			radial-gradient(circle at 3px 5px, #b8a989 1px, transparent 1.5px);
		background-size: 6px 6px, 8px 8px;
		background-position: 0 0, 2px 3px;
	}
	.desktop[data-wallpaper='yellow'] {
		background-color: #f9bd2b;
		background-image: linear-gradient(
				45deg,
				#e3aa20 25%,
				transparent 25%,
				transparent 75%,
				#e3aa20 75%
			),
			linear-gradient(45deg, #e3aa20 25%, transparent 25%, transparent 75%, #e3aa20 75%);
		background-size: 4px 4px, 4px 4px;
		background-position: 0 0, 2px 2px;
	}
	.desktop[data-wallpaper='pink'] {
		background-color: #ff79c6;
		background-image: linear-gradient(
				45deg,
				#ee63b3 25%,
				transparent 25%,
				transparent 75%,
				#ee63b3 75%
			),
			linear-gradient(45deg, #ee63b3 25%, transparent 25%, transparent 75%, #ee63b3 75%);
		background-size: 4px 4px, 4px 4px;
		background-position: 0 0, 2px 2px;
	}
	.desktop[data-wallpaper='navy'] {
		background-color: #0e1a2b;
		background-image: linear-gradient(
				45deg,
				#16243a 25%,
				transparent 25%,
				transparent 75%,
				#16243a 75%
			),
			linear-gradient(45deg, #16243a 25%, transparent 25%, transparent 75%, #16243a 75%);
		background-size: 4px 4px, 4px 4px;
		background-position: 0 0, 2px 2px;
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
		font-family: 'VT323', monospace;
		font-size: 18px;
		line-height: 1.35;
	}

	/* Preferences windows */
	.prefs-content {
		font-family: 'VT323', monospace;
		font-size: 18px;
	}
	.prefs-heading {
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		margin: 0 0 14px;
		font-weight: normal;
	}
	.pref-row {
		margin-bottom: 14px;
		border-bottom: 1px solid var(--paper-soft);
		padding-bottom: 12px;
	}
	.pref-label {
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		margin-bottom: 6px;
	}
	.pref-hint {
		opacity: 0.6;
		font-size: 14px;
		margin-top: 4px;
	}
	.pref-sublabel {
		font-family: 'VT323', monospace;
		font-size: 15px;
		opacity: 0.7;
		margin-bottom: 4px;
	}
	.pattern-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		max-height: 200px;
		overflow-y: auto;
		margin-top: 6px;
	}
	.pattern-thumb {
		width: 36px;
		height: 36px;
		border: 2px solid var(--ink);
		cursor: pointer;
		background-size: 64px 64px;
		image-rendering: pixelated;
	}
	.pattern-thumb:hover {
		box-shadow: 0 0 0 2px var(--accent);
	}
	.pattern-thumb.selected {
		box-shadow: 0 0 0 2px var(--accent);
		border-color: var(--accent);
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
