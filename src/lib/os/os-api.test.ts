import { describe, it, expect, vi } from 'vitest';
import { DOCUMENTS_ID, ROOT_ID, TerminalFS, TRASH_ID, type FsFile } from '$lib/terminalos';
import { windowAppId } from './os-api';
import { vcrPrefs } from '$lib/apps/vcr/vcr-prefs.svelte';

// Mock persistence so nothing touches localStorage
vi.mock('$lib/persistence', () => ({
	loadWindows: () => [],
	saveWindows: vi.fn(),
	loadTweaks: () => ({
		wallpaper: 'teal',
		accent: '#f54e00',
		tvGridLoop: 400,
		marqueeLoop: 100,
		tvPauseOnHover: false
	}),
	saveTweaks: vi.fn(),
	loadTimezone: () => null,
	saveTimezone: vi.fn(),
	loadConversations: () => ({}),
	saveConversations: vi.fn(),
	isFirstVisit: () => false,
	clearAllPreferences: vi.fn(),
	// Pulled in transitively via vcr-prefs (device-aware VCR window sizing).
	appRead: (_app: string, _key: string, fallback: unknown) => fallback,
	appWrite: vi.fn(),
	appDelete: vi.fn(),
	// Pulled in transitively via the OS voice layer (audio.svelte.ts).
	loadSoundPrefs: () => ({ muted: false, volume: 0.6 }),
	saveSoundPrefs: vi.fn()
}));

import { OsApiClass } from './os-api.svelte';

function createOs() {
	const fs = TerminalFS.createCleanDisk();
	const os = new OsApiClass(fs);
	return { os, fs };
}

function file(overrides: Partial<FsFile>): FsFile {
	return {
		id: 'file_unknown',
		volumeId: 'volume_terminal_hd',
		kind: 'file',
		parentId: DOCUMENTS_ID,
		name: 'Mystery.bin',
		fileType: 'data',
		createdAt: 1,
		updatedAt: 1,
		...overrides
	};
}

async function createOsWithApp(appId: string) {
	const { os, fs } = createOs();
	await fs.buyApp(appId);
	await fs.installApp(appId);
	return { os, fs };
}

async function waitForCondition(assertion: () => void, timeoutMs = 1000): Promise<void> {
	const startedAt = Date.now();
	let lastError: unknown;
	while (Date.now() - startedAt < timeoutMs) {
		try {
			assertion();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	}
	if (lastError) throw lastError;
}

// ── Window management ─────────────────────────────────────────────────────

describe('window management', () => {
	it('openWindow adds a window with correct fields', () => {
		const { os } = createOs();
		os.openWindow('finder');

		expect(os.windows).toHaveLength(1);
		const w = os.windows[0];
		expect(w.id).toBe('finder');
		expect(typeof w.x).toBe('number');
		expect(typeof w.y).toBe('number');
		expect(typeof w.w).toBe('number');
		expect(typeof w.h).toBe('number');
		expect(typeof w.z).toBe('number');
	});

	it('openWindow sets activeId', () => {
		const { os } = createOs();
		os.openWindow('finder');
		expect(os.activeId).toBe('finder');
	});

	it('openWindow on existing window focuses it instead of duplicating', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');
		os.openWindow('finder');

		expect(os.windows).toHaveLength(2);
		expect(os.activeId).toBe('finder');
	});

	it('closeWindow removes the window', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');
		os.closeWindow('finder');

		expect(os.windows).toHaveLength(1);
		expect(os.windows[0].id).toBe('welcome');
	});

	it('closeWindow clears activeId when closing the active window', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.closeWindow('finder');
		expect(os.activeId).toBeNull();
	});

	it('closeWindow promotes the highest-z remaining window when closing the active window', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');
		os.focusWindow('finder');
		os.openWindow('about');

		os.closeWindow('about');

		expect(os.activeId).toBe('finder');
	});

	it('closeWindow does not clear activeId when closing a non-active window', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');
		os.closeWindow('finder');
		expect(os.activeId).toBe('welcome');
	});

	it('active app follows the promoted window after active close', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');

		os.closeWindow('welcome');

		expect(os.activeId).toBe('finder');
		expect(os.activeAppId).toBe('finder');
	});

	it('focusWindow sets activeId and increments z-order', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');
		const zBefore = os.windows.find((w) => w.id === 'finder')!.z;
		os.focusWindow('finder');
		const zAfter = os.windows.find((w) => w.id === 'finder')!.z;

		expect(os.activeId).toBe('finder');
		expect(zAfter).toBeGreaterThan(zBefore);
	});

	it('moveWindow updates position', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.moveWindow('finder', 100, 200);

		const w = os.windows.find((w) => w.id === 'finder')!;
		expect(w.x).toBe(100);
		expect(w.y).toBe(200);
	});

	it('resizeWindow updates dimensions', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.resizeWindow('finder', 500, 600);

		const w = os.windows.find((w) => w.id === 'finder')!;
		expect(w.w).toBe(500);
		expect(w.h).toBe(600);
	});

	it('z-order normalizes when counter exceeds 1000', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');

		// Focus many times to push the counter past 1000
		for (let i = 0; i < 1001; i++) {
			os.focusWindow(i % 2 === 0 ? 'finder' : 'welcome');
		}

		// After normalization triggers, z values reset to small numbers
		// (they won't be in the thousands)
		const zValues = os.windows.map((w) => w.z).sort((a, b) => a - b);
		expect(zValues[zValues.length - 1]).toBeLessThan(100);
	});
});

