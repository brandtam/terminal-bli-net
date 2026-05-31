import { describe, it, expect } from 'vitest';
import {
	synthAppLibrary,
	synthApps,
	synthWindowAppMap,
	synthWindowAppId,
	synthKnownWindowIds,
	synthWindowDefs,
	synthAppWindowId,
	synthAppIconKind
} from './app-catalog';

/**
 * Locks the catalog's synthesized output to today's known-good values, so a
 * later phase can refactor the manifests/synths and immediately see any drift.
 * These assert the contract the legacy structures used to hardcode.
 */

describe('synthAppLibrary', () => {
	it('produces all 21 apps in original order', () => {
		const ids = synthAppLibrary().map((a) => a.id);
		expect(ids).toEqual([
			'finder',
			'system-prefs',
			'about-terminal',
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
		for (const id of ['system-prefs', 'about-terminal', 'trash', 'error', 'tetra']) {
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
			'terminal-prefs': 'finder',
			welcome: 'finder',
			finder: 'finder',
			'tv-guide': 'tvguide',
			'tvguide-prefs': 'tvguide',
			'chatrbot-prefs': 'chatrbot',
			stats: 'stats',
			about: 'finder',
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
		expect(synthWindowAppId('chat-seinfeld')).toBe('chatrbot');
		expect(synthWindowAppId('sticky-123')).toBe('stickies');
		expect(synthWindowAppId('textedit-readme')).toBe('textedit');
		expect(synthWindowAppId('recorder-clip1')).toBe('recorder');
	});

	it('falls back to finder for unknown windows', () => {
		expect(synthWindowAppId('nope')).toBe('finder');
	});
});

describe('synthKnownWindowIds', () => {
	it('matches the original KNOWN_WINDOW_IDS set', () => {
		expect([...synthKnownWindowIds()].sort()).toEqual(
			[
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

describe('synthWindowDefs', () => {
	it('reproduces representative window defs verbatim', () => {
		const defs = synthWindowDefs();
		expect(defs['tv-guide']).toEqual({ title: 'TV Guide.app', w: 660, h: 700 });
		expect(defs.finder).toEqual({ title: 'Terminal HD', w: 480, h: 420 });
		expect(defs.welcome).toEqual({ title: 'Welcome.app', w: 460, h: 540 });
		expect(defs['about-vcr']).toEqual({ title: 'About VCR', w: 420, h: 460 });
		expect(defs['vcr-prefs']).toEqual({ title: 'VCR Preferences', w: 360, h: 300 });
		expect(defs.recorder).toEqual({ title: 'Camera.app', w: 360, h: 480 });
		expect(defs['computer-store']).toEqual({ title: 'Computer Store', w: 740, h: 620 });
	});

	it('sizes the vcr window to the AG-500R by default', () => {
		// vcrPrefs.device defaults to the AG-500R variant (not 'generic').
		expect(synthWindowDefs().vcr).toEqual({
			title: 'VCR.app',
			w: 900,
			h: 560,
			minW: 620,
			minH: 420
		});
	});

	it('does not add static defs for minted-prefix windows', () => {
		const defs = synthWindowDefs();
		// chat-/sticky-/textedit- have no fixed window.id, so no static entry.
		expect(defs['chat-']).toBeUndefined();
		expect(defs['sticky-']).toBeUndefined();
		expect(defs['textedit-']).toBeUndefined();
	});
});

describe('synthAppWindowId', () => {
	it('matches the original getAppWindowId mapping', () => {
		expect(synthAppWindowId('tvguide')).toBe('tv-guide');
		expect(synthAppWindowId('recorder')).toBe('recorder');
		expect(synthAppWindowId('stats')).toBe('stats');
		expect(synthAppWindowId('vcr')).toBe('vcr');
		expect(synthAppWindowId('system-prefs')).toBe('terminal-prefs');
		expect(synthAppWindowId('about-terminal')).toBe('about');
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
		expect(synthAppIconKind('system-prefs')).toBe('hd');
		expect(synthAppIconKind('finder')).toBe('hd');
		expect(synthAppIconKind('vcr')).toBe('tv');
	});

	it('returns doc as the fallback', () => {
		expect(synthAppIconKind('unknown-app')).toBe('doc');
		expect(synthAppIconKind('textedit')).toBe('doc');
		expect(synthAppIconKind('chatrbot')).toBe('doc');
	});
});
