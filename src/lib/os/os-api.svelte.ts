import type { WindowState, TweaksState, GroupMeta, PublicBot, Channel } from '$lib/types';
import { SvelteDate, SvelteSet } from 'svelte/reactivity';
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
	clearAllPreferences,
	onPersistenceQuotaExceeded
} from '$lib/persistence';
import { estimateCapacity, shouldWarnCapacity } from './capacity';
import { getAppLaunchStrategy } from '$lib/terminalos/apps/app-install';
import { getAppDef } from '$lib/terminalos/apps/app-library';
import type { TerminalAppDefinition } from '$lib/terminalos/apps/app-types';
import {
	synthAboutWindowId,
	synthPrefsWindowId,
	matchWindow
} from '$lib/terminalos/apps/app-catalog';
import { resolveOpenTarget } from './window-host';
import type { BodyGcReport, FsResult, TerminalFS, FsFile } from '$lib/terminalos';
import { TRASH_ID } from '$lib/terminalos/filesystem/well-known-ids';

const RESTORE_RECOVERY_HINT =
	'Your current disk should be unchanged. Try the restore again from the same backup file. If Terminal OS will not boot cleanly after a crash or tab kill, reinstall or clear Terminal OS site data, then restore from the backup file again.';

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
	now = $state(new SvelteDate());
	slotNow = $state(new SvelteDate());
	groups = $state<GroupMeta[]>([]);
	bots = $state<PublicBot[]>([]);
	channels = $state<Channel[]>([]);
	isMobile = $state(false);
	mounted = $state(false);

	// ── Private state ─────────────────────────────────────────────────────
	private fs: TerminalFS;
	private zCounter = 10;
	private lastSlotIdx = -1;
	private tickInterval?: ReturnType<typeof setInterval>;
	private visibilityCleanup?: () => void;
	private resizeCleanup?: () => void;
	private keydownCleanup?: () => void;
	private fsWatchCleanup?: () => void;

	// ── Dock alias map ────────────────────────────────────────────────────
	private DOCK_ALIASES: Record<string, () => void> = {};

	constructor(fs: TerminalFS) {
		this.fs = fs;
	}

	// ── Initialization ────────────────────────────────────────────────────

	async init(): Promise<void> {
		// Disk-full surfacing. persistence.ts can't import the alert system
		// (cycle), so it reports quota failures through this callback — already
		// gated to once per session inside persistence. Blob-file creation is the
		// choke point for large writes, so watch it for capacity checks; the boot
		// check below catches a disk that filled up while the tab was closed.
		onPersistenceQuotaExceeded(() => this.showDiskFullAlert());
		this.fsWatchCleanup = this.fs.watch((e) => {
			if (e.operation === 'create_file' && !e.remote) void this.warnIfNearCapacity();
		});
		void this.warnIfNearCapacity();

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
					bots: PublicBot[];
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
			this.launchApp('welcome');
		}

		// Handle hash routing
		const hash = window.location.hash.slice(1);
		if (hash && this.isKnownWindowId(hash)) {
			this.openWindow(hash);
		}

		// Start clock. The 1s tick pauses while the tab is hidden and resyncs
		// immediately on return, so the clock never shows a stale minute.
		const initialNow = new SvelteDate();
		this.lastSlotIdx = getSlotIndex(initialNow, this.timezone);
		this.slotNow = initialNow;

		const tick = () => {
			this.now = new SvelteDate();
			const idx = getSlotIndex(this.now, this.timezone);
			if (idx !== this.lastSlotIdx) {
				this.lastSlotIdx = idx;
				this.slotNow = this.now;
			}
		};
		const startTicking = () => {
			if (this.tickInterval === undefined) this.tickInterval = setInterval(tick, 1000);
		};
		const stopTicking = () => {
			if (this.tickInterval !== undefined) {
				clearInterval(this.tickInterval);
				this.tickInterval = undefined;
			}
		};
		const handleVisibility = () => {
			if (document.hidden) {
				stopTicking();
			} else {
				tick();
				startTicking();
			}
		};
		if (!document.hidden) startTicking();
		document.addEventListener('visibilitychange', handleVisibility);
		this.visibilityCleanup = () =>
			document.removeEventListener('visibilitychange', handleVisibility);

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
		this.visibilityCleanup?.();
		this.resizeCleanup?.();
		this.keydownCleanup?.();
		this.fsWatchCleanup?.();
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
				this.alertAppNotInstalled(appDef);
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
		const closingActive = this.activeId === id;
		const remaining = this.windows.filter((w) => w.id !== id);
		this.windows = remaining;
		if (closingActive) {
			this.activeId = [...remaining].sort((a, b) => b.z - a.z)[0]?.id ?? null;
		}
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
		// Every window resolves through matchWindow now — title/size are pure
		// functions of (parsed args, fs) on the matched WindowSpec (the vcr deck's
		// device-sizing reads the vcrPrefs module store inside its size()). An id no
		// manifest claims (a stale/unknown saved id) gets the generic fallback.
		const matched = matchWindow(id);
		if (matched) {
			const ctx = { args: matched.args, fs: this.fs };
			return { title: matched.spec.title(ctx), ...matched.spec.size(ctx) };
		}
		return { title: 'Unknown', w: 380, h: 320 };
	}

	isKnownWindowId(id: string): boolean {
		// A window-id is known iff a manifest claims it via windows[] — matchWindow
		// is the single gate. Fixed, prefix (chat:, textedit:, sticky:, player:,
		// about:) and the system chrome (about, terminal-prefs) all resolve here.
		// A stale `-`-separated id (chat-<slug>, sticky-<id>) or a legacy
		// about-<id> / recorder-<id> from before the flat cutover is *unknown* and
		// drops on restore (see init()'s saved-window filter); those clips reopen in
		// the Player by content-type anyway.
		return matchWindow(id) !== null;
	}

	openFolder(folderId: string, opts?: { replaceWindowId?: string }): void {
		const targetId = folderId === TRASH_ID ? 'trash' : `finder:${folderId}`;
		const sourceId = opts?.replaceWindowId;

		if (sourceId && sourceId !== targetId) {
			const source = this.windows.find((w) => w.id === sourceId);
			if (source) {
				const existing = this.windows.find((w) => w.id === targetId);
				if (existing) {
					this.closeWindow(sourceId);
					this.focusWindow(targetId);
					return;
				}

				this.windows = this.windows.map((w) => (w.id === sourceId ? { ...w, id: targetId } : w));
				if (this.activeId === sourceId) this.activeId = targetId;
				return;
			}
		}

		this.openWindow(targetId);
	}

	/**
	 * Open a document in its handler window — the single open rule. Routing lives
	 * in resolveOpenTarget (opensWith → content-type → fileType), so the OS never
	 * switches on a specific app. A recording opens in the system Player this way.
	 */
	openDocument(file: FsFile): void {
		const targetId = resolveOpenTarget(file);
		if (!this.isKnownWindowId(targetId)) {
			this.alert({
				title: 'No app can open this document',
				body: `No installed app can open "${file.name}".`,
				buttons: [{ label: 'OK', primary: true }]
			});
			return;
		}
		this.openWindow(targetId);
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

	// ── Disk-full surfacing ───────────────────────────────────────────────

	showDiskFullAlert(): void {
		this.showAlert({
			title: 'Disk Full',
			body: 'Terminal HD is full. Your latest changes could not be written to disk and will be lost when this session ends. Empty the Trash or delete old recordings to free up space.',
			buttons: [
				{ label: 'Open Trash', action: () => this.openFolder(TRASH_ID) },
				{ label: 'OK', primary: true }
			]
		});
	}

	private async warnIfNearCapacity(): Promise<void> {
		const estimate = await estimateCapacity();
		if (!estimate || !shouldWarnCapacity(estimate)) return;
		const pct = Math.round(estimate.ratio * 100);
		this.showAlert({
			title: 'Disk Almost Full',
			body: `Terminal HD is about ${pct}% full (browser storage estimate). Empty the Trash or delete old recordings before the disk fills up. System Maintenance shows the full breakdown.`,
			buttons: [
				{ label: 'Open Maintenance', action: () => this.openSystemMaintenance() },
				{ label: 'OK', primary: true }
			]
		});
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
				const liveShowSlugs = new SvelteSet(
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

	openSystemMaintenance(): void {
		this.openWindow('system-maintenance');
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

	launchApp(appId: string, payload?: Record<string, unknown>): void {
		const strategy = getAppLaunchStrategy(appId);
		if (strategy.kind === 'none') return;

		const appDef = getAppDef(appId);
		if (appDef && !appDef.isSystem && !this.fs.isAppInstalledSync(appId)) {
			this.alertAppNotInstalled(appDef);
			return;
		}

		if (strategy.kind === 'custom') {
			void strategy.handler({ os: this, fs: this.fs }, payload);
			return;
		}

		this.openWindow(strategy.windowId);
	}

	private alertAppNotInstalled(appDef: TerminalAppDefinition): void {
		const name = appDef.name;
		const owned = this.fs.isAppOwned(appDef.id);
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

	openChatByShowId(showId: string): void {
		const group = this.groups.find((g) => g.slug === showId);
		if (group) this.openChat(group);
	}

	// ── System actions ────────────────────────────────────────────────────

	async emptyTrash(): Promise<void> {
		await this.fs.emptyTrash();
	}

	async collectFilesystemGarbage(): Promise<FsResult<BodyGcReport>> {
		return this.fs.collectGarbage();
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
			const filename = `terminal-hd-${new SvelteDate().toISOString().slice(0, 10)}.terminal-hd`;
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
						`${p.diskName} — exported ${new SvelteDate(p.exportedAt).toLocaleDateString()}`,
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
									this.fs
										.restoreBackup(data)
										.then((r) => {
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
													body: `${r.error.message}\n\n${RESTORE_RECOVERY_HINT}`,
													buttons: [{ label: 'OK', primary: true }]
												});
											}
										})
										.catch((e) => {
											this.showAlert({
												title: 'Restore Failed',
												body: `${e instanceof Error ? e.message : 'Restore failed unexpectedly.'}\n\n${RESTORE_RECOVERY_HINT}`,
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