// ── Alert lifecycle ───────────────────────────────────────────────────────

describe('alert lifecycle', () => {
	it('showAlert sets alertSpec with an id', () => {
		const { os } = createOs();
		os.showAlert({ title: 'Test', body: 'Hello' });

		expect(os.alertSpec).not.toBeNull();
		expect(os.alertSpec!.title).toBe('Test');
		expect(os.alertSpec!.body).toBe('Hello');
		expect(typeof os.alertSpec!.id).toBe('number');
	});

	it('dismissAlert clears alertSpec to null', () => {
		const { os } = createOs();
		os.showAlert({ title: 'Test', body: 'Hello' });
		os.dismissAlert();
		expect(os.alertSpec).toBeNull();
	});

	it('alert is an alias for showAlert', () => {
		const { os } = createOs();
		os.alert({ title: 'Via Alias', body: 'body' });

		expect(os.alertSpec).not.toBeNull();
		expect(os.alertSpec!.title).toBe('Via Alias');
	});

	it('calling showAlert again replaces the previous alert', () => {
		const { os } = createOs();
		os.showAlert({ title: 'First', body: 'a' });
		const firstId = os.alertSpec!.id;
		os.showAlert({ title: 'Second', body: 'b' });

		expect(os.alertSpec!.title).toBe('Second');
		expect(os.alertSpec!.id).not.toBe(firstId);
	});
});

// ── Tweaks ────────────────────────────────────────────────────────────────

describe('tweaks', () => {
	it('default tweaks have expected values', () => {
		const { os } = createOs();
		expect(os.tweaks.wallpaper).toBe('teal');
		expect(os.tweaks.accent).toBe('#f54e00');
		expect(os.tweaks.tvGridLoop).toBe(400);
		expect(os.tweaks.marqueeLoop).toBe(100);
		expect(os.tweaks.tvPauseOnHover).toBe(false);
	});

	it('setTweak updates the tweaks object', () => {
		const { os } = createOs();
		os.setTweak('wallpaper', 'midnight');
		expect(os.tweaks.wallpaper).toBe('midnight');
	});

	it('setTweak persists via saveTweaks', async () => {
		const { saveTweaks } = await import('$lib/persistence');
		const { os } = createOs();
		os.setTweak('accent', '#000000');
		expect(saveTweaks).toHaveBeenCalled();
	});
});

// ── Folder routing ────────────────────────────────────────────────────────

describe('folder routing', () => {
	it('openFolder opens folder-addressed Finder windows', () => {
		const { os } = createOs();
		os.openFolder(DOCUMENTS_ID);

		expect(os.windows).toHaveLength(1);
		expect(os.windows[0].id).toBe(`finder:${DOCUMENTS_ID}`);
		expect(os.getWindowDef(os.windows[0].id).title).toBe('Documents');
	});

	it('openFolder targets Terminal HD independently from another Finder window', () => {
		const { os } = createOs();
		os.openFolder(DOCUMENTS_ID);
		os.openFolder(ROOT_ID);

		expect(os.windows.map((w) => w.id)).toContain(`finder:${DOCUMENTS_ID}`);
		expect(os.windows.map((w) => w.id)).toContain(`finder:${ROOT_ID}`);
		expect(os.getWindowDef(`finder:${ROOT_ID}`).title).toBe('Terminal HD');
	});

	it('openFolder preserves exact Trash routing', () => {
		const { os } = createOs();
		os.openFolder(TRASH_ID);

		expect(os.windows[0].id).toBe('trash');
		expect(os.getWindowDef('trash').title).toBe('Trash');
	});

	it('openFolder can retarget an existing Finder window id', () => {
		const { os } = createOs();
		os.openWindow('finder');
		const [{ x, y, w, h, z }] = os.windows;

		os.openFolder(DOCUMENTS_ID, { replaceWindowId: 'finder' });

		expect(os.windows).toEqual([{ id: `finder:${DOCUMENTS_ID}`, x, y, w, h, z }]);
		expect(os.activeId).toBe(`finder:${DOCUMENTS_ID}`);
	});

	it('keeps exact finder and trash ids compatible', () => {
		const { os } = createOs();

		expect(os.isKnownWindowId('finder')).toBe(true);
		expect(os.isKnownWindowId('trash')).toBe(true);
		expect(os.isKnownWindowId(`finder:${DOCUMENTS_ID}`)).toBe(true);
	});
});

