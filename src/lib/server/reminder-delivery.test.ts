import { describe, expect, it } from 'vitest';
import { buildReminderCandidates, type ReminderSubscriber } from './reminder-delivery';
import type { PublicContentCatalog } from './content-catalog';

const catalog: PublicContentCatalog = {
	groups: [
		{
			slug: 'seinfeld',
			name: 'Seinfeld',
			description: '',
			setting: '',
			era: '',
			image: '',
			active: true,
			episodes: []
		}
	],
	bots: [
		{
			id: 'george',
			group: 'seinfeld',
			name: 'George Costanza',
			occupation: 'Importer/exporter',
			image: '',
			greeting: 'Yeah?',
			bio: ''
		}
	],
	channels: [
		{
			slug: 'ch-comedy',
			name: 'Comedy',
			number: 6,
			network: 'CHATR',
			schedule: Array.from({ length: 48 }, (_, index) =>
				index === 21 ? { showSlug: 'seinfeld', season: 5, episode: 14 } : null
			)
		}
	]
};

const subscribers: ReminderSubscriber[] = [
	{
		email: 'fan@example.com',
		timezone: 'UTC',
		showSubscriptions: ['seinfeld', 'mash']
	}
];

describe('buildReminderCandidates', () => {
	it('finds subscribed shows airing in the target reminder slot', () => {
		const candidates = buildReminderCandidates(
			catalog,
			subscribers,
			new Date('2026-01-04T10:00:00Z'),
			30
		);

		expect(candidates).toEqual([
			{
				email: 'fan@example.com',
				timezone: 'UTC',
				showSlug: 'seinfeld',
				showName: 'Seinfeld',
				characterName: 'George Costanza',
				characterGreeting: 'Yeah?',
				nextAirTime: '10:30 AM UTC',
				slotKey: 'UTC:2026-01-04:21:seinfeld'
			}
		]);
	});

	it('does not remind when the subscribed show is not in the target slot', () => {
		const candidates = buildReminderCandidates(
			catalog,
			subscribers,
			new Date('2026-01-04T09:00:00Z'),
			30
		);

		expect(candidates).toEqual([]);
	});
});
