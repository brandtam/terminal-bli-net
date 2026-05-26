import type { WindowState, TweaksState, GroupMeta, Bot, Channel } from '$lib/types';
import type { OsApi, AlertSpec, GuideApi, ShowInfo } from './os-api';
import { windowAppId } from './os-api';
import { APPS } from './app-registry';
import { isShowOnAir, getSlotIndex } from '$lib/schedule';
import {
	loadWindows,
	loadTweaks,
	saveTweaks,
	loadTimezone,
	saveTimezone,
	isFirstVisit,
	clearAllPreferences
} from '$lib/persistence';
import { getAppWindowId } from '$lib/terminalos/apps/app-install';
import type { TerminalFS } from '$lib/terminalos';

export class OsApiClass implements OsApi {
	// ── Reactive state ────────────────────────────────────────────────────
	windows = $state<WindowState[]>([]);
	activeId = $state<string | null>(null);
	alertSpec = $state<(AlertSpec & { id: number }) | null>(null);
	tweaks = $state<TweaksState>({
		wallpaper: 'teal',
		accent: '#f54e00',
		tvGridLoop: 400,
		marqueeLoop: 100,
		tvPauseOnHover: false
	});
	timezone = $state<string | undefined>(undefined);
	now = $state(new Date());
	slotNow = $state(new Date());
	groups = $state<GroupMeta[]>([]);
	bots = $state<Bot[]>([]);
	channels = $state<Channel[]>([]);
	isMobile = $state(false);
	mounted = $state(false);

	// ── Private state ─────────────────────────────────────────────────────
	private fs: TerminalFS;
	private zCounter = 10;
	private lastSlotIdx = -1;
	private tickInterval?: ReturnType<typeof setInterval>;
	private resizeCleanup?: () => void;
	private keydownCleanup?: () => void;
	private launchHandlers = new Map<string, (payload?: Record<string, unknown>) => void>();

	// ── Dock alias map ────────────────────────────────────────────────────
	private DOCK_ALIASES: Record<string, () => void> = {};

	// ── Known window IDs ──────────────────────────────────────────────────
	private static KNOWN_WINDOW_IDS = new Set([
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
		'about-software-shop',
		'stats',
		'error',
		'trash',
		'recorder',
		'finder',
		'software-shop'
	]);

	constructor(fs: TerminalFS) {
		this.fs = fs;
	}

	// ── Initialization ────────────────────────────────────────────────────