// ── Document routing ──────────────────────────────────────────────────────

describe('document routing', () => {
	it('openDocument opens known text documents through TextEdit', () => {
		const { os } = createOs();
		os.openDocument(file({ id: 'readme1', name: 'README.TXT', fileType: 'text' }));

		expect(os.windows.map((w) => w.id)).toContain('textedit:readme1');
		expect(os.alertSpec).toBeNull();
	});

	it('openDocument opens sticky notes through Stickies', () => {
		const { os } = createOs();
		os.openDocument(file({ id: 'note1', name: 'Note', fileType: 'sticky' }));

		expect(os.windows.map((w) => w.id)).toContain('sticky:note1');
		expect(os.alertSpec).toBeNull();
	});

	it('openDocument opens recordings through Player', () => {
		const { os } = createOs();
		os.openDocument(file({ id: 'rec1', name: 'Clip.webm', fileType: 'recording' }));

		expect(os.windows.map((w) => w.id)).toContain('player:rec1');
		expect(os.alertSpec).toBeNull();
	});

	it('openDocument alerts for unknown documents without opening a dead window', () => {
		const { os } = createOs();
		os.openDocument(file({ id: 'mystery1', name: 'Mystery.bin', fileType: 'unknown' }));

		expect(os.windows).toHaveLength(0);
		expect(os.alertSpec?.title).toBe('No app can open this document');
		expect(os.alertSpec?.body).toContain('Mystery.bin');
		expect(os.alertSpec?.body).not.toContain('Coming soon');
	});
});

// ── Launch routing ────────────────────────────────────────────────────────

describe('launch routing', () => {
	it('launchApp textedit creates a new document through the manifest handler', async () => {
		const { os } = createOs();
		os.launchApp('textedit', { action: 'new' });
		await waitForCondition(() => expect(os.windows).toHaveLength(1));

		expect(os.windows[0].id).toMatch(/^textedit:/);
		expect(os.getWindowDef(os.windows[0].id).title).toBe('Untitled.txt');
	});

	it('launchApp textedit opens the named README document through the manifest handler', async () => {
		const { os } = createOs();
		os.launchApp('textedit', { open: 'README.TXT' });
		await waitForCondition(() => expect(os.windows).toHaveLength(1));

		expect(os.windows[0].id).toMatch(/^textedit:/);
		expect(os.getWindowDef(os.windows[0].id).title).toBe('README.TXT');
	});

	it('launchApp textedit can present a document picker through the manifest handler', async () => {
		const { os } = createOs();
		os.launchApp('textedit', { action: 'open' });
		await waitForCondition(() => expect(os.alertSpec?.title).toBe('Open Document'));

		expect(os.alertSpec?.buttons?.some((b) => b.label === 'README.TXT')).toBe(true);
	});

	it('launchApp stickies creates a new note through the manifest handler', async () => {
		const { os, fs } = createOs();
		os.launchApp('stickies', { action: 'new' });
		await waitForCondition(() => expect(os.windows).toHaveLength(1));

		expect(os.windows[0].id).toMatch(/^sticky:/);
		const noteId = os.windows[0].id.replace('sticky:', '');
		expect(fs.peekNode(noteId)?.kind).toBe('file');
	});

	it('launchApp stickies applies color to the active note through the manifest handler', async () => {
		const { os, fs } = createOs();
		os.launchApp('stickies', { action: 'new' });
		await waitForCondition(() => expect(os.windows).toHaveLength(1));

		os.launchApp('stickies', { action: 'color', color: '#6bb5ff' });
		await waitForCondition(() => {
			const noteId = os.windows[0].id.replace('sticky:', '');
			expect(fs.readText(noteId)).toContain('#6bb5ff');
		});

		const noteId = os.windows[0].id.replace('sticky:', '');
		expect(fs.readText(noteId)).toContain('#6bb5ff');
	});

	it('launchApp chatrbot opens a show chat through the manifest handler', async () => {
		const { os } = await createOsWithApp('chatrbot');
		const group = {
			slug: 'seinfeld',
			name: 'Seinfeld',
			description: '',
			setting: '',
			era: '',
			image: '',
			active: true
		};
		os.groups = [group];
		const openChat = vi.spyOn(os, 'openChat').mockImplementation(() => {});

		os.launchApp('chatrbot', { showId: 'seinfeld' });

		expect(openChat).toHaveBeenCalledWith(group);
	});

	it('launchApp chatrbot without payload opens its custom launch surface when installed', async () => {
		const { os, fs } = createOs();
		await fs.buyApp('tvguide');
		await fs.installApp('tvguide');
		await fs.buyApp('chatrbot');
		await fs.installApp('chatrbot');

		os.launchApp('chatrbot');

		expect(os.windows.some((w) => w.id === 'tv-guide')).toBe(true);
	});

	it('launchApp blocks uninstalled custom store apps before handler side effects', () => {
		const { os } = createOs();
		const group = {
			slug: 'seinfeld',
			name: 'Seinfeld',
			description: '',
			setting: '',
			era: '',
			image: '',
			active: true
		};
		os.groups = [group];
		const openChat = vi.spyOn(os, 'openChat');

		os.launchApp('chatrbot', { showId: 'seinfeld' });

		expect(openChat).not.toHaveBeenCalled();
		expect(os.alertSpec?.title).toBe('chatrbot is not installed');
	});

	it('launchApp tvguide opens tv-guide window when installed', async () => {
		const { os } = await createOsWithApp('tvguide');
		os.launchApp('tvguide');
		expect(os.windows.some((w) => w.id === 'tv-guide')).toBe(true);
	});

	it('launchApp recorder opens recorder window when installed', async () => {
		const { os } = await createOsWithApp('recorder');
		os.launchApp('recorder');
		expect(os.windows.some((w) => w.id === 'recorder')).toBe(true);
	});

	it('launchApp with unknown app does not crash', () => {
		const { os } = createOs();
		expect(() => os.launchApp('nonexistent-xyz')).not.toThrow();
	});
});

