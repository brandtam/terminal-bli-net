import { describe, it, expect } from 'vitest';
import {
	getAppWindowId,
	getAppIconKind,
	getAppLaunchStrategy,
	isLaunchableApp,
	isSpecialLaunchApp
} from './app-install';
import { APP_LIBRARY } from './app-library';

describe('getAppWindowId', () => {
	it('maps tvguide to tv-guide', () => {
		expect(getAppWindowId('tvguide')).toBe('tv-guide');
	});

	it('maps stats to stats', () => {
		expect(getAppWindowId('stats')).toBe('stats');
	});

	it('returns undefined for unknown app', () => {
		expect(getAppWindowId('nonexistent')).toBeUndefined();
	});

	it('returns undefined for stickies (special launch)', () => {
		expect(getAppWindowId('stickies')).toBeUndefined();
	});

	it('returns undefined for chatrbot (special launch)', () => {
		expect(getAppWindowId('chatrbot')).toBeUndefined();
	});

	it('returns undefined for textedit (special launch)', () => {
		expect(getAppWindowId('textedit')).toBeUndefined();
	});
});

describe('getAppIconKind', () => {
	it('maps tvguide to tvguide icon', () => {
		expect(getAppIconKind('tvguide')).toBe('tvguide');
	});

	it('maps stickies to stickies icon', () => {
		expect(getAppIconKind('stickies')).toBe('stickies');
	});

	it('returns doc for unknown app', () => {
		expect(getAppIconKind('nonexistent')).toBe('doc');
	});
});

describe('getAppLaunchStrategy', () => {
	it('derives fixed-window launch for fixed app windows', () => {
		expect(getAppLaunchStrategy('tvguide')).toEqual({ kind: 'fixed', windowId: 'tv-guide' });
		expect(getAppLaunchStrategy('recorder')).toEqual({ kind: 'fixed', windowId: 'recorder' });
	});

	it('derives custom launch from manifest metadata', () => {
		expect(getAppLaunchStrategy('stickies').kind).toBe('custom');
		expect(getAppLaunchStrategy('chatrbot').kind).toBe('custom');
		expect(getAppLaunchStrategy('textedit').kind).toBe('custom');
	});

	it('returns none for unknown and catalog-only apps', () => {
		expect(getAppLaunchStrategy('nonexistent').kind).toBe('none');
		expect(getAppLaunchStrategy('tetra').kind).toBe('none');
	});

	it('proves every released app is launchable', () => {
		const released = APP_LIBRARY.filter((a) => a.status === 'released');
		expect(released.length).toBeGreaterThan(0);
		for (const app of released) {
			expect(isLaunchableApp(app.id), `${app.id} is released but not launchable`).toBe(true);
		}
	});
});

describe('isSpecialLaunchApp', () => {
	it('identifies stickies as special', () => {
		expect(isSpecialLaunchApp('stickies')).toBe(true);
	});

	it('identifies chatrbot as special', () => {
		expect(isSpecialLaunchApp('chatrbot')).toBe(true);
	});

	it('identifies textedit as special', () => {
		expect(isSpecialLaunchApp('textedit')).toBe(true);
	});

	it('does not identify tvguide as special', () => {
		expect(isSpecialLaunchApp('tvguide')).toBe(false);
	});
});
