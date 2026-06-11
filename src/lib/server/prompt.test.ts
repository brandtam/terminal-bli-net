import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './prompt';
import type { Channel, Show } from '$lib/types';

const basePrompt = 'You are George Costanza. Be neurotic.';

function makeChannel(slug: string, schedule: Channel['schedule'][number][]): Channel {
	return { slug, name: `Channel ${slug}`, number: 1, network: 'Beacon', schedule };
}

function makeShow(slug: string, episodes: Show['episodes']): Show {
	return {
		slug,
		name: 'Test Show',
		description: '',
		setting: '',
		era: '',
		image: '',
		active: true,
		episodes
	};
}

// Create a date at a specific hour/minute (local time) so getSlotIndex returns a known index
function makeDateForSlot(slotIndex: number): Date {
	const hour = Math.floor(slotIndex / 2);
	const minute = (slotIndex % 2) * 30;
	return new Date(2026, 0, 5, hour, minute, 0, 0); // Mon Jan 5
}

describe('buildSystemPrompt', () => {
	it('injects episode premise when show is on air', () => {
		const slotIdx = 10; // 05:00
		const now = makeDateForSlot(slotIdx);

		const schedule: Channel['schedule'] = Array(48).fill(null);
		schedule[slotIdx] = { showSlug: 'seinfeld', season: 3, episode: 7 };

		const channels = [makeChannel('ch1', schedule)];
		const shows = [
			makeShow('seinfeld', [
				{ season: 3, episode: 7, title: 'The Pen', year: '1991', premise: 'Jerry borrows a pen.' }
			])
		];

		const result = buildSystemPrompt(basePrompt, 'seinfeld', channels, shows, now);

		expect(result).toContain('[SCENE CONTEXT:');
		expect(result).toContain('S3E7');
		expect(result).toContain('"The Pen"');
		expect(result).toContain('Jerry borrows a pen.');
		expect(result).toContain(basePrompt);
		// Premise is prepended
		expect(result.indexOf('[SCENE CONTEXT:')).toBeLessThan(result.indexOf(basePrompt));
	});

	it('returns base prompt unchanged when show is NOT on air', () => {
		const slotIdx = 10;
		const now = makeDateForSlot(slotIdx);

		// Channel is airing a different show
		const schedule: Channel['schedule'] = Array(48).fill(null);
		schedule[slotIdx] = { showSlug: 'friends', season: 1, episode: 1 };

		const channels = [makeChannel('ch1', schedule)];
		const shows = [
			makeShow('seinfeld', [
				{ season: 3, episode: 7, title: 'The Pen', year: '1991', premise: 'Jerry borrows a pen.' }
			])
		];

		const result = buildSystemPrompt(basePrompt, 'seinfeld', channels, shows, now);
		expect(result).toBe(basePrompt);
	});

	it('returns base prompt unchanged when show is on air but episode has no premise', () => {
		const slotIdx = 10;
		const now = makeDateForSlot(slotIdx);

		const schedule: Channel['schedule'] = Array(48).fill(null);
		schedule[slotIdx] = { showSlug: 'seinfeld', season: 9, episode: 99 };

		const channels = [makeChannel('ch1', schedule)];
		const shows = [
			makeShow('seinfeld', [
				{ season: 3, episode: 7, title: 'The Pen', year: '1991', premise: 'Jerry borrows a pen.' }
			])
		];

		// Episode S9E99 doesn't exist in the shows data
		const result = buildSystemPrompt(basePrompt, 'seinfeld', channels, shows, now);
		expect(result).toBe(basePrompt);
	});

	it('finds the right episode when show is on multiple channels', () => {
		const slotIdx = 20;
		const now = makeDateForSlot(slotIdx);

		const schedule1: Channel['schedule'] = Array(48).fill(null);
		schedule1[slotIdx] = { showSlug: 'seinfeld', season: 1, episode: 1 };

		const schedule2: Channel['schedule'] = Array(48).fill(null);
		schedule2[slotIdx] = { showSlug: 'seinfeld', season: 4, episode: 11 };

		const channels = [makeChannel('ch1', schedule1), makeChannel('ch2', schedule2)];
		const shows = [
			makeShow('seinfeld', [
				{
					season: 1,
					episode: 1,
					title: 'The Seinfeld Chronicles',
					year: '1989',
					premise: 'Pilot episode.'
				},
				{ season: 4, episode: 11, title: 'The Contest', year: '1992', premise: 'A bet is made.' }
			])
		];

		const result = buildSystemPrompt(basePrompt, 'seinfeld', channels, shows, now);

		// Should pick the first channel's episode (ch1, S1E1)
		expect(result).toContain('S1E1');
		expect(result).toContain('"The Seinfeld Chronicles"');
		expect(result).toContain('Pilot episode.');
	});

	it('formats [SCENE CONTEXT] with season, episode, title, and premise', () => {
		const slotIdx = 5;
		const now = makeDateForSlot(slotIdx);

		const schedule: Channel['schedule'] = Array(48).fill(null);
		schedule[slotIdx] = { showSlug: 'seinfeld', season: 5, episode: 14 };

		const channels = [makeChannel('ch1', schedule)];
		const shows = [
			makeShow('seinfeld', [
				{
					season: 5,
					episode: 14,
					title: 'The Marine Biologist',
					year: '1994',
					premise: 'George pretends to be a marine biologist.'
				}
			])
		];

		const result = buildSystemPrompt(basePrompt, 'seinfeld', channels, shows, now);

		const expected = `[SCENE CONTEXT: Currently airing S5E14 "The Marine Biologist" — George pretends to be a marine biologist.]\n\n${basePrompt}`;
		expect(result).toBe(expected);
	});
});