// ── System actions ────────────────────────────────────────────────────────

describe('system actions', () => {
	it('emptyTrash delegates to fs.emptyTrash', async () => {
		const { os, fs } = createOs();
		const spy = vi.spyOn(fs, 'emptyTrash');
		await os.emptyTrash();
		expect(spy).toHaveBeenCalledOnce();
	});

	it('collectFilesystemGarbage delegates to fs.collectGarbage', async () => {
		const { os, fs } = createOs();
		const report = {
			stored: 3,
			reachable: 1,
			unreachable: 2,
			deleted: 1,
			failed: 1,
			failedBodyIds: ['body_failed']
		};
		const spy = vi.spyOn(fs, 'collectGarbage').mockResolvedValue({
			ok: true,
			value: report
		});

		await expect(os.collectFilesystemGarbage()).resolves.toEqual({
			ok: true,
			value: report
		});
		expect(spy).toHaveBeenCalledOnce();
	});

	it('exportBackup collects preferences and passes them to fs', async () => {
		const { os, fs } = createOs();
		const spy = vi.spyOn(fs, 'exportBackup');

		vi.useFakeTimers();
		os.exportBackup();
		await vi.advanceTimersByTimeAsync(2000);
		vi.useRealTimers();

		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({
				tweaks: expect.objectContaining({ wallpaper: 'teal' }),
				conversations: expect.any(Object),
				timezone: null,
				windows: expect.any(Array)
			})
		);
	});

	it('exportBackup shows a progress alert then a completion alert', async () => {
		vi.useFakeTimers();
		const { os, fs } = createOs();

		// Stub exportBackup to return a valid result
		vi.spyOn(fs, 'exportBackup').mockResolvedValue({
			ok: true as const,
			value: {
				format: 'terminal-hd' as const,
				version: 3 as const,
				exportedAt: new Date().toISOString(),
				disk: { id: 'volume_terminal_hd', name: 'Terminal HD' },
				nodes: [],
				bodies: {}
			}
		});

		os.exportBackup();

		expect(os.alertSpec?.title).toBe('Backing Up');
		expect(os.alertSpec?.progress).toBeDefined();

		await vi.advanceTimersByTimeAsync(2000);

		expect(os.alertSpec?.title).toBe('Backup Complete');
		expect(os.alertSpec?.buttons).toHaveLength(2);
		expect(os.alertSpec?.buttons?.[0].label).toBe('Cancel');
		expect(os.alertSpec?.buttons?.[1].label).toBe('Download');

		vi.useRealTimers();
	});

	it('restoreBackup returns window layout in preferences', async () => {
		const { fs } = createOs();

		const windows = [
			{ id: 'welcome', x: 50, y: 50, w: 460, h: 940, z: 1 },
			{ id: 'vcr', x: 600, y: 50, w: 860, h: 833, z: 2 }
		];
		const exported = await fs.exportBackup({
			tweaks: {
				wallpaper: 'teal',
				accent: '#f54e00',
				tvGridLoop: 400,
				marqueeLoop: 100,
				tvPauseOnHover: false
			},
			windows
		});
		if (!exported.ok) throw new Error('export failed');

		const freshFs = TerminalFS.createCleanDisk();
		const result = await freshFs.restoreBackup(exported.value);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.preferences?.windows).toHaveLength(2);
		expect(result.value.preferences?.windows?.[0].id).toBe('welcome');
		expect(result.value.preferences?.windows?.[0].x).toBe(50);
		expect(result.value.preferences?.windows?.[1].id).toBe('vcr');
	});

	it('reinstallOS shows a confirmation alert with Cancel and Reinstall', () => {
		const { os } = createOs();
		os.reinstallOS();

		expect(os.alertSpec?.title).toBe('Reinstall Terminal OS');
		expect(os.alertSpec?.buttons).toHaveLength(2);
		expect(os.alertSpec?.buttons?.[0].label).toBe('Cancel');
		expect(os.alertSpec?.buttons?.[1].label).toBe('Reinstall');
	});
});

