import type { WindowState, TweaksState, GroupMeta, Bot, Channel } from '$lib/types';
import type { OsApi, AlertSpec, GuideApi, ShowInfo } from './os-api';
import { windowAppId } from './os-api';
import { APPS } from './app-registry';
import { isShowOnAir, getSlotIndex } from '$lib/schedule';
import {
	loadWindows,
	saveWindows,
	loadTweaks,
	saveTweaks,
	loadTimezone,
	saveTimezone,
	loadConversations,
	saveConversations,
	isFirstVisit,
	clearAllPreferences
} from '$lib/persistence';
import { getAppWindowId } from '$lib/terminalos/apps/app-install';
import { getAppDef } from '$lib/terminalos/apps/app-library';
import {
	synthKnownWindowIds,
	synthWindowDefs,
	synthAboutWindowId,
	synthPrefsWindowId,
	matchWindow
} from '$lib/terminalos/apps/app-catalog';
import { resolveOpenTarget } from './window-host';
import type { TerminalFS, FsFile } from '$lib/terminalos';

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
	// Synthesized from the per-app manifests (see manifests.ts /
	// app-catalog.ts). Byte-identical to the hand-authored set this replaced.
	private static KNOWN_WINDOW_IDS = synthKnownWindowIds();

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

		// Restore windows or show welcome. Two filters: drop ids that no longer
		// resolve to any window (e.g. a `chat-<slug>` layout saved before the
		// `chat:` separator cutover — now unknown, so it would otherwise restore
		// into a dead "Coming soon" window), then drop uninstalled store apps.
		const saved = loadWindows().filter((w) => {
			if (!this.isKnownWindowId(w.id)) return false;
			const wAppId = windowAppId(w.id);
			const def = getAppDef(wAppId);
			return !def || def.isSystem || this.fs.isAppInstalledSync(wAppId);
		});
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
			if (key === 'w') {
				e.preventDefault();
				if (this.activeId) this.closeWindow(this.activeId);
			} else if (key === 'n') {
				e.preventDefault();
				const app = APPS[this.activeId ? windowAppId(this.activeId) : 'finder'];
				const menus = app?.menus(this) ?? [];
				const fileMenu = menus.find((m) => m.label === 'File');
				const newItem = fileMenu?.items.find((it) => it.type === 'action' && it.shortcut === '⌘N');
				if (newItem && newItem.type === 'action' && newItem.action) newItem.action(this);
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

		// Gate: store apps must be installed before any of their windows open
		const appId = windowAppId(id);
		const appDef = getAppDef(appId);
		if (appDef && !appDef.isSystem) {
			const installed = this.fs.isAppInstalledSync(appId);
			if (!installed) {
				const name = appDef.name;
				const owned = this.fs.isAppOwned(appId);
				this.alert({
					title: `${name} is not installed`,
					body: owned
						? `"${name}" is on your shelf but not installed. Open My Shelf to install it.`
						: `"${name}" hasn't been purchased yet. Visit the Computer Store to pick it up.`,
					buttons: owned
						? [
								{
									label: 'Open My Shelf',
									primary: true,
									action: () => this.openWindow('software-shop')
								},
								{ label: 'OK' }
							]
						: [
								{
									label: 'Visit Store',
									primary: true,
									action: () => this.openWindow('computer-store')
								},
								{ label: 'OK' }
							]
				});
				return;
			}
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

	getWindowDef(id: string): { title: string; w: number; h: number; minW?: number; minH?: number } {
		// Static window defs are synthesized from the per-app manifests (see
		// manifests.ts / app-catalog.ts), including the vcr device-sizing.
		// The minted-prefix windows below stay dynamic.
		const defs = synthWindowDefs();

		if (id.startsWith('chat-')) {
			const showSlug = id.replace('chat-', '');
			const group = this.groups.find((g) => g.slug === showSlug);
			return { title: group ? `chatrbot - ${group.name}` : 'Chat', w: 440, h: 560 };
		}
		// Flat-model windows (e.g. player:) size themselves from their manifest
		// WindowSpec — title/size are pure functions of (args, fs). As apps migrate,
		// the hardcoded prefix branches above collapse into this one lookup.
		const matched = matchWindow(id);
		if (matched) {
			const ctx = { args: matched.args, fs: this.fs };
			return { title: matched.spec.title(ctx), ...matched.spec.size(ctx) };
		}
		return defs[id] || { title: 'Unknown', w: 380, h: 320 };
	}

	isKnownWindowId(id: string): boolean {
		// Minted windows (chat:, textedit:, sticky:, player:) and fixed ones all
		// resolve through matchWindow now — no app-specific prefix branches remain.
		// A stale `-`-separated id (chat-<slug>, textedit-<id>, sticky-<id>) or a
		// `recorder-<id>` clip-playback id from before the flat cutover is therefore
		// *unknown* and gets dropped on restore (see the init() saved-window filter);
		// those clips reopen in the Player by content-type anyway.
		return OsApiClass.KNOWN_WINDOW_IDS.has(id) || matchWindow(id) !== null;
	}

	/**
	 * Open a document in its handler window — the single open rule. Routing lives
	 * in resolveOpenTarget (opensWith → content-type → fileType), so the OS never
	 * switches on a specific app. A recording opens in the system Player this way.
	 */
	openDocument(file: FsFile): void {
		this.openWindow(resolveOpenTarget(file));
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
		// The prefs window-id comes straight from the app's manifest (prefs.id),
		// or null when the app has no Preferences dialog.
		const prefsId = synthPrefsWindowId(appId);
		if (prefsId) this.openWindow(prefsId);
	}

	openAbout(appId: string | null): void {
		// The About window-id comes from the app's manifest (about.id); apps with
		// no About dialog, and a null id, fall back to the system 'about'.
		this.openWindow(synthAboutWindowId(appId));
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
		// Apps with custom launch behavior (stickies/textedit/chatrbot) register a
		// handler at startup; those win. See the registerLaunchHandler call sites
		// in Desktop.svelte.
		const handler = this.launchHandlers.get(appId);
		if (handler) {
			handler(payload);
			return;
		}

		// Everything else is a plain "open the app's window" — the window-id comes
		// from the manifest (via getAppWindowId). The old per-app chain
		// (tvguide → tv-guide, recorder, stats, error) only repeated that mapping.
		const windowId = getAppWindowId(appId);
		if (windowId) this.openWindow(windowId);
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
		this.openWindow(`chat:${group.slug}`);
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

		const preferences = {
			tweaks: loadTweaks(),
			conversations: loadConversations(),
			timezone: loadTimezone(),
			windows: loadWindows()
		};

		Promise.all([this.fs.exportBackup(preferences), wait]).then(([result]) => {
			if (!result.ok) {
				this.showAlert({
					title: 'Backup Failed',
					body: result.error.message,
					buttons: [{ label: 'OK', primary: true }]
				});
				return;
			}
			const json = JSON.stringify(result.value, null, 2);
			const blob = new Blob([json], { type: 'application/octet-stream' });
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
							const a = document.createElement('a');
							a.href = URL.createObjectURL(blob);
							a.download = filename;
							a.click();
						}
					}
				]
			});
		});
	}

	restoreBackup(): void {
		const input = document.createElement('input');
		input.type = 'file';
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
					const lines = [
						`${p.diskName} — exported ${new Date(p.exportedAt).toLocaleDateString()}`,
						`${p.fileCount} files, ${p.folderCount} folders, ${p.appCount} apps`
					];
					if (p.hasPreferences) lines.push('Includes preferences and chat history');
					this.showAlert({
						title: 'Restore Terminal HD?',
						body: `This will replace your current disk with:\n${lines.join('\n')}`,
						buttons: [
							{ label: 'Cancel' },
							{
								label: 'Restore',
								primary: true,
								action: () => {
									this.fs.restoreBackup(data).then((r) => {
										if (r.ok) {
											const prefs = r.value.preferences;
											if (prefs) {
												if (prefs.tweaks !== undefined) saveTweaks(prefs.tweaks);
												if (prefs.timezone != null) saveTimezone(prefs.timezone);
												if (prefs.conversations !== undefined)
													saveConversations(prefs.conversations);
												if (prefs.windows !== undefined) {
													// Set reactive state so the $effect's next
													// debounce-save writes the restored windows,
													// not the current session's stale layout.
													this.windows = prefs.windows;
													saveWindows(prefs.windows);
												}
											}
											window.location.reload();
										} else {
											this.showAlert({
												title: 'Restore Failed',
												body: r.error.message,
												buttons: [{ label: 'OK', primary: true }]
											});
										}
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
							saveWindows([]);
							window.location.replace(window.location.pathname);
						});
					}
				}
			]
		});
	}

	// ── Derived state ─────────────────────────────────────────────────────

	isAppInstalled(appId: string): boolean {
		return this.fs.isAppInstalledSync(appId);
	}

	get activeAppId(): string {
		return this.activeId ? windowAppId(this.activeId) : 'finder';
	}

	get activeApp() {
		return APPS[this.activeAppId] || APPS.finder;
	}

	get activeChatGroupSlug(): string | null {
		if (!this.activeId?.startsWith('chat:')) return null;
		return this.activeId.replace('chat:', '');
	}
}
