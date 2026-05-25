import { describe, it, expect } from 'vitest';
import {
	validateBotPrompt,
	validateAllBots,
	loadChannels,
	getChannelBySlug,
	loadGroups
} from './bots';
import type { Bot } from '$lib/types';

const validBot: Bot = {
	id: 'hawkeye',
	group: 'mash',
	name: 'Hawkeye Pierce',
	occupation: 'Chief Surgeon',
	image: '/bots/mash/hawkeye.jpg',
	greeting: 'Pull up a martini.',
	bio: 'Chief surgeon at the 4077th.',
	prompt:
		'# Character\nHawkeye Pierce, Chief Surgeon at the 4077th.\n\n# Voice\n- Sardonic\n- Anti-authoritarian\n\n# Examples\nUser: How are you?\nHawkeye: Still alive, which is more than I can say for my liver.\n\nUser: What do you do?\nHawkeye: I fix what the army breaks.\n\n# Format\nReply as Hawkeye in conversation.'
};

describe('validateBotPrompt', () => {
	it('returns no errors for a valid bot', () => {
		expect(validateBotPrompt(validBot)).toHaveLength(0);
	});

	it('catches missing sections', () => {
		const bad = { ...validBot, prompt: '# Character\nTest\n\n# Voice\n- test' };
		const errors = validateBotPrompt(bad);
		expect(errors.some((e) => e.includes('# Examples'))).toBe(true);
		expect(errors.some((e) => e.includes('# Format'))).toBe(true);
	});

	it('catches missing fields', () => {
		const bad = { ...validBot, id: '', greeting: '' };
		const errors = validateBotPrompt(bad);
		expect(errors.some((e) => e.includes('Missing id'))).toBe(true);
		expect(errors.some((e) => e.includes('Missing greeting'))).toBe(true);
	});

	it('catches empty examples block', () => {
		const bad = {
			...validBot,
			prompt:
				'# Character\nTest\n\n# Voice\n- test\n\n# Examples\n\n# Format\nReply as test.'
		};
		const errors = validateBotPrompt(bad);
		expect(errors.some((e) => e.includes('examples'))).toBe(true);
	});
});

describe('validateAllBots', () => {
	it('detects duplicate ids', () => {
		const bots = [validBot, { ...validBot }];
		const results = validateAllBots(bots);
		const allErrors = Array.from(results.values()).flat();
		expect(allErrors.some((e) => e.includes('Duplicate'))).toBe(true);
	});

	it('returns empty map for valid unique bots', () => {
		const bot2 = { ...validBot, id: 'radar' };
		const results = validateAllBots([validBot, bot2]);
		expect(results.size).toBe(0);
	});
});

describe('loadChannels', () => {
	it('returns an array of channels', () => {
		const channels = loadChannels();
		expect(Array.isArray(channels)).toBe(true);
		expect(channels.length).toBeGreaterThan(0);
	});

	it('each channel has slug, name, number, network, and schedule of length 48', () => {
		const channels = loadChannels();
		for (const ch of channels) {
			expect(ch.slug).toBeDefined();
			expect(typeof ch.slug).toBe('string');
			expect(ch.name).toBeDefined();
			expect(typeof ch.name).toBe('string');
			expect(ch.number).toBeDefined();
			expect(typeof ch.number).toBe('number');
			expect(ch.network).toBeDefined();
			expect(typeof ch.network).toBe('string');
			expect(Array.isArray(ch.schedule)).toBe(true);
			expect(ch.schedule).toHaveLength(48);
		}
	});
});

describe('getChannelBySlug', () => {
	it('returns the correct channel for ch1-nbc', () => {
		const ch = getChannelBySlug('ch1-nbc');
		expect(ch).toBeDefined();
		expect(ch!.slug).toBe('ch1-nbc');
		expect(ch!.network).toBe('NBC');
	});

	it('returns undefined for nonexistent slug', () => {
		expect(getChannelBySlug('nonexistent')).toBeUndefined();
	});
});

describe('loadGroups', () => {
	it('returns shows with episodes', () => {
		const groups = loadGroups();
		expect(Array.isArray(groups)).toBe(true);
		expect(groups.length).toBeGreaterThan(0);

		const withEpisodes = groups.filter((g) => g.episodes && g.episodes.length > 0);
		expect(withEpisodes.length).toBeGreaterThan(0);

		for (const g of withEpisodes) {
			expect(g.slug).toBeDefined();
			expect(g.name).toBeDefined();
			expect(Array.isArray(g.episodes)).toBe(true);
			for (const ep of g.episodes!) {
				expect(ep.season).toBeDefined();
				expect(ep.episode).toBeDefined();
				expect(ep.title).toBeDefined();
			}
		}
	});
});