// ── Window definition lookup ─────────────────────────────────────────────

describe('window definition lookup', () => {
	it('getWindowDef finder returns correct title and dimensions', () => {
		const { os } = createOs();
		const def = os.getWindowDef('finder');
		expect(def.title).toBe('Terminal HD');
		expect(def.w).toBe(480);
		expect(def.h).toBe(420);
	});

	it('getWindowDef vcr is device-aware through the OS entry point (with min bounds)', () => {
		// getWindowDef threads ctx into the matched spec's size(), and vcr is the one
		// window whose size varies at runtime (it reads vcrPrefs.device). Lock both
		// decks including minW/minH at the real os.getWindowDef path — the device
		// sizing is otherwise only checked at the lower matchWindow level.
		const { os } = createOs();
		const prev = vcrPrefs.device;
		try {
			vcrPrefs.setDevice('ag500r');
			expect(os.getWindowDef('vcr')).toEqual({
				title: 'VCR.app',
				w: 900,
				h: 560,
				minW: 620,
				minH: 420
			});
			vcrPrefs.setDevice('generic');
			expect(os.getWindowDef('vcr')).toEqual({
				title: 'VCR.app',
				w: 560,
				h: 523,
				minW: 480,
				minH: 470
			});
		} finally {
			vcrPrefs.setDevice(prev);
		}
	});

	it('getWindowDef chat:seinfeld derives the title from the slug', () => {
		// Window-host flat app: SpecCtx is {args, fs} only, so the title comes
		// from the slug (the live group name is read inside ChatWindow instead).
		const { os } = createOs();
		const def = os.getWindowDef('chat:seinfeld');
		expect(def.title).toBe('Seinfeld');
		expect(def.w).toBe(440);
		expect(def.h).toBe(560);
	});

	it('getWindowDef chat: title-cases a multi-word slug', () => {
		const { os } = createOs();
		const def = os.getWindowDef('chat:breaking-bad');
		expect(def.title).toBe('Breaking Bad');
	});

	it('getWindowDef textedit:<id> uses the file name for title', () => {
		const { os, fs } = createOs();
		// Find a text file node in the default disk
		const allNodes = fs.getAllNodes();
		let textFileId: string | undefined;
		let textFileName: string | undefined;
		for (const [id, node] of allNodes) {
			if (node.kind === 'file' && node.name.endsWith('.txt')) {
				textFileId = id;
				textFileName = node.name;
				break;
			}
		}

		if (textFileId && textFileName) {
			const def = os.getWindowDef(`textedit:${textFileId}`);
			expect(def.title).toBe(textFileName);
		} else {
			// No .txt on disk: a textedit: id with no matching node falls back to the
			// manifest title.
			const def = os.getWindowDef('textedit:nonexistent');
			expect(def.title).toBe('Untitled.txt');
		}
	});

	it('getWindowDef unknown-id returns fallback', () => {
		const { os } = createOs();
		const def = os.getWindowDef('completely-unknown-id');
		expect(def.title).toBe('Unknown');
		expect(def.w).toBe(380);
		expect(def.h).toBe(320);
	});
});

// ── Known window IDs ──────────────────────────────────────────────────────

