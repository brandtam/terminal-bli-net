import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Episode, ChannelSlot, Channel, Show, GroupMeta, PublicBot } from './types';

describe('Episode type', () => {
	it('accepts a valid episode', () => {
		const ep = {
			season: 2,
			episode: 5,
			title: 'The One Where They Code',
			year: '1994',
			premise: 'The gang discovers TypeScript.'
		} satisfies Episode;

		expect(ep.season).toBe(2);
		expect(ep.episode).toBe(5);
		expect(ep.title).toBe('The One Where They Code');
		expect(ep.year).toBe('1994');
		expect(ep.premise).toBeTypeOf('string');
	});
});

describe('ChannelSlot type', () => {
	it('accepts a valid channel slot', () => {
		const slot = {
			showSlug: 'seinfeld',
			season: 3,
			episode: 12
		} satisfies ChannelSlot;

		expect(slot.showSlug).toBe('seinfeld');
		expect(slot.season).toBe(3);
		expect(slot.episode).toBe(12);
	});

	it('enforces required fields at runtime', () => {
		const slot: ChannelSlot = { showSlug: 'friends', season: 1, episode: 1 };
		expect(slot).toHaveProperty('showSlug');
		expect(slot).toHaveProperty('season');
		expect(slot).toHaveProperty('episode');
	});
});

describe('Channel type', () => {
	it('accepts a valid channel with 48 slots', () => {
		const slots: (ChannelSlot | null)[] = Array.from({ length: 48 }, (_, i) =>
			i % 3 === 0 ? null : { showSlug: 'test-show', season: 1, episode: i }
		);

		const channel = {
			slug: 'comedy-central',
			name: 'Comedy Central',
			number: 4,
			network: 'Viacom',
			schedule: slots
		} satisfies Channel;

		expect(channel.schedule).toHaveLength(48);
		expect(channel.slug).toBe('comedy-central');
		expect(channel.number).toBe(4);
		expect(channel.network).toBe('Viacom');
		expect(channel.schedule[0]).toBeNull();
		expect(channel.schedule[1]).toEqual({ showSlug: 'test-show', season: 1, episode: 1 });
	});
});

describe('Show / GroupMeta type', () => {
	it('accepts a show with episodes and color (no schedule)', () => {
		const show = {
			slug: 'seinfeld',
			name: 'Seinfeld',
			description: 'A show about nothing.',
			setting: 'New York City',
			era: '1990s',
			image: '/images/seinfeld.png',
			active: true,
			color: '#3b82f6',
			episodes: [
				{
					season: 1,
					episode: 1,
					title: 'The Seinfeld Chronicles',
					year: '1989',
					premise: 'Jerry does stand-up.'
				}
			]
		} satisfies Show;

		expect(show.color).toBe('#3b82f6');
		expect(show.episodes).toHaveLength(1);
		expect(show.episodes![0].title).toBe('The Seinfeld Chronicles');
	});

	it('Show and GroupMeta are the same type', () => {
		const group: GroupMeta = {
			slug: 'friends',
			name: 'Friends',
			description: 'Six friends in NYC.',
			setting: 'New York City',
			era: '1990s',
			image: '/images/friends.png',
			active: true
		};

		const show: Show = group;
		expect(show.slug).toBe('friends');
	});

	it('does not include the retired weekly schedule field', () => {
		expectTypeOf<Extract<'schedule', keyof GroupMeta>>().toEqualTypeOf<never>();
	});
});

describe('PublicBot type', () => {
	it('does not include private prompt text', () => {
		expectTypeOf<Extract<'prompt', keyof PublicBot>>().toEqualTypeOf<never>();
	});
});
