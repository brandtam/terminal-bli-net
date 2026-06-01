import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Channel, ChannelSlot } from './types';

const CHANNELS_DIR = join(process.cwd(), 'channels');
const BOTS_DIR = join(process.cwd(), 'bots');

const VALID_SHOW_SLUGS = [
	'seinfeld',
	'office',
	'parks-and-rec',
	'mash',
	'arrested-development',
	'star-trek-tng'
];

// Load all episodes keyed by show slug
function loadShowEpisodes(): Record<string, { season: number; episode: number }[]> {
	const episodes: Record<string, { season: number; episode: number }[]> = {};
	for (const slug of VALID_SHOW_SLUGS) {
		const meta = JSON.parse(readFileSync(join(BOTS_DIR, slug, '_meta.json'), 'utf8'));
		episodes[slug] = meta.episodes.map((e: { season: number; episode: number }) => ({
			season: e.season,
			episode: e.episode
		}));
	}
	return episodes;
}

// Load all channel JSON files
function loadChannels(): Channel[] {
	const files = readdirSync(CHANNELS_DIR).filter((f) => f.endsWith('.json'));
	return files.map((f) => JSON.parse(readFileSync(join(CHANNELS_DIR, f), 'utf8')));
}

describe('Channel schedule validation', () => {
	const channels = loadChannels();
	const showEpisodes = loadShowEpisodes();

	it('should have channel files to validate', () => {
		expect(channels.length).toBeGreaterThan(0);
	});

	for (const channel of channels) {
		describe(`${channel.slug}`, () => {
			it('has required fields (slug, name, number, network)', () => {
				expect(channel.slug).toBeDefined();
				expect(typeof channel.slug).toBe('string');
				expect(channel.name).toBeDefined();
				expect(typeof channel.name).toBe('string');
				expect(channel.number).toBeDefined();
				expect(typeof channel.number).toBe('number');
				expect(channel.network).toBeDefined();
				expect(typeof channel.network).toBe('string');
			});

			it('has exactly 48 slots', () => {
				expect(channel.schedule).toHaveLength(48);
			});

			it('has no null slots', () => {
				for (let i = 0; i < channel.schedule.length; i++) {
					expect(channel.schedule[i]).not.toBeNull();
					expect(channel.schedule[i]).toBeDefined();
				}
			});

			it('references only valid show slugs', () => {
				for (const slot of channel.schedule) {
					const s = slot as ChannelSlot;
					expect(VALID_SHOW_SLUGS).toContain(s.showSlug);
				}
			});

			it('references valid season/episode combos for each show', () => {
				for (const slot of channel.schedule) {
					const s = slot as ChannelSlot;
					const episodes = showEpisodes[s.showSlug];
					const match = episodes.find((e) => e.season === s.season && e.episode === s.episode);
					expect(
						match,
						`${s.showSlug} S${s.season}E${s.episode} not found in episode catalog`
					).toBeDefined();
				}
			});
		});
	}
});