describe('isKnownWindowId', () => {
	it('returns true for finder', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('finder')).toBe(true);
	});

	it('returns true for chat: prefix match', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('chat:anything')).toBe(true);
	});

	it('returns false for the legacy chat- separator (dropped on restore)', () => {
		// After the chat: cutover, a window-id saved with the old `-` separator no
		// longer resolves to any app, so the init() restore filter drops it.
		const { os } = createOs();
		expect(os.isKnownWindowId('chat-anything')).toBe(false);
	});

	it('returns true for sticky: prefix match', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('sticky:abc')).toBe(true);
	});

	it('returns false for the legacy sticky- id (dropped on restore)', () => {
		// Stickies migrated to the flat `sticky:` prefix; the old `sticky-` id no
		// longer resolves, so a stale saved layout using it is dropped by init().
		const { os } = createOs();
		expect(os.isKnownWindowId('sticky-abc')).toBe(false);
	});

	it('returns true for textedit: prefix match', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('textedit:xyz')).toBe(true);
	});

	it('returns true for the exact recorder window', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('recorder')).toBe(true);
	});

	it('returns false for the dead recorder- clip prefix (dropped on restore)', () => {
		// Recorder migrated exact-only; the `recorder-` clip-playback prefix is dead
		// (clips open in the Player). A stale recorder- id no longer resolves.
		const { os } = createOs();
		expect(os.isKnownWindowId('recorder-123')).toBe(false);
	});

	it('returns false for random-junk', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('random-junk')).toBe(false);
	});

	it('returns true for every flat-resolvable window id', () => {
		const { os } = createOs();
		// Every live id resolves through matchWindow: system chrome, fixed app
		// windows, prefs dialogs, and a per-app About minted as about:<id>.
		const knownIds = [
			'welcome',
			'about',
			'terminal-prefs',
			'system-maintenance',
			'tv-guide',
			'tvguide-prefs',
			'chatrbot-prefs',
			'vcr-prefs',
			'about:vcr',
			'about:chatrbot',
			'stats',
			'error',
			'trash',
			'recorder',
			'finder',
			'software-shop',
			'computer-store',
			'vcr'
		];
		for (const id of knownIds) {
			expect(os.isKnownWindowId(id), id).toBe(true);
		}
	});

	it('returns false for the dead legacy about-<id> ids (dropped on restore)', () => {
		// The per-app About boxes are about:<id> now; the old about-<id> form no
		// longer resolves, so a stale saved layout using it is dropped by init().
		const { os } = createOs();
		expect(os.isKnownWindowId('about-vcr')).toBe(false);
		expect(os.isKnownWindowId('about-chatrbot')).toBe(false);
	});
});

// ── Navigation routing ────────────────────────────────────────────────────

describe('navigation routing', () => {
	// Per-app About boxes are minted as about:<id> (the system app's flat about:
	// prefix window); openAbout(null) is the system About box, window id 'about'.
	it('openAbout chatrbot opens about:chatrbot window', async () => {
		const { os } = await createOsWithApp('chatrbot');
		os.openAbout('chatrbot');
		expect(os.windows.some((w) => w.id === 'about:chatrbot')).toBe(true);
	});

	it('openAbout null opens about window', () => {
		const { os } = createOs();
		os.openAbout(null);
		expect(os.windows.some((w) => w.id === 'about')).toBe(true);
	});

	it('openAbout tvguide opens about:tvguide', async () => {
		const { os } = await createOsWithApp('tvguide');
		os.openAbout('tvguide');
		expect(os.windows.some((w) => w.id === 'about:tvguide')).toBe(true);
	});

	it('openAbout textedit opens about:textedit', () => {
		const { os } = createOs();
		os.openAbout('textedit');
		expect(os.windows.some((w) => w.id === 'about:textedit')).toBe(true);
	});

	it('openAbout stats opens about:stats', async () => {
		const { os } = await createOsWithApp('stats');
		os.openAbout('stats');
		expect(os.windows.some((w) => w.id === 'about:stats')).toBe(true);
	});

	it('openAbout stickies opens about:stickies', () => {
		const { os } = createOs();
		os.openAbout('stickies');
		expect(os.windows.some((w) => w.id === 'about:stickies')).toBe(true);
	});

	it('openAbout recorder opens about:recorder', async () => {
		const { os } = await createOsWithApp('recorder');
		os.openAbout('recorder');
		expect(os.windows.some((w) => w.id === 'about:recorder')).toBe(true);
	});

	it('openAbout software-shop opens about:software-shop', () => {
		const { os } = createOs();
		os.openAbout('software-shop');
		expect(os.windows.some((w) => w.id === 'about:software-shop')).toBe(true);
	});

	it('openSystemPreferences opens terminal-prefs window', () => {
		const { os } = createOs();
		os.openSystemPreferences();
		expect(os.windows.some((w) => w.id === 'terminal-prefs')).toBe(true);
	});

	it('openSystemMaintenance opens system-maintenance window', () => {
		const { os } = createOs();
		os.openSystemMaintenance();
		expect(os.windows.some((w) => w.id === 'system-maintenance')).toBe(true);
	});

	it('closeFocused closes the active window', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.closeFocused();
		expect(os.windows).toHaveLength(0);
		expect(os.activeId).toBeNull();
	});

	it('closeFocused does nothing when no window is active', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.activeId = null;
		os.closeFocused();
		expect(os.windows).toHaveLength(1);
	});

	it('startNewConversation opens tv-guide when installed', async () => {
		const { os } = await createOsWithApp('tvguide');
		os.startNewConversation();
		expect(os.windows.some((w) => w.id === 'tv-guide')).toBe(true);
	});

	it('listWindows returns the current windows', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');
		const list = os.listWindows();
		expect(list).toHaveLength(2);
		expect(list.map((w) => w.id)).toContain('finder');
		expect(list.map((w) => w.id)).toContain('welcome');
	});
});

