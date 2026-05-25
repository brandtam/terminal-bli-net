import { describe, it, expect } from 'vitest';
import {
	getEpisodeInfo,
	buildTimeSlots,
	buildMergedCells,
	formatGuideDate,
	formatLiveClock
} from './tv-guide-utils';
import type { Channel, ChannelSlot, GroupMeta } from '$lib/types';

function makeGroupMap(groups: GroupMeta[]): Map<string, GroupMeta> {
	return new Map(groups.map((g) => [g.slug, g]));
}

function makeGroup(overrides: Partial<GroupMeta> = {}): GroupMeta {
	return {
		slug: 'test-show',
		name: 'Test Show',
		description: '',
		setting: '',
		era: '2020s',
		image: '',
		active: true,
		episodes: [
			{ season: 1, episode: 1, title: 'Pilot', year: '2020', premise: '' },
			{ season: 1, episode: 2, title: 'Second', year: '2020', premise: '' }
		],
		...overrides
	};
}

function makeChannel(schedule: (ChannelSlot | null)[]): Channel {
	return {
		slug: 'ch-test',
		name: 'Test Channel',
		number: 1,
		network: 'NET',
		schedule
	};
}

describe('buildTimeSlots', () => {
	it('returns 48 slots', () => {
		const date = new Date('2024-06-15T10:00:00');
		const slots = buildTimeSlots(date);
		expect(slots).toHaveLength(48);
	});

	it('marks first slot as isNow', () => {
		const date = new Date('2024-06-15T10:00:00');
		const slots = buildTimeSlots(date);
		expect(slots[0].isNow).toBe(true);
		expect(slots[1].isNow).toBe(false);
	});
});

describe('buildMergedCells', () => {
	it('merges consecutive same-show slots', () => {
		const slot: ChannelSlot = { showSlug: 'test-show', season: 1, episode: 1 };
		// Create a schedule array with slots 0 and 1 filled
		const schedule: (ChannelSlot | null)[] = Array(48).fill(null);
		schedule[0] = slot;
		schedule[1] = slot;

		const channel = makeChannel(schedule);
		const group = makeGroup();
		const groupMap = makeGroupMap([group]);

		// Build time slots starting at midnight (slot index 0)
		const date = new Date('2024-06-15T00:00:00');
		const timeSlots = buildTimeSlots(date);

		const cells = buildMergedCells(channel, timeSlots, 0, groupMap);
		// First two slots have the same show, so they should merge into one cell
		expect(cells[0].span).toBe(2);
		expect(cells[0].showSlug).toBe('test-show');
		expect(cells[0].title).toBe('Pilot');
	});

	it('handles empty schedule', () => {
		const schedule: (ChannelSlot | null)[] = Array(48).fill(null);
		const channel = makeChannel(schedule);
		const groupMap = makeGroupMap([]);

		const date = new Date('2024-06-15T00:00:00');
		const timeSlots = buildTimeSlots(date);

		const cells = buildMergedCells(channel, timeSlots, 0, groupMap);
		expect(cells).toHaveLength(0);
	});
});

describe('formatGuideDate', () => {
	it('returns uppercase formatted date', () => {
		const date = new Date('2024-06-15T10:00:00');
		const result = formatGuideDate(date, 'America/New_York');
		expect(result).toMatch(/^[A-Z]/);
		expect(result).toBe(result.toUpperCase());
		expect(result).toContain('SAT');
		expect(result).toContain('JUN');
		expect(result).toContain('15');
	});
});

describe('formatLiveClock', () => {
	it('returns formatted time string', () => {
		const date = new Date('2024-06-15T14:30:45');
		const result = formatLiveClock(date, 'America/New_York');
		expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/);
	});
});

describe('getEpisodeInfo', () => {
	it('returns episode data when found', () => {
		const group = makeGroup();
		const groupMap = makeGroupMap([group]);
		const slot: ChannelSlot = { showSlug: 'test-show', season: 1, episode: 1 };

		const result = getEpisodeInfo(slot, groupMap);
		expect(result).toEqual({ title: 'Pilot', year: '2020' });
	});

	it('returns null when not found', () => {
		const group = makeGroup();
		const groupMap = makeGroupMap([group]);
		const slot: ChannelSlot = { showSlug: 'test-show', season: 9, episode: 99 };

		const result = getEpisodeInfo(slot, groupMap);
		expect(result).toBeNull();
	});
});
