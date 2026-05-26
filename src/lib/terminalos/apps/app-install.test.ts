import { describe, it, expect } from 'vitest';
import { getAppWindowId, getAppIconKind, isSpecialLaunchApp } from './app-install';

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