// ── Guide API ─────────────────────────────────────────────────────────────

describe('guide API', () => {
	it('guide.shows returns empty array when no groups loaded', () => {
		const { os } = createOs();
		expect(os.guide.shows()).toEqual([]);
	});

	it('guide.shows returns active groups as ShowInfo', () => {
		const { os } = createOs();
		os.groups = [
			{
				slug: 'seinfeld',
				name: 'Seinfeld',
				description: '',
				setting: '',
				era: '',
				image: '',
				active: true
			},
			{
				slug: 'friends',
				name: 'Friends',
				description: '',
				setting: '',
				era: '',
				image: '',
				active: false
			}
		];
		const shows = os.guide.shows();
		expect(shows).toHaveLength(1);
		expect(shows[0].id).toBe('seinfeld');
		expect(shows[0].name).toBe('Seinfeld');
	});

	it('guide.liveCount returns 0 when no channels loaded', () => {
		const { os } = createOs();
		expect(os.guide.liveCount()).toBe(0);
	});

	it('guide.nextAiring returns fallback string', () => {
		const { os } = createOs();
		expect(os.guide.nextAiring('anything')).toBe('Check the TV Guide');
	});
});

// ── Derived state ─────────────────────────────────────────────────────────

describe('derived state', () => {
	it('activeAppId returns finder when no window is active', () => {
		const { os } = createOs();
		expect(os.activeAppId).toBe('finder');
	});

	it('activeAppId returns chatrbot for chat: windows', async () => {
		const { os } = await createOsWithApp('chatrbot');
		os.openWindow('chat:seinfeld');
		expect(os.activeAppId).toBe('chatrbot');
	});

	it('activeAppId returns tvguide for tv-guide window', async () => {
		const { os } = await createOsWithApp('tvguide');
		os.openWindow('tv-guide');
		expect(os.activeAppId).toBe('tvguide');
	});

	// The OS chrome dialogs are owned by the `system` app, so the menu bar reads
	// "Terminal" while one is focused (Slice 5, decision 1). These lock that
	// menu-bar identity at the os-api level, not just synthWindowAppId.
	it('activeAppId returns system for the system About box (openAbout null)', () => {
		const { os } = createOs();
		os.openAbout(null);
		expect(os.activeAppId).toBe('system');
	});

	it('activeAppId returns system for a per-app About box (about:<id>)', async () => {
		const { os } = await createOsWithApp('chatrbot');
		os.openAbout('chatrbot');
		expect(os.activeAppId).toBe('system');
	});

	it('activeAppId returns welcome for the Welcome app window', () => {
		const { os } = createOs();
		os.openWindow('welcome');
		expect(os.activeAppId).toBe('welcome');
	});

	it('activeAppId returns system for System Preferences', () => {
		const { os } = createOs();
		os.openSystemPreferences();
		expect(os.activeAppId).toBe('system');
	});

	it('activeAppId returns system for System Maintenance', () => {
		const { os } = createOs();
		os.openSystemMaintenance();
		expect(os.activeAppId).toBe('system');
	});

	it('activeChatGroupSlug returns null when no chat window active', () => {
		const { os } = createOs();
		os.openWindow('finder');
		expect(os.activeChatGroupSlug).toBeNull();
	});

	it('activeChatGroupSlug returns slug for active chat window', async () => {
		const { os } = await createOsWithApp('chatrbot');
		os.openWindow('chat:seinfeld');
		expect(os.activeChatGroupSlug).toBe('seinfeld');
	});
});

// ── Dock aliases ──────────────────────────────────────────────────────────

describe('dock aliases', () => {
	it('openWindow with dock alias chat routes to tv-guide when installed', async () => {
		const { os } = await createOsWithApp('tvguide');
		os.initDockAliases(() => {});
		os.openWindow('chat');
		expect(os.windows.some((w) => w.id === 'tv-guide')).toBe(true);
	});

	it('openWindow with dock alias pricing calls the handler', () => {
		const { os } = createOs();
		const openFile = vi.fn();
		os.initDockAliases(openFile);
		os.openWindow('pricing');
		expect(openFile).toHaveBeenCalledWith('Pricing.txt');
	});
});

// ── Store app install gate ────────────────────────────────────────────────

