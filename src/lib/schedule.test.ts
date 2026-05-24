import { describe, it, expect } from 'vitest';
import {
	isSlotActive,
	isOnAir,
	nextOnAir,
	currentlyAiring,
	validateOverlapInvariant,
	minutesRemaining,
	formatTimeUntil,
	formatSlotTime
} from './schedule';
import type { GroupMeta, Slot } from './types';

function makeDate(dayOfWeek: number, hour: number, minute: number): Date {
	// 2026-01-04 is a Sunday (dayOfWeek 0)
	const d = new Date(2026, 0, 4 + dayOfWeek, hour, minute, 0, 0);
	return d;
}

const slot: Slot = { day: 'mon', start: '20:00', duration: 120 };

const makeGroup = (schedule: Slot[], active = true): GroupMeta => ({
	slug: 'test',
	name: 'Test Show',
	description: 'A test show',
	setting: 'Test City',
	era: '2020s',
	image: '/test.png',
	active,
	schedule
});

describe('isSlotActive', () => {
	it('returns true during the slot', () => {
		const now = makeDate(1, 21, 0); // Mon 9pm
		expect(isSlotActive(slot, now)).toBe(true);
	});

	it('returns true at slot start', () => {
		const now = makeDate(1, 20, 0); // Mon 8pm
		expect(isSlotActive(slot, now)).toBe(true);
	});

	it('returns false at slot end', () => {
		const now = makeDate(1, 22, 0); // Mon 10pm
		expect(isSlotActive(slot, now)).toBe(false);
	});

	it('returns false before slot', () => {
		const now = makeDate(1, 19, 59);
		expect(isSlotActive(slot, now)).toBe(false);
	});

	it('returns false on wrong day', () => {
		const now = makeDate(2, 21, 0); // Tue 9pm
		expect(isSlotActive(slot, now)).toBe(false);
	});

	it('handles wrap-around slot (Sat night into Sun morning)', () => {
		const wrapSlot: Slot = { day: 'sat', start: '23:00', duration: 120 };
		const satNight = makeDate(6, 23, 30); // Sat 11:30pm
		const sunMorning = makeDate(0, 0, 30); // Sun 12:30am
		const sunLate = makeDate(0, 1, 30); // Sun 1:30am (past end)

		expect(isSlotActive(wrapSlot, satNight)).toBe(true);
		expect(isSlotActive(wrapSlot, sunMorning)).toBe(true);
		expect(isSlotActive(wrapSlot, sunLate)).toBe(false);
	});
});

describe('isOnAir', () => {
	it('returns true when any slot is active', () => {
		const group = makeGroup([slot, { day: 'wed', start: '10:00', duration: 180 }]);
		expect(isOnAir(group, makeDate(3, 11, 0))).toBe(true);
	});

	it('returns false when no slot is active', () => {
		const group = makeGroup([slot]);
		expect(isOnAir(group, makeDate(2, 12, 0))).toBe(false);
	});

	it('returns false when group is inactive', () => {
		const group = makeGroup([slot], false);
		expect(isOnAir(group, makeDate(1, 21, 0))).toBe(false);
	});
});

describe('minutesRemaining', () => {
	it('returns correct minutes remaining during a slot', () => {
		const group = makeGroup([slot]);
		const result = minutesRemaining(group, makeDate(1, 21, 0));
		expect(result).toBe(60);
	});

	it('returns null when not on air', () => {
		const group = makeGroup([slot]);
		expect(minutesRemaining(group, makeDate(2, 12, 0))).toBeNull();
	});
});

describe('nextOnAir', () => {
	it('returns next slot when off-air', () => {
		const group = makeGroup([slot]);
		const result = nextOnAir(group, makeDate(1, 12, 0));
		expect(result).not.toBeNull();
		expect(result!.day).toBe('mon');
		expect(result!.start).toBe('20:00');
		expect(result!.minutesUntil).toBe(480);
	});

	it('returns null when on-air', () => {
		const group = makeGroup([slot]);
		expect(nextOnAir(group, makeDate(1, 21, 0))).toBeNull();
	});

	it('wraps around the week correctly', () => {
		const group = makeGroup([{ day: 'mon', start: '10:00', duration: 60 }]);
		const result = nextOnAir(group, makeDate(6, 12, 0)); // Saturday noon
		expect(result).not.toBeNull();
		expect(result!.day).toBe('mon');
	});
});

describe('currentlyAiring', () => {
	it('filters to only on-air groups', () => {
		const g1 = makeGroup([slot]);
		const g2 = makeGroup([{ day: 'tue', start: '10:00', duration: 60 }]);
		const result = currentlyAiring([g1, g2], makeDate(1, 21, 0));
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe('test');
	});
});

describe('validateOverlapInvariant', () => {
	it('detects gaps in coverage', () => {
		const g = makeGroup([slot]);
		const result = validateOverlapInvariant([g]);
		expect(result.valid).toBe(false);
		expect(result.gaps.length).toBeGreaterThan(0);
	});

	it('validates full coverage', () => {
		const fullCoverage: Slot[] = [];
		const days: Array<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'> = [
			'sun',
			'mon',
			'tue',
			'wed',
			'thu',
			'fri',
			'sat'
		];
		for (const day of days) {
			fullCoverage.push({ day, start: '00:00', duration: 1440 });
		}
		const g = makeGroup(fullCoverage);
		const result = validateOverlapInvariant([g]);
		expect(result.valid).toBe(true);
		expect(result.gaps).toHaveLength(0);
	});
});

describe('formatTimeUntil', () => {
	it('formats minutes only', () => {
		expect(formatTimeUntil(45)).toBe('45 min');
	});

	it('formats hours and minutes', () => {
		expect(formatTimeUntil(90)).toBe('1h 30m');
	});

	it('formats even hours', () => {
		expect(formatTimeUntil(120)).toBe('2h');
	});
});

describe('formatSlotTime', () => {
	it('formats a standard slot', () => {
		expect(formatSlotTime('20:00', 120)).toBe('8PM–10PM');
	});

	it('formats with minutes', () => {
		expect(formatSlotTime('20:30', 90)).toBe('8:30PM–10PM');
	});
});
