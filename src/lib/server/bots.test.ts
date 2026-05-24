import { describe, it, expect } from 'vitest';
import { validateBotPrompt, validateAllBots } from './bots';
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
