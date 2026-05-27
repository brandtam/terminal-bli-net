import { describe, it, expect, vi } from 'vitest';
import { TerminalFS } from '$lib/terminalos';

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
	clearAllPreferences: vi.fn()
}));

import { OsApiClass } from './os-api.svelte';

function createOs() {
	const fs = TerminalFS.createCleanDisk();
	const os = new OsApiClass(fs);
	return { os, fs };
}

async function createOsWithApp(appId: string) {
	const { os, fs } = createOs();
	await fs.buyApp(appId);
	await fs.installApp(appId);
	return { os, fs };
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

	it('closeWindow does not clear activeId when closing a non-active window', () => {
		const { os } = createOs();
		os.openWindow('finder');
		os.openWindow('welcome');
		os.closeWindow('finder');
		expect(os.activeId).toBe('welcome');
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

// ── Launch routing ────────────────────────────────────────────────────────

describe('launch routing', () => {
	it('registerLaunchHandler registers a handler that launchApp calls', () => {
		const { os } = createOs();
		const handler = vi.fn();
		os.registerLaunchHandler('custom-app', handler);
		os.launchApp('custom-app');
		expect(handler).toHaveBeenCalledOnce();
	});

	it('launchApp passes payload to the handler', () => {
		const { os } = createOs();
		const handler = vi.fn();
		os.registerLaunchHandler('custom-app', handler);
		os.launchApp('custom-app', { file: 'test.txt' });
		expect(handler).toHaveBeenCalledWith({ file: 'test.txt' });
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
				version: 2 as const,
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

	it('getWindowDef chat-seinfeld uses group name for title', () => {
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
			}
		];
		const def = os.getWindowDef('chat-seinfeld');
		expect(def.title).toBe('chatrbot - Seinfeld');
	});

	it('getWindowDef chat-unknown returns fallback Chat title', () => {
		const { os } = createOs();
		const def = os.getWindowDef('chat-unknown');
		expect(def.title).toBe('Chat');
	});

	it('getWindowDef textedit-someid uses file name for title', () => {
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
			const def = os.getWindowDef(`textedit-${textFileId}`);
			expect(def.title).toBe(textFileName);
		} else {
			// If no .txt exists, any textedit- prefix with no matching node falls back
			const def = os.getWindowDef('textedit-nonexistent');
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

	it('returns true for chat- prefix match', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('chat-anything')).toBe(true);
	});

	it('returns true for sticky- prefix match', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('sticky-abc')).toBe(true);
	});

	it('returns true for textedit- prefix match', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('textedit-xyz')).toBe(true);
	});

	it('returns true for recorder- prefix match', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('recorder-123')).toBe(true);
	});

	it('returns false for random-junk', () => {
		const { os } = createOs();
		expect(os.isKnownWindowId('random-junk')).toBe(false);
	});

	it('returns true for all static known IDs', () => {
		const { os } = createOs();
		const knownIds = [
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
		];
		for (const id of knownIds) {
			expect(os.isKnownWindowId(id)).toBe(true);
		}
	});
});

// ── Navigation routing ────────────────────────────────────────────────────

describe('navigation routing', () => {
	it('openAbout chatrbot opens about-chatrbot window', async () => {
		const { os } = await createOsWithApp('chatrbot');
		os.openAbout('chatrbot');
		expect(os.windows.some((w) => w.id === 'about-chatrbot')).toBe(true);
	});

	it('openAbout null opens about window', () => {
		const { os } = createOs();
		os.openAbout(null);
		expect(os.windows.some((w) => w.id === 'about')).toBe(true);
	});

	it('openAbout tvguide opens about-tvguide', async () => {
		const { os } = await createOsWithApp('tvguide');
		os.openAbout('tvguide');
		expect(os.windows.some((w) => w.id === 'about-tvguide')).toBe(true);
	});

	it('openAbout textedit opens about-textedit', () => {
		const { os } = createOs();
		os.openAbout('textedit');
		expect(os.windows.some((w) => w.id === 'about-textedit')).toBe(true);
	});

	it('openAbout stats opens about-stats', async () => {
		const { os } = await createOsWithApp('stats');
		os.openAbout('stats');
		expect(os.windows.some((w) => w.id === 'about-stats')).toBe(true);
	});

	it('openAbout stickies opens about-stickies', () => {
		const { os } = createOs();
		os.openAbout('stickies');
		expect(os.windows.some((w) => w.id === 'about-stickies')).toBe(true);
	});

	it('openAbout recorder opens about-recorder', async () => {
		const { os } = await createOsWithApp('recorder');
		os.openAbout('recorder');
		expect(os.windows.some((w) => w.id === 'about-recorder')).toBe(true);
	});

	it('openAbout software-shop opens about-software-shop', () => {
		const { os } = createOs();
		os.openAbout('software-shop');
		expect(os.windows.some((w) => w.id === 'about-software-shop')).toBe(true);
	});

	it('openSystemPreferences opens terminal-prefs window', () => {
		const { os } = createOs();
		os.openSystemPreferences();
		expect(os.windows.some((w) => w.id === 'terminal-prefs')).toBe(true);
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

	it('activeAppId returns chatrbot for chat- windows', async () => {
		const { os } = await createOsWithApp('chatrbot');
		os.openWindow('chat-seinfeld');
		expect(os.activeAppId).toBe('chatrbot');
	});

	it('activeAppId returns tvguide for tv-guide window', async () => {
		const { os } = await createOsWithApp('tvguide');
		os.openWindow('tv-guide');
		expect(os.activeAppId).toBe('tvguide');
	});

	it('activeChatGroupSlug returns null when no chat window active', () => {
		const { os } = createOs();
		os.openWindow('finder');
		expect(os.activeChatGroupSlug).toBeNull();
	});

	it('activeChatGroupSlug returns slug for active chat window', async () => {
		const { os } = await createOsWithApp('chatrbot');
		os.openWindow('chat-seinfeld');
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
		os.openWindow('chat-seinfeld');

		expect(os.windows).toHaveLength(0);
		expect(os.alertSpec?.title).toBe('chatrbot is not installed');
	});

	it('blocks about windows for uninstalled store apps', () => {
		const { os } = createOs();
		os.openAbout('tvguide');

		expect(os.windows).toHaveLength(0);
		expect(os.alertSpec?.title).toBe('TV Guide is not installed');
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
