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
		loadAliases,
		saveAliases
	} from '$lib/persistence';
	import type { DesktopAlias } from '$lib/persistence';
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
	import {
		readFile,
		findByApp,
		createFile,
		writeFile,
		deleteNode,
		DOCS_ID
	} from '$lib/os/filesystem';
	import type { FSFile } from '$lib/os/filesystem';
	import StatsWindow from '$lib/apps/stats/StatsWindow.svelte';
	import ErrorDialog from '$lib/apps/finder/ErrorDialog.svelte';
	import TrashWindow from '$lib/apps/finder/TrashWindow.svelte';
	import AboutAppWindow from '$lib/apps/finder/AboutAppWindow.svelte';
	import AboutTerminal from '$lib/apps/finder/AboutTerminal.svelte';
	import RecorderWindow from '$lib/apps/recorder/RecorderWindow.svelte';
	import StickiesNote from '$lib/apps/stickies/StickiesNote.svelte';
	import type { StickyNote } from '$lib/apps/stickies/StickiesNote.svelte';
	import FinderWindow from '$lib/apps/finder/FinderWindow.svelte';
	import TerminalPrefs from './TerminalPrefs.svelte';
	import TVGuidePrefs from './TVGuidePrefs.svelte';
	import ChatrbotPrefs from './ChatrbotPrefs.svelte';
	import { seedFilesystem } from '$lib/os/filesystem-seed';

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
	let slotNow = $state(new Date());
	let lastSlotIdx = $state(-1);
	let isMobile = $state(false);
	let selectedIconId = $state<string | null>(null);

	let stickyNotes = $state<StickyNote[]>([]);
	let aliases = $state<DesktopAlias[]>([]);

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
		openWindow(`sticky-${file.id}`);
	}

	function deleteStickyNote(id: string) {
		deleteNode(id);
		refreshStickyNotes();
		closeWindow(`sticky-${id}`);
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

	function createAlias(name: string, appId: string, icon: string) {
		if (aliases.some((a) => a.appId === appId)) return;
		const id = `alias-${appId}-${Date.now()}`;
		aliases = [...aliases, { id, label: name, appId, icon }];
		saveAliases(aliases);
	}

	function openAlias(alias: DesktopAlias) {
		if (alias.appId === 'tvguide') openWindow('tv-guide');
		else if (alias.appId === 'stickies') createStickyNote();
		else if (alias.appId === 'recorder') openWindow('recorder');
		else if (alias.appId === 'stats') openWindow('stats');
		else if (alias.appId === 'error') openWindow('error');
		else if (alias.appId === 'system-prefs') os.openSystemPreferences();
		else if (alias.appId === 'about-terminal') os.openAbout(null);
		else openWindow(alias.appId);
	}

	onMount(() => {
		tweaks = loadTweaks();
		timezone = loadTimezone() || Intl.DateTimeFormat().resolvedOptions().timeZone;
		isMobile = window.innerWidth < 720;
		seedFilesystem(); // seed filesystem default files
		stickyNotes = loadStickyNotes();
		aliases = loadAliases();

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
			normalizeZOrder();
		} else if (isFirstVisit()) {
			openWindow('welcome');
		}

		const hash = window.location.hash.slice(1);
		if (hash && isKnownWindowId(hash)) {
			openWindow(hash);
		}

		// Seed slotNow before the interval starts
		const initialNow = new Date();
		lastSlotIdx = getSlotIndex(initialNow, timezone);
		slotNow = initialNow;

		const tick = setInterval(() => {
			now = new Date();
			const idx = getSlotIndex(now, timezone);
			if (idx !== lastSlotIdx) {
				lastSlotIdx = idx;
				slotNow = now;
			}
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
				else os.openSystemPreferences();
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
		const snapshot = windows;
		const tid = setTimeout(() => saveWindows(snapshot), 300);
		return () => clearTimeout(tid);
	});

	const KNOWN_WINDOW_IDS = new Set([
		'welcome',
		'tv-guide',
		'terminal-prefs',
		'tvguide-prefs',
		'chatrbot-prefs',
		'about',
		'about-chatrbot',
		'about-tvguide',
		'about-textedit',
		'about-stats',
		'about-stickies',
		'about-recorder',
		'stats',
		'error',
		'trash',
		'recorder',
		'finder'
	]);

	function isKnownWindowId(id: string): boolean {
		return (
			KNOWN_WINDOW_IDS.has(id) ||
			id.startsWith('chat-') ||
			id.startsWith('sticky-') ||
			id.startsWith('textedit-') ||
			id.startsWith('recorder-')
		);
	}

	function getWindowDef(id: string): { title: string; w: number; h: number } {
		const defs: Record<string, { title: string; w: number; h: number }> = {
			welcome: { title: 'Welcome.app', w: 460, h: 540 },
			'tv-guide': { title: 'TV Guide.app', w: 660, h: 700 },
			'terminal-prefs': { title: 'System Preferences', w: 380, h: 360 },
			'tvguide-prefs': { title: 'TV Guide Preferences', w: 360, h: 360 },
			'chatrbot-prefs': { title: 'chatrbot Preferences', w: 360, h: 280 },
			about: { title: 'About This Terminal', w: 380, h: 380 },
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
		if (id.startsWith('recorder-')) {
			const fileId = id.replace('recorder-', '');
			const file = readFile(fileId);
			return {
				title: file?.name || 'Recording',
				w: 360,
				h: 340
			};
		}
		return defs[id] || { title: 'Unknown', w: 380, h: 320 };
	}

	function normalizeZOrder() {
		const sorted = [...windows].sort((a, b) => a.z - b.z);
		windows = sorted.map((w, i) => ({ ...w, z: i + 1 }));
		zCounter = windows.length;
	}

	function focusWindow(id: string) {
		activeId = id;
		zCounter++;
		windows = windows.map((w) => (w.id === id ? { ...w, z: zCounter } : w));
		if (zCounter > 1000) normalizeZOrder();
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

	/** Dock alias map: symbolic Dock IDs that route to real windows */
	const DOCK_ALIASES: Record<string, () => void> = {
		chat: () => openWindow('tv-guide'),
		pricing: () => openTextEditFile('Pricing.txt'),
		readme: () => openTextEditFile('README.TXT')
	};

	function openWindow(id: string) {
		// Route symbolic Dock IDs to real windows
		const alias = DOCK_ALIASES[id];
		if (alias) {
			alias();
			return;
		}

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
					{
						label: 'Browse TV Guide',
						action: () => {
							dismissAlert();
							openWindow('tv-guide');
						}
					},
					{ label: 'OK', primary: true }
				]
			});
			return;
		}
		const windowId = `chat-${group.slug}`;
		openWindow(windowId);
	}

	function openTextEditFile(name: string) {
		const file = findDocByName(name);
		if (file) openWindow(`textedit-${file.id}`);
	}

	let cameraRecording = $state(false);

	const activeChatGroupSlug = $derived.by(() => {
		if (!activeId?.startsWith('chat-')) return null;
		return activeId.replace('chat-', '');
	});

	function setTimezone(tz: string) {
		timezone = tz === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;
		saveTimezone(timezone);
	}

	let alertSpec = $state<(AlertSpec & { id: number }) | null>(null);
	function showAlert(spec: AlertSpec) {
		alertSpec = { ...spec, id: Math.random() };
	}
	function dismissAlert() {
		alertSpec = null;
	}

	function setTweak(key: keyof TweaksState, value: TweaksState[keyof TweaksState]) {
		tweaks = { ...tweaks, [key]: value };
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
		closeFocused: () => {
			if (activeId) closeWindow(activeId);
		},
		closeWindow,
		focusWindow,
		openWindow,
		openSystemPreferences: () => openWindow('terminal-prefs'),
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
		get now() {
			return now;
		},
		get timezone() {
			return timezone;
		},
		get tweaks() {
			return tweaks;
		},
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
				const liveShowSlugs = new Set(
					channels.map((ch) => ch.schedule[slotIdx]?.showSlug).filter(Boolean)
				);
				return liveShowSlugs.size;
			},
			shows: () =>
				groups
					.filter((g) => g.active)
					.map((g) => ({
						id: g.slug,
						name: g.name,
						onAir: isShowOnAir(g.slug, channels, now, timezone)
					}))
		},
		listWindows: () => windows,
		alert: showAlert,
		startNewConversation: () => openWindow('tv-guide')
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

	/** Map real window IDs back to symbolic Dock item IDs for active indicators */
	const dockOpenIds = $derived.by(() => {
		const ids = windows.map((w) => w.id);
		if (windows.some((w) => w.id.startsWith('chat-'))) ids.push('chat');
		if (
			windows.some((w) => {
				if (!w.id.startsWith('textedit-')) return false;
				const fileId = w.id.replace('textedit-', '');
				const file = readFile(fileId);
				return file?.name === 'Pricing.txt';
			})
		)
			ids.push('pricing');
		if (
			windows.some((w) => {
				if (!w.id.startsWith('textedit-')) return false;
				const fileId = w.id.replace('textedit-', '');
				const file = readFile(fileId);
				return file?.name === 'README.TXT';
			})
		)
			ids.push('readme');
		return ids;
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
			<p>
				Terminal is a retro desktop OS that lives in a browser tab. It's built for screens wide
				enough to drag windows around on.
			</p>
			<p>
				Open this on a laptop or desktop to get the full experience — menu bar, draggable windows, a
				TV Guide, and characters you can chat with.
			</p>
		</div>
		<div class="mobile-footer">terminal.bli.net · one tab, one desktop</div>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="desktop"
		data-wallpaper={tweaks.wallpaper.startsWith('sys7-') ? undefined : tweaks.wallpaper}
		style={tweaks.wallpaper.startsWith('sys7-')
			? `background: url(/themes/system7/wallpapers/${tweaks.wallpaper.replace('sys7-', '')}.png) repeat; image-rendering: pixelated;`
			: ''}
		onclick={() => {
			selectedIconId = null;
		}}
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
				<DesktopIcon
					label="Terminal HD"
					selected={selectedIconId === 'hd'}
					onselect={() => {
						selectedIconId = 'hd';
					}}
					ondblclick={() => openWindow('finder')}
				>
					<PixelIcon kind="hd" />
				</DesktopIcon>
				<DesktopIcon
					label="TV Guide.app"
					alias
					selected={selectedIconId === 'alias-tvguide'}
					onselect={() => {
						selectedIconId = 'alias-tvguide';
					}}
					ondblclick={() => openWindow('tv-guide')}
				>
					<PixelIcon kind="tvguide" />
				</DesktopIcon>
			</div>

			<div class="desktop-icons right">
				{#each aliases as a (a.id)}
					<DesktopIcon
						label={a.label}
						alias
						selected={selectedIconId === a.id}
						onselect={() => {
							selectedIconId = a.id;
						}}
						ondblclick={() => openAlias(a)}
					>
						<PixelIcon kind={a.icon} />
					</DesktopIcon>
				{/each}
				<DesktopIcon
					label="Trash"
					selected={selectedIconId === 'trash'}
					onselect={() => {
						selectedIconId = 'trash';
					}}
					ondblclick={() => openWindow('trash')}
				>
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
				chromeless={w.id.startsWith('sticky-')}
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
						{slotNow}
						{activeChatGroupSlug}
						gridLoop={tweaks.tvGridLoop}
						marqueeLoop={tweaks.marqueeLoop}
						pauseOnHover={tweaks.tvPauseOnHover}
						onOpenChat={openChat}
						onFocusChat={focusChat}
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
					<TerminalPrefs {tweaks} {SYS7_PATTERNS} onSetTweak={setTweak} />
				{:else if w.id === 'tvguide-prefs'}
					<TVGuidePrefs {tweaks} onSetTweak={setTweak} />
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
				{:else if w.id === 'stats'}
					<StatsWindow showCount={groups.filter((g) => g.active).length} botCount={bots.length} />
				{:else if w.id === 'error'}
					<ErrorDialog onclose={() => closeWindow('error')} />
				{:else if w.id === 'trash'}
					<TrashWindow />
				{:else if w.id === 'recorder'}
					<RecorderWindow bind:recording={cameraRecording} />
				{:else if w.id.startsWith('recorder-')}
					{@const recFileId = w.id.replace('recorder-', '')}
					{@const recFile = readFile(recFileId)}
					{#if recFile?.data}
						<div class="recording-playback">
							<!-- svelte-ignore a11y_media_has_caption -->
							<video src={recFile.data} controls autoplay class="recording-video"></video>
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
					<FinderWindow {os} onmakealias={createAlias} />
				{:else}
					<div class="window-content">
						<p>Coming soon...</p>
					</div>
				{/if}
			</Window>
		{/each}

		<Dock onopen={openWindow} openIds={dockOpenIds} />

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
							<div
								style="font-family: var(--brand-font-display, 'Press Start 2P', monospace); font-size: 11px; margin-bottom: 10px; line-height: 1.4;"
							>
								{alertSpec.title}
							</div>
							<div
								style="font-family: var(--brand-font-body, 'VT323', monospace); font-size: 17px; margin-bottom: 14px; line-height: 1.3;"
							>
								{alertSpec.body}
							</div>
							<div style="display: flex; gap: 8px; flex-wrap: wrap;">
								{#each alertSpec.buttons || [{ label: 'OK', primary: true }] as b}
									<button
										class="btn {b.primary ? 'primary' : ''}"
										onclick={() => {
											dismissAlert();
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
