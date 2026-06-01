import { describe, expect, it } from 'vitest';
import {
	ContentCatalogError,
	createContentCatalog,
	loadContentCatalog,
	loadPublicContentCatalog,
	toPublicBot,
	type ContentCatalogModules
} from './content-catalog';
import type { Bot, Channel, Episode, GroupMeta } from '$lib/types';

const episode: Episode = {
	season: 1,
	episode: 1,
	title: 'The Pilot',
	year: '1990',
	premise: 'A long enough premise for the checked content catalog.'
};

const prompt = `# Character
Jerry Seinfeld.

# Voice
- Observational

# Examples
User: Hello?
Jerry: Hello is a whole conversation now?

# Format
Reply as Jerry.`;

function makeShow(overrides: Partial<GroupMeta> = {}): GroupMeta {
	return {
		slug: 'seinfeld',
		name: 'Seinfeld',
		description: 'A show about nothing.',
		setting: 'New York City',
		era: '1990s',
		image: '/bots/seinfeld/group-icon.png',
		active: true,
		episodes: [episode],
		...overrides
	};
}

function makeBot(overrides: Partial<Bot> = {}): Bot {
	return {
		id: 'jerry',
		group: 'seinfeld',
		name: 'Jerry Seinfeld',
		occupation: 'Comedian',
		image: '/bots/seinfeld/jerry.jpg',
		greeting: "What's the deal.",
		bio: 'A stand-up comedian on the Upper West Side.',
		prompt,
		...overrides
	};
}

function makeChannel(slot: NonNullable<Channel['schedule'][number]> = episodeSlot()): Channel {
	return {
		slug: 'ch1-nbc',
		name: 'NBC Primetime',
		number: 4,
		network: 'NBC',
		schedule: Array.from({ length: 48 }, () => slot)
	};
}

function episodeSlot(): NonNullable<Channel['schedule'][number]> {
	return { showSlug: 'seinfeld', season: 1, episode: 1 };
}

function makeModules(overrides: Partial<ContentCatalogModules> = {}): ContentCatalogModules {
	return {
		groupModules: {
			'/bots/seinfeld/_meta.json': makeShow()
		},
		botModules: {
			'/bots/seinfeld/jerry.json': makeBot()
		},
		channelModules: {
			'/channels/ch1-nbc.json': makeChannel()
		},
		...overrides
	};
}

function catchCatalogError(run: () => void): ContentCatalogError {
	try {
		run();
	} catch (error) {
		if (error instanceof ContentCatalogError) return error;
		throw error;
	}
	throw new Error('Expected ContentCatalogError');
}

describe('loadContentCatalog', () => {
	it('loads the current repo content into checked arrays and lookup maps', () => {
		const catalog = loadContentCatalog();

		expect(catalog.groups.length).toBeGreaterThan(0);
		expect(catalog.bots.length).toBeGreaterThan(0);
		expect(catalog.channels.length).toBeGreaterThan(0);
		expect(catalog.botsById.get(catalog.bots[0].id)).toBe(catalog.bots[0]);
		expect(catalog.groupsBySlug.get(catalog.groups[0].slug)).toBe(catalog.groups[0]);
		expect(catalog.channels.every((channel) => channel.schedule.length === 48)).toBe(true);
	});

	it('throws a clear error for an invalid bot', () => {
		const error = catchCatalogError(() =>
			createContentCatalog(
				makeModules({
					botModules: {
						'/bots/seinfeld/jerry.json': makeBot({ name: '' })
					}
				})
			)
		);

		expect(error.message).toContain('bots/seinfeld/jerry.json name must be a non-empty string');
	});

	it('throws a clear error for an invalid show episode', () => {
		const error = catchCatalogError(() =>
			createContentCatalog(
				makeModules({
					groupModules: {
						'/bots/seinfeld/_meta.json': makeShow({
							episodes: [{ ...episode, premise: 'too short' }]
						})
					}
				})
			)
		);

		expect(error.message).toContain('bots/seinfeld/_meta.json episodes[0] premise');
	});

	it('rejects channel slots that reference missing shows', () => {
		const error = catchCatalogError(() =>
			createContentCatalog(
				makeModules({
					channelModules: {
						'/channels/ch1-nbc.json': makeChannel({
							showSlug: 'missing-show',
							season: 1,
							episode: 1
						})
					}
				})
			)
		);

		expect(error.message).toContain(
			'channels/ch1-nbc.json schedule[0] references missing show "missing-show"'
		);
	});

	it('rejects channel slots that reference missing episodes', () => {
		const error = catchCatalogError(() =>
			createContentCatalog(
				makeModules({
					channelModules: {
						'/channels/ch1-nbc.json': makeChannel({
							showSlug: 'seinfeld',
							season: 9,
							episode: 99
						})
					}
				})
			)
		);

		expect(error.message).toContain(
			'channels/ch1-nbc.json schedule[0] references missing episode seinfeld S9E99'
		);
	});

	it('rejects duplicate show, bot, and channel keys', () => {
		const error = catchCatalogError(() =>
			createContentCatalog(
				makeModules({
					groupModules: {
						'/bots/seinfeld/_meta.json': makeShow(),
						'/bots/duplicate/_meta.json': makeShow({ name: 'Duplicate' })
					},
					botModules: {
						'/bots/seinfeld/jerry.json': makeBot(),
						'/bots/seinfeld/duplicate.json': makeBot({ name: 'Duplicate Jerry' })
					},
					channelModules: {
						'/channels/ch1-nbc.json': makeChannel(),
						'/channels/ch1-duplicate.json': makeChannel()
					}
				})
			)
		);

		expect(error.message).toContain('duplicates show slug "seinfeld"');
		expect(error.message).toContain('duplicates bot id "jerry"');
		expect(error.message).toContain('duplicates channel slug "ch1-nbc"');
	});

	it('rejects bots whose group does not reference a loaded show', () => {
		const error = catchCatalogError(() =>
			createContentCatalog(
				makeModules({
					botModules: {
						'/bots/seinfeld/jerry.json': makeBot({ group: 'missing-show' })
					}
				})
			)
		);

		expect(error.message).toContain(
			'bots/seinfeld/jerry.json group "missing-show" does not match any show slug'
		);
	});
});

describe('public content catalog', () => {
	it('strips private prompts from public bots', () => {
		const publicBot = toPublicBot(makeBot());

		expect(publicBot).toMatchObject({
			id: 'jerry',
			group: 'seinfeld',
			name: 'Jerry Seinfeld'
		});
		expect('prompt' in publicBot).toBe(false);
	});

	it('never exposes prompts from the loaded public catalog', () => {
		const publicCatalog = loadPublicContentCatalog();

		expect(publicCatalog.bots.length).toBeGreaterThan(0);
		expect(publicCatalog.bots.every((bot) => !('prompt' in bot))).toBe(true);
	});
});