describe('store app install gate', () => {
	it('blocks unowned store app and shows purchase alert', () => {
		const { os } = createOs();
		os.openWindow('tv-guide');

		expect(os.windows).toHaveLength(0);
		expect(os.alertSpec?.title).toBe('TV Guide is not installed');
		expect(os.alertSpec?.body).toContain('Computer Store');
		expect(os.alertSpec?.buttons?.[0].label).toBe('Visit Store');
	});

	it('blocks owned-but-not-installed store app and shows shelf alert', async () => {
		const { os, fs } = createOs();
		await fs.buyApp('tvguide');
		os.openWindow('tv-guide');

		expect(os.windows).toHaveLength(0);
		expect(os.alertSpec?.title).toBe('TV Guide is not installed');
		expect(os.alertSpec?.body).toContain('My Shelf');
		expect(os.alertSpec?.buttons?.[0].label).toBe('Open My Shelf');
	});

	it('allows installed store app to open', async () => {
		const { os } = await createOsWithApp('tvguide');
		os.openWindow('tv-guide');

		expect(os.windows).toHaveLength(1);
		expect(os.windows[0].id).toBe('tv-guide');
		expect(os.alertSpec).toBeNull();
	});

	it('does not gate system apps', () => {
		const { os } = createOs();
		os.openWindow('finder');

		expect(os.windows).toHaveLength(1);
		expect(os.alertSpec).toBeNull();
	});

	it('blocks chat windows when chatrbot is not installed', () => {
		const { os } = createOs();
		os.openWindow('chat:seinfeld');

		expect(os.windows).toHaveLength(0);
		expect(os.alertSpec?.title).toBe('chatrbot is not installed');
	});

	it('opens about windows even for uninstalled store apps (system chrome)', () => {
		// About boxes are owned by the `system` app now (window id about:<id>), so
		// the open path is no longer install-gated through the named store app. In
		// practice this is only reachable from the app's own Help menu — which needs
		// the app installed and running — but the routing no longer blocks it.
		const { os } = createOs();
		os.openAbout('tvguide');

		expect(os.windows.some((w) => w.id === 'about:tvguide')).toBe(true);
		expect(os.alertSpec).toBeNull();
	});

	it('purchase alert Visit Store button opens computer-store', () => {
		const { os } = createOs();
		os.openWindow('tv-guide');

		const visitBtn = os.alertSpec?.buttons?.[0];
		expect(visitBtn?.label).toBe('Visit Store');
		visitBtn?.action?.();

		expect(os.windows.some((w) => w.id === 'computer-store')).toBe(true);
	});

	it('shelf alert Open My Shelf button opens software-shop', async () => {
		const { os, fs } = createOs();
		await fs.buyApp('recorder');
		os.openWindow('recorder');

		const shelfBtn = os.alertSpec?.buttons?.[0];
		expect(shelfBtn?.label).toBe('Open My Shelf');
		shelfBtn?.action?.();

		expect(os.windows.some((w) => w.id === 'software-shop')).toBe(true);
	});
});

// ── Timezone ──────────────────────────────────────────────────────────────

describe('timezone', () => {
	it('setTimezone stores a timezone string', async () => {
		const { saveTimezone } = await import('$lib/persistence');
		const { os } = createOs();
		os.setTimezone('America/New_York');
		expect(os.timezone).toBe('America/New_York');
		expect(saveTimezone).toHaveBeenCalledWith('America/New_York');
	});
});

// ── Window app ID mapping ────────────────────────────────────────────────

describe('windowAppId', () => {
	it('maps store app window IDs to their app IDs', () => {
		expect(windowAppId('welcome')).toBe('welcome');
		expect(windowAppId('tv-guide')).toBe('tvguide');
		expect(windowAppId('recorder')).toBe('recorder');
		expect(windowAppId('vcr')).toBe('vcr');
		expect(windowAppId('stats')).toBe('stats');
		expect(windowAppId('software-shop')).toBe('software-shop');
		expect(windowAppId('computer-store')).toBe('computer-store');
	});

	it('maps prefix-based window IDs', () => {
		expect(windowAppId('chat:seinfeld')).toBe('chatrbot');
		expect(windowAppId('sticky:abc')).toBe('stickies');
		expect(windowAppId('textedit:xyz')).toBe('textedit');
		expect(windowAppId('player:clip1')).toBe('player');
	});

	it('maps per-app About windows to the system app (about:<id>)', () => {
		// About boxes live on the `system` app's flat about: prefix window, so their
		// menu-bar identity is "Terminal", not the named app. (The old about-<id>
		// form is dead — see the isKnownWindowId drop test.)
		expect(windowAppId('about:vcr')).toBe('system');
		expect(windowAppId('about:chatrbot')).toBe('system');
		expect(windowAppId('about:tvguide')).toBe('system');
		expect(windowAppId('system-maintenance')).toBe('system');
	});

	it('falls back to finder for unknown IDs', () => {
		expect(windowAppId('unknown-thing')).toBe('finder');
	});
});