	async init(): Promise<void> {
		// Load persisted state
		this.tweaks = loadTweaks();
		this.timezone = loadTimezone() || Intl.DateTimeFormat().resolvedOptions().timeZone;
		this.isMobile = window.innerWidth < 720;

		// Fetch guide data from API
		try {
			const res = await fetch('/api/data');
			if (res.ok) {
				const data = (await res.json()) as {
					groups: GroupMeta[];
					bots: Bot[];
					channels: Channel[];
				};
				this.groups = data.groups;
				this.bots = data.bots;
				this.channels = data.channels;
			}
		} catch {
			// API failure is non-fatal — the OS runs without guide data
		}

		// Restore windows or show welcome
		const saved = loadWindows();
		if (saved.length > 0) {
			this.windows = saved;
			this.normalizeZOrder();
		} else if (isFirstVisit()) {
			this.openWindow('welcome');
		}

		// Handle hash routing
		const hash = window.location.hash.slice(1);
		if (hash && this.isKnownWindowId(hash)) {
			this.openWindow(hash);
		}

		// Start clock
		const initialNow = new Date();
		this.lastSlotIdx = getSlotIndex(initialNow, this.timezone);
		this.slotNow = initialNow;

		this.tickInterval = setInterval(() => {
			this.now = new Date();
			const idx = getSlotIndex(this.now, this.timezone);
			if (idx !== this.lastSlotIdx) {
				this.lastSlotIdx = idx;
				this.slotNow = this.now;
			}
		}, 1000);

		// Resize listener
		const handleResize = () => {
			this.isMobile = window.innerWidth < 720;
		};
		window.addEventListener('resize', handleResize);
		this.resizeCleanup = () => window.removeEventListener('resize', handleResize);

		// Keyboard shortcuts
		const handleKeydown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey)) return;
			const key = e.key.toLowerCase();
			if (key === 'g') {
				e.preventDefault();
				this.openWindow('tv-guide');
			} else if (key === 'w') {
				e.preventDefault();
				if (this.activeId) this.closeWindow(this.activeId);
			} else if (key === 'n') {
				e.preventDefault();
				const app = APPS[this.activeId ? windowAppId(this.activeId) : 'finder'];
				const menus = app?.menus(this) ?? [];
				const fileMenu = menus.find((m) => m.label === 'File');
				const newItem = fileMenu?.items.find((it) => it.type === 'action' && it.shortcut === '⌘N');
				if (newItem && newItem.type === 'action' && newItem.action) newItem.action(this);
				else this.openWindow('tv-guide');
			} else if (key === ',') {
				e.preventDefault();
				const appId = this.activeId ? windowAppId(this.activeId) : 'finder';
				const app = APPS[appId];
				if (app?.preferences) this.openPreferences(appId);
				else this.openSystemPreferences();
			}
		};
		window.addEventListener('keydown', handleKeydown);
		this.keydownCleanup = () => window.removeEventListener('keydown', handleKeydown);

		this.mounted = true;
	}

	// ── Teardown ──────────────────────────────────────────────────────────

	destroy(): void {
		if (this.tickInterval) clearInterval(this.tickInterval);
		this.resizeCleanup?.();
		this.keydownCleanup?.();
	}

	// ── Dock aliases ──────────────────────────────────────────────────────

	initDockAliases(openTextEditFile: (name: string) => void): void {
		this.DOCK_ALIASES = {
			chat: () => this.openWindow('tv-guide'),
			pricing: () => openTextEditFile('Pricing.txt'),
			readme: () => openTextEditFile('README.TXT')
		};
	}

	// ── Window management ─────────────────────────────────────────────────

	openWindow(id: string): void {
		// Route symbolic Dock IDs
		const alias = this.DOCK_ALIASES[id];
		if (alias) {
			alias();
			return;
		}

		if (this.isMobile) {
			this.windows = this.windows.filter((w) => w.id !== id);
		}

		const existing = this.windows.find((w) => w.id === id);
		if (existing) {
			this.focusWindow(id);
			return;
		}

		const def = this.getWindowDef(id);
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
		const offset = (this.windows.length * 28) % 200;

		const w: WindowState = {
			id,
			x: this.isMobile ? 0 : Math.max(20, Math.min(vw - def.w - 20, 160 + offset)),
			y: this.isMobile ? 28 : Math.max(32, Math.min(vh - def.h - 110, 70 + offset)),
			w: this.isMobile ? vw : Math.min(def.w, vw - 40),
			h: this.isMobile ? vh - 28 : Math.min(def.h, vh - 140),
			z: ++this.zCounter
		};

		this.windows = [...this.windows, w];
		this.activeId = id;
	}

	closeWindow(id: string): void {
		this.windows = this.windows.filter((w) => w.id !== id);
		if (this.activeId === id) this.activeId = null;
	}

	focusWindow(id: string): void {
		this.activeId = id;
		this.zCounter++;
		this.windows = this.windows.map((w) => (w.id === id ? { ...w, z: this.zCounter } : w));
		if (this.zCounter > 1000) this.normalizeZOrder();
	}

	moveWindow(id: string, x: number, y: number): void {
		this.windows = this.windows.map((w) => (w.id === id ? { ...w, x, y } : w));
	}

	resizeWindow(id: string, w: number, h: number): void {
		this.windows = this.windows.map((win) => (win.id === id ? { ...win, w, h } : win));
	}

	private normalizeZOrder(): void {
		const sorted = [...this.windows].sort((a, b) => a.z - b.z);
		this.windows = sorted.map((w, i) => ({ ...w, z: i + 1 }));
		this.zCounter = this.windows.length;
	}

	// ── Window definition lookup ──────────────────────────────────────────

	getWindowDef(id: string): { title: string; w: number; h: number } {
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
			trash: { title: 'Trash', w: 380, h: 320 },
			recorder: { title: 'Camera.app', w: 360, h: 480 },
			'about-recorder': { title: 'About Recorder', w: 420, h: 360 },
			'software-shop': { title: 'Software Shop', w: 420, h: 520 },
			'about-software-shop': { title: 'About Software Shop', w: 420, h: 380 },
			finder: { title: 'Terminal HD', w: 480, h: 420 }
		};

		if (id.startsWith('chat-')) {
			const showSlug = id.replace('chat-', '');
			const group = this.groups.find((g) => g.slug === showSlug);
			return { title: group ? `chatrbot - ${group.name}` : 'Chat', w: 440, h: 560 };
		}
		if (id.startsWith('textedit-')) {
			const fileId = id.replace('textedit-', '');
			const node = this.fs.peekNode(fileId);
			return { title: node?.name || 'Untitled.txt', w: 420, h: 400 };
		}
		if (id.startsWith('sticky-')) {
			return { title: 'Stickies', w: 240, h: 220 };
		}
		if (id.startsWith('recorder-')) {
			const fileId = id.replace('recorder-', '');
			const node = this.fs.peekNode(fileId);
			return { title: node?.name || 'Recording', w: 360, h: 340 };
		}
		return defs[id] || { title: 'Unknown', w: 380, h: 320 };
	}

	isKnownWindowId(id: string): boolean {
		return (
			OsApiClass.KNOWN_WINDOW_IDS.has(id) ||
			id.startsWith('chat-') ||
			id.startsWith('sticky-') ||
			id.startsWith('textedit-') ||
			id.startsWith('recorder-')
		);
	}

	// ── Alert system ──────────────────────────────────────────────────────

	showAlert(spec: AlertSpec): void {
		this.alertSpec = { ...spec, id: Math.random() };
	}

	dismissAlert(): void {
		this.alertSpec = null;
	}

	alert(spec: AlertSpec): void {
		this.showAlert(spec);
	}

	// ── Tweaks ────────────────────────────────────────────────────────────

	setTweak(key: keyof TweaksState, value: TweaksState[keyof TweaksState]): void {
		this.tweaks = { ...this.tweaks, [key]: value };
		saveTweaks(this.tweaks);
	}

	// ── Clock ─────────────────────────────────────────────────────────────

	setTimezone(tz: string): void {
		this.timezone = tz === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;
		saveTimezone(this.timezone);
	}

	// ── Guide API ─────────────────────────────────────────────────────────

	get guide(): GuideApi {
		return {
			currentlyAiring: (showId: string) => {
				return isShowOnAir(showId, this.channels, this.now, this.timezone);
			},
			nextAiring: (_showId: string) => {
				return 'Check the TV Guide';
			},
			liveCount: () => {
				const slotIdx = getSlotIndex(this.now, this.timezone);
				const liveShowSlugs = new Set(
					this.channels.map((ch) => ch.schedule[slotIdx]?.showSlug).filter(Boolean)
				);
				return liveShowSlugs.size;
			},
			shows: (): ShowInfo[] =>
				this.groups
					.filter((g) => g.active)
					.map((g) => ({
						id: g.slug,
						name: g.name,
						onAir: isShowOnAir(g.slug, this.channels, this.now, this.timezone)
					}))
		};
	}

	// ── Navigation / routing ──────────────────────────────────────────────

	closeFocused(): void {
		if (this.activeId) this.closeWindow(this.activeId);
	}

	openSystemPreferences(): void {
		this.openWindow('terminal-prefs');
	}

	openPreferences(appId: string): void {
		const a = APPS[appId];
		if (a?.preferences) this.openWindow(a.preferences);
	}

	openAbout(appId: string | null): void {
		if (appId === 'chatrbot') return this.openWindow('about-chatrbot');
		if (appId === 'tvguide') return this.openWindow('about-tvguide');
		if (appId === 'textedit') return this.openWindow('about-textedit');
		if (appId === 'stats') return this.openWindow('about-stats');
		if (appId === 'stickies') return this.openWindow('about-stickies');
		if (appId === 'recorder') return this.openWindow('about-recorder');
		if (appId === 'software-shop') return this.openWindow('about-software-shop');
		this.openWindow('about');
	}

	startNewConversation(): void {
		this.openWindow('tv-guide');
	}

	listWindows(): WindowState[] {
		return this.windows;
	}

	// ── App launch routing ────────────────────────────────────────────────

	registerLaunchHandler(appId: string, handler: (payload?: Record<string, unknown>) => void): void {
		this.launchHandlers.set(appId, handler);
	}

	launchApp(appId: string, payload?: Record<string, unknown>): void {
		// Check registered handlers first
		const handler = this.launchHandlers.get(appId);
		if (handler) {
			handler(payload);
			return;
		}

		// Default routing for known apps
		if (appId === 'tvguide') {
			this.openWindow('tv-guide');
			return;
		}
		if (appId === 'recorder') {
			this.openWindow('recorder');
			return;
		}
		if (appId === 'stats') {
			this.openWindow('stats');
			return;
		}
		if (appId === 'error') {
			this.openWindow('error');
			return;
		}
		if (appId === 'welcome') {
			this.openWindow('welcome');
			return;
		}

		// Fallback: try to find a window ID
		const windowId = getAppWindowId(appId);
		if (windowId) {
			this.openWindow(windowId);
			return;
		}
	}

	openChat(group: GroupMeta): void {
		if (!isShowOnAir(group.slug, this.channels, this.now, this.timezone)) {
			this.showAlert({
				title: `${group.name.toUpperCase()} is off air`,
				body: `You can only chat with characters from shows that are currently broadcasting. Check the TV Guide for upcoming broadcasts.`,
				buttons: [
					{
						label: 'Browse TV Guide',
						action: () => {
							this.dismissAlert();
							this.openWindow('tv-guide');
						}
					},
					{ label: 'OK', primary: true }
				]
			});
			return;
		}
		this.openWindow(`chat-${group.slug}`);
	}

	// ── System actions ────────────────────────────────────────────────────

	async emptyTrash(): Promise<void> {
		await this.fs.emptyTrash();
	}

	exportBackup(): void {
		const PROGRESS_MS = 2000;
		this.showAlert({
			title: 'Backing Up',
			body: 'Writing Terminal HD to disk…',
			progress: { durationMs: PROGRESS_MS }
		});

		const wait = new Promise((r) => setTimeout(r, PROGRESS_MS));

		Promise.all([this.fs.exportBackup(), wait]).then(([result]) => {
			if (!result.ok) {
				this.showAlert({
					title: 'Backup Failed',
					body: result.error.message,
					buttons: [{ label: 'OK', primary: true }]
				});
				return;
			}
			const json = JSON.stringify(result.value, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const filename = `terminal-hd-${new Date().toISOString().slice(0, 10)}.terminal-hd`;
			this.showAlert({
				title: 'Backup Complete',
				body: 'Terminal HD has been saved. This file is readable JSON — anyone who has it can see your files.',
				buttons: [
					{ label: 'Cancel' },
					{
						label: 'Download',
						primary: true,
						action: () => {
							const url = URL.createObjectURL(blob);
							const a = document.createElement('a');
							a.href = url;
							a.download = filename;
							a.click();
							URL.revokeObjectURL(url);
						}
					}
				]
			});
		});
	}

	restoreBackup(): void {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.terminal-hd,.json';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			file.text().then((text) => {
				let data: unknown;
				try {
					data = JSON.parse(text);
				} catch {
					this.showAlert({
						title: 'Invalid File',
						body: 'That file is not valid JSON.',
						buttons: [{ label: 'OK', primary: true }]
					});
					return;
				}
				this.fs.validateBackup(data).then((preview) => {
					if (!preview.ok) {
						this.showAlert({
							title: 'Invalid Backup',
							body: preview.error.message,
							buttons: [{ label: 'OK', primary: true }]
						});
						return;
					}
					const p = preview.value;
					this.showAlert({
						title: 'Restore Terminal HD?',
						body: `This will replace your current disk with:\n${p.diskName} — exported ${new Date(p.exportedAt).toLocaleDateString()}\n${p.fileCount} files, ${p.folderCount} folders, ${p.appCount} apps`,
						buttons: [
							{ label: 'Cancel' },
							{
								label: 'Restore',
								primary: true,
								action: () => {
									this.fs.restoreBackup(data).then((r) => {
										if (r.ok) window.location.reload();
										else
											this.showAlert({
												title: 'Restore Failed',
												body: r.error.message,
												buttons: [{ label: 'OK', primary: true }]
											});
									});
								}
							}
						]
					});
				});
			});
		};
		input.click();
	}

	reinstallOS(): void {
		this.showAlert({
			title: 'Reinstall Terminal OS',
			body: 'This will erase everything on Terminal HD and rebuild the factory defaults. All your files, notes, and recordings will be permanently deleted.',
			buttons: [
				{ label: 'Cancel' },
				{
					label: 'Reinstall',
					primary: true,
					action: () => {
						this.fs.reinstallOS().then(() => {
							clearAllPreferences();
							window.location.reload();
						});
					}
				}
			]
		});
	}

	// ── Derived state ─────────────────────────────────────────────────────

	get activeAppId(): string {
		return this.activeId ? windowAppId(this.activeId) : 'finder';
	}

	get activeApp() {
		return APPS[this.activeAppId] || APPS.finder;
	}

	get activeChatGroupSlug(): string | null {
		if (!this.activeId?.startsWith('chat-')) return null;
		return this.activeId.replace('chat-', '');
	}
}
