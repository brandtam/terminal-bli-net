import { describe, it, expect } from 'vitest';
import {
	isSlotActive,
	isOnAir,
	nextOnAir,
	currentlyAiring,
	validateOverlapInvariant,
	minutesRemaining,
	formatTimeUntil,
	formatSlotTime,
	getSlotIndex,
	getCurrentSlot,
	isShowOnAir,
	getEpisodePremise
} from './schedule';
import type { GroupMeta, Slot, Channel, Show } from './types';

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

// ─── New channel-based schedule functions ───────────────────────────────────

describe('getSlotIndex', () => {
	it('returns 0 at midnight', () => {
		const now = makeDate(0, 0, 0); // 00:00
		expect(getSlotIndex(now)).toBe(0);
	});

	it('returns 0 at 00:29', () => {
		const now = makeDate(0, 0, 29); // 00:29
		expect(getSlotIndex(now)).toBe(0);
	});

	it('returns 1 at 00:30', () => {
		const now = makeDate(0, 0, 30); // 00:30
		expect(getSlotIndex(now)).toBe(1);
	});

	it('returns 47 at 23:30', () => {
		const now = makeDate(0, 23, 30); // 23:30
		expect(getSlotIndex(now)).toBe(47);
	});

	it('returns 47 at 23:59', () => {
		const now = makeDate(0, 23, 59); // 23:59
		expect(getSlotIndex(now)).toBe(47);
	});

	it('returns 24 at noon', () => {
		const now = makeDate(3, 12, 0); // 12:00
		expect(getSlotIndex(now)).toBe(24);
	});

	it('returns 25 at 12:30', () => {
		const now = makeDate(3, 12, 30); // 12:30
		expect(getSlotIndex(now)).toBe(25);
	});
});

describe('getCurrentSlot', () => {
	const channel: Channel = {
		slug: 'ch-drama',
		name: 'Drama Channel',
		number: 1,
		network: 'CHATR',
		schedule: Array(48).fill(null)
	};

	it('returns null when the slot is empty', () => {
		const now = makeDate(1, 10, 0); // slot 20
		expect(getCurrentSlot(channel, now)).toBeNull();
	});

	it('returns the ChannelSlot when a show is scheduled', () => {
		const ch: Channel = {
			...channel,
			schedule: channel.schedule.map((_, i) =>
				i === 20 ? { showSlug: 'breaking-bad', season: 1, episode: 3 } : null
			)
		};
		const now = makeDate(1, 10, 15); // slot 20 (10:00-10:29)
		const result = getCurrentSlot(ch, now);
		expect(result).toEqual({ showSlug: 'breaking-bad', season: 1, episode: 3 });
	});

	it('returns the correct slot at the boundary (slot 47)', () => {
		const ch: Channel = {
			...channel,
			schedule: channel.schedule.map((_, i) =>
				i === 47 ? { showSlug: 'late-night', season: 2, episode: 1 } : null
			)
		};
		const now = makeDate(0, 23, 45);
		const result = getCurrentSlot(ch, now);
		expect(result).toEqual({ showSlug: 'late-night', season: 2, episode: 1 });
	});
});

describe('isShowOnAir', () => {
	const channels: Channel[] = [
		{
			slug: 'ch-1',
			name: 'Channel One',
			number: 1,
			network: 'CHATR',
			schedule: Array(48)
				.fill(null)
				.map((_, i) => (i === 20 ? { showSlug: 'seinfeld', season: 3, episode: 5 } : null))
		},
		{
			slug: 'ch-2',
			name: 'Channel Two',
			number: 2,
			network: 'CHATR',
			schedule: Array(48)
				.fill(null)
				.map((_, i) => (i === 20 ? { showSlug: 'friends', season: 1, episode: 1 } : null))
		}
	];

	it('returns true when the show is on one channel', () => {
		const now = makeDate(1, 10, 0); // slot 20
		expect(isShowOnAir('seinfeld', channels, now)).toBe(true);
	});

	it('returns false when the show is not on any channel', () => {
		const now = makeDate(1, 10, 0); // slot 20
		expect(isShowOnAir('breaking-bad', channels, now)).toBe(false);
	});

	it('returns false when the show exists but is in a different slot', () => {
		const now = makeDate(1, 11, 0); // slot 22
		expect(isShowOnAir('seinfeld', channels, now)).toBe(false);
	});

	it('returns true when the show is on multiple channels', () => {
		const multiChannels: Channel[] = [
			{
				slug: 'ch-a',
				name: 'A',
				number: 1,
				network: 'CHATR',
				schedule: Array(48)
					.fill(null)
					.map((_, i) => (i === 10 ? { showSlug: 'office', season: 1, episode: 1 } : null))
			},
			{
				slug: 'ch-b',
				name: 'B',
				number: 2,
				network: 'CHATR',
				schedule: Array(48)
					.fill(null)
					.map((_, i) => (i === 10 ? { showSlug: 'office', season: 2, episode: 3 } : null))
			}
		];
		const now = makeDate(0, 5, 0); // slot 10
		expect(isShowOnAir('office', multiChannels, now)).toBe(true);
	});
});

describe('getEpisodePremise', () => {
	const shows: Show[] = [
		{
			slug: 'seinfeld',
			name: 'Seinfeld',
			description: 'A show about nothing',
			setting: 'NYC',
			era: '1990s',
			image: '/seinfeld.png',
			active: true,
			episodes: [
				{ season: 1, episode: 1, title: 'The Pilot', year: '1989', premise: 'Jerry does stand-up.' },
				{
					season: 1,
					episode: 2,
					title: 'The Stake Out',
					year: '1990',
					premise: 'Jerry stakes out a lobby.'
				},
				{
					season: 3,
					episode: 5,
					title: 'The Pen',
					year: '1991',
					premise: 'Jerry borrows a pen.'
				}
			]
		},
		{
			slug: 'friends',
			name: 'Friends',
			description: 'Six friends in NYC',
			setting: 'NYC',
			era: '1990s',
			image: '/friends.png',
			active: true,
			episodes: [
				{
					season: 1,
					episode: 1,
					title: 'The One Where It All Began',
					year: '1994',
					premise: 'Rachel runs from her wedding.'
				}
			]
		}
	];

	it('returns the premise for a valid episode', () => {
		const result = getEpisodePremise('seinfeld', 3, 5, shows);
		expect(result).toBe('Jerry borrows a pen.');
	});

	it('returns null for an invalid show slug', () => {
		const result = getEpisodePremise('breaking-bad', 1, 1, shows);
		expect(result).toBeNull();
	});

	it('returns null for an invalid season/episode combo', () => {
		const result = getEpisodePremise('seinfeld', 9, 99, shows);
		expect(result).toBeNull();
	});

	it('returns null when show has no episodes array', () => {
		const showsNoEp: Show[] = [
			{
				slug: 'bare',
				name: 'Bare',
				description: '',
				setting: '',
				era: '',
				image: '',
				active: true
			}
		];
		const result = getEpisodePremise('bare', 1, 1, showsNoEp);
		expect(result).toBeNull();
	});
});
