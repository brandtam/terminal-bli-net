import { describe, it, expect } from 'vitest';
import {
	synthAppLibrary,
	synthApps,
	synthWindowAppMap,
	synthWindowAppId,
	synthAppWindowId,
	synthAppIconKind,
	synthAppIconSprite
} from './app-catalog';

/**
 * Locks the catalog's synthesized output to today's known-good values, so a
 * later phase can refactor the manifests/synths and immediately see any drift.
 * These assert the contract the legacy structures used to hardcode.
 */

describe('synthAppLibrary', () => {
	it('produces all 22 apps in manifest order', () => {
		const ids = synthAppLibrary().map((a) => a.id);
		expect(ids).toEqual([
			'finder',
			'system',
			'welcome',
			'software-shop',
			'computer-store',
			'trash',
			'textedit',
			'stickies',
			'tvguide',
			'chatrbot',
			'recorder',
			'player',
			'stats',
			'error',
			'tetra',
			'solitaire',
			'minesweep',
			'zorquest',
			'calc',
			'paint',
			'dialer',
			'vcr'
		]);
	});

	it('omits status on system apps and keeps it on store apps', () => {
		const lib = synthAppLibrary();
		const finder = lib.find((a) => a.id === 'finder');
		const vcr = lib.find((a) => a.id === 'vcr');
		expect(finder).toBeTruthy();
		expect('status' in finder!).toBe(false);
		expect(vcr?.status).toBe('released');
	});
});

describe('synthApps', () => {
	it('only includes apps with menus/about UI', () => {
		const apps = synthApps();
		const keys = Object.keys(apps).sort();
		expect(keys).toEqual(
			[
				'finder',
				'system',
				'welcome',
				'tvguide',
				'chatrbot',
				'stats',
				'stickies',
				'recorder',
				'player',
				'software-shop',
				'computer-store',
				'vcr',
				'textedit',
				'dialer'
			].sort()
		);
	});

	it('does not register chrome-only / game apps', () => {
		const apps = synthApps();
		for (const id of ['trash', 'error', 'tetra']) {
			expect(apps[id]).toBeUndefined();
		}
	});

	it('maps prefs window-id onto AppDef.preferences', () => {
		const apps = synthApps();
		expect(apps.vcr.preferences).toBe('vcr-prefs');
		expect(apps.tvguide.preferences).toBe('tvguide-prefs');
		expect(apps.chatrbot.preferences).toBe('chatrbot-prefs');
		expect(apps.stats.preferences).toBeNull();
	});
});

describe('synthWindowAppMap', () => {
	it('holds only the error override now that matchWindow owns identity', () => {
		// Every other window reports its app through matchWindow; `error` is the one
		// id whose flat window (appId 'error') must read as Finder chrome.
		expect(synthWindowAppMap()).toEqual({ error: 'finder' });
	});
});

describe('synthWindowAppId', () => {
	it('routes flat windows to their app via matchWindow', () => {
		expect(synthWindowAppId('welcome')).toBe('welcome');
		expect(synthWindowAppId('chat:seinfeld')).toBe('chatrbot');
		expect(synthWindowAppId('sticky:123')).toBe('stickies');
		expect(synthWindowAppId('textedit:readme')).toBe('textedit');
		expect(synthWindowAppId('recorder')).toBe('recorder');
		expect(synthWindowAppId('vcr')).toBe('vcr');
	});

	it('falls back to finder for unknown windows', () => {
		expect(synthWindowAppId('nope')).toBe('finder');
		// Stale `-`-separated ids no longer resolve, so they read as the finder
		// fallback (they get dropped on restore before this is ever reached live).
		expect(synthWindowAppId('sticky-123')).toBe('finder');
		expect(synthWindowAppId('recorder-clip1')).toBe('finder');
	});

	it('routes the OS chrome dialogs to the system app', () => {
		// about / terminal-prefs are owned by the `system` app via its flat
		// windows[], so the menu bar reads "Terminal" while one is focused.
		expect(synthWindowAppId('about')).toBe('system');
		expect(synthWindowAppId('terminal-prefs')).toBe('system');
		// Per-app About boxes are minted as about:<id>; the about: prefix is the
		// system app's too, so they resolve to system (not the named app).
		expect(synthWindowAppId('about:vcr')).toBe('system');
		expect(synthWindowAppId('about:chatrbot')).toBe('system');
	});

	it('keeps error and trash as Finder chrome', () => {
		// error via the override (its appId is 'error'); trash via matchWindow (its
		// flat window lives on the finder manifest).
		expect(synthWindowAppId('error')).toBe('finder');
		expect(synthWindowAppId('trash')).toBe('finder');
	});
});

describe('synthAppWindowId', () => {
	it('matches the original getAppWindowId mapping', () => {
		expect(synthAppWindowId('tvguide')).toBe('tv-guide');
		expect(synthAppWindowId('recorder')).toBe('recorder');
		expect(synthAppWindowId('stats')).toBe('stats');
		expect(synthAppWindowId('vcr')).toBe('vcr');
		expect(synthAppWindowId('error')).toBe('error');
		expect(synthAppWindowId('software-shop')).toBe('software-shop');
		expect(synthAppWindowId('computer-store')).toBe('computer-store');
		expect(synthAppWindowId('welcome')).toBe('welcome');
		expect(synthAppWindowId('finder')).toBe('finder');
	});

	it('returns undefined for apps with no fixed launch window', () => {
		expect(synthAppWindowId('stickies')).toBeUndefined();
		expect(synthAppWindowId('chatrbot')).toBeUndefined();
		expect(synthAppWindowId('textedit')).toBeUndefined();
	});

	it('resolves a flat-model launch window from an exact, role:app entry', () => {
		// The Player has no legacy `window` field — only flat windows[] entries.
		// Its bare launch window is the exact-id 'player' entry, so opening
		// Player.app resolves a real window instead of the app file's node id.
		expect(synthAppWindowId('player')).toBe('player');
	});
});

describe('synthAppIconKind', () => {
	it('matches the original getAppIconKind mapping', () => {
		expect(synthAppIconKind('tvguide')).toBe('tvguide');
		expect(synthAppIconKind('stickies')).toBe('stickies');
		expect(synthAppIconKind('recorder')).toBe('tv');
		expect(synthAppIconKind('stats')).toBe('calc');
		expect(synthAppIconKind('error')).toBe('floppy');
		expect(synthAppIconKind('finder')).toBe('hd');
		expect(synthAppIconKind('vcr')).toBe('tv');
	});

	it('returns doc as the fallback', () => {
		expect(synthAppIconKind('unknown-app')).toBe('doc');
		expect(synthAppIconKind('textedit')).toBe('doc');
		expect(synthAppIconKind('chatrbot')).toBe('doc');
	});
});

describe('synthAppIconSprite', () => {
	it('returns the manifest-supplied sprite for apps that ship one', () => {
		const sprite = synthAppIconSprite('tetra');
		expect(sprite).toBeDefined();
		expect(sprite!.length).toBeGreaterThan(0);
	});

	it('returns undefined for shared-kind apps and unknown ids', () => {
		expect(synthAppIconSprite('finder')).toBeUndefined();
		expect(synthAppIconSprite('unknown-app')).toBeUndefined();
	});
});
