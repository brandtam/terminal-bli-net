import { describe, it, expect } from 'vitest';
import {
	synthAppLibrary,
	synthApps,
	synthWindowAppMap,
	synthWindowAppId,
	synthKnownWindowIds,
	synthAppWindowId,
	synthAppIconKind
} from './app-catalog';

/**
 * Locks the catalog's synthesized output to today's known-good values, so a
 * later phase can refactor the manifests/synths and immediately see any drift.
 * These assert the contract the legacy structures used to hardcode.
 */

describe('synthAppLibrary', () => {
	it('produces all 20 apps in original order', () => {
		const ids = synthAppLibrary().map((a) => a.id);
		expect(ids).toEqual([
			'finder',
			'system',
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
				'tvguide',
				'chatrbot',
				'stats',
				'stickies',
				'recorder',
				'player',
				'software-shop',
				'computer-store',
				'vcr',
				'textedit'
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
	it('matches the original WINDOW_APP_MAP exactly', () => {
		expect(synthWindowAppMap()).toEqual({
			finder: 'finder',
			'tv-guide': 'tvguide',
			'tvguide-prefs': 'tvguide',
			'chatrbot-prefs': 'chatrbot',
			stats: 'stats',
			'about-chatrbot': 'chatrbot',
			'about-tvguide': 'tvguide',
			'about-textedit': 'textedit',
			'about-stats': 'stats',
			'about-stickies': 'stickies',
			error: 'finder',
			trash: 'finder',
			recorder: 'recorder',
			'about-recorder': 'recorder',
			'software-shop': 'software-shop',
			'about-software-shop': 'software-shop',
			'computer-store': 'computer-store',
			'about-computer-store': 'computer-store',
			vcr: 'vcr',
			'vcr-prefs': 'vcr',
			'about-vcr': 'vcr'
		});
	});
});

describe('synthWindowAppId', () => {
	it('routes prefixes to their app', () => {
		expect(synthWindowAppId('chat:seinfeld')).toBe('chatrbot');
		expect(synthWindowAppId('sticky-123')).toBe('stickies');
		expect(synthWindowAppId('textedit-readme')).toBe('textedit');
		expect(synthWindowAppId('recorder-clip1')).toBe('recorder');
	});

	it('falls back to finder for unknown windows', () => {
		expect(synthWindowAppId('nope')).toBe('finder');
	});

	it('routes the OS chrome dialogs to the system app', () => {
		// welcome / about / terminal-prefs are owned by the `system` app via its
		// flat windows[], so the menu bar reads "Terminal" while one is focused.
		expect(synthWindowAppId('welcome')).toBe('system');
		expect(synthWindowAppId('about')).toBe('system');
		expect(synthWindowAppId('terminal-prefs')).toBe('system');
		// Per-app About boxes are minted as about:<id>; the about: prefix is the
		// system app's too, so they resolve to system (not the named app).
		expect(synthWindowAppId('about:vcr')).toBe('system');
		expect(synthWindowAppId('about:chatrbot')).toBe('system');
	});

	it('keeps error and trash as Finder chrome', () => {
		expect(synthWindowAppId('error')).toBe('finder');
		expect(synthWindowAppId('trash')).toBe('finder');
	});
});

describe('synthKnownWindowIds', () => {
	it('matches the original KNOWN_WINDOW_IDS set', () => {
		// welcome / terminal-prefs / about dropped from the static set — the system
		// app declares them as flat windows, so isKnownWindowId resolves them via
		// matchWindow instead (see window-host.test.ts).
		expect([...synthKnownWindowIds()].sort()).toEqual(
			[
				'tv-guide',
				'tvguide-prefs',
				'chatrbot-prefs',
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
				'software-shop',
				'computer-store',
				'about-computer-store',
				'vcr',
				'vcr-prefs',
				'about-vcr'
			].sort()
		);
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
