import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { loadPublicContentCatalog } from '$lib/server/content-catalog';
import type { PublicContentCatalog } from '$lib/server/content-catalog';

vi.mock('$lib/server/content-catalog', () => ({
	loadPublicContentCatalog: vi.fn()
}));

const publicCatalog: PublicContentCatalog = {
	groups: [
		{
			slug: 'seinfeld',
			name: 'Seinfeld',
			description: 'A show about nothing.',
			setting: 'New York City',
			era: '1990s',
			image: '/bots/seinfeld/group-icon.png',
			active: true,
			episodes: [
				{
					season: 1,
					episode: 1,
					title: 'The Pilot',
					year: '1990',
					premise: 'A long enough premise for the public data route.'
				}
			]
		}
	],
	bots: [
		{
			id: 'jerry',
			group: 'seinfeld',
			name: 'Jerry Seinfeld',
			occupation: 'Comedian',
			image: '/bots/seinfeld/jerry.jpg',
			greeting: "What's the deal.",
			bio: 'A stand-up comedian on the Upper West Side.'
		}
	],
	channels: [
		{
			slug: 'ch1-nbc',
			name: 'NBC Primetime',
			number: 4,
			network: 'NBC',
			schedule: Array.from({ length: 48 }, () => ({
				showSlug: 'seinfeld',
				season: 1,
				episode: 1
			}))
		}
	]
};

describe('GET /api/data', () => {
	it('keeps the public response shape and does not expose bot prompts', async () => {
		vi.mocked(loadPublicContentCatalog).mockReturnValue(publicCatalog);

		const response = await GET({} as Parameters<typeof GET>[0]);
		const body = (await response.json()) as PublicContentCatalog;

		expect(Object.keys(body)).toEqual(['groups', 'bots', 'channels']);
		expect(body.groups).toEqual(publicCatalog.groups);
		expect(body.channels).toEqual(publicCatalog.channels);
		expect(body.bots[0]).toEqual(publicCatalog.bots[0]);
		expect(body.bots[0]).not.toHaveProperty('prompt');
	});
});
