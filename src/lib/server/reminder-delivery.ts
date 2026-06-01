import { getSlotIndex } from '$lib/schedule';
import type { PublicContentCatalog } from './content-catalog';
import type { ChannelSlot, GroupMeta, PublicBot } from '$lib/types';

export interface ReminderSubscriber {
	email: string;
	timezone: string;
	showSubscriptions: string[];
}

export interface ReminderCandidate {
	email: string;
	timezone: string;
	showSlug: string;
	showName: string;
	characterName: string;
	characterGreeting: string;
	nextAirTime: string;
	slotKey: string;
}

function findShow(catalog: PublicContentCatalog, showSlug: string): GroupMeta | undefined {
	return catalog.groups.find((show) => show.slug === showSlug && show.active);
}

function findBot(catalog: PublicContentCatalog, showSlug: string): PublicBot | undefined {
	return catalog.bots.find((bot) => bot.group === showSlug);
}

function findSlot(
	catalog: PublicContentCatalog,
	showSlug: string,
	slotIndex: number
): ChannelSlot | null {
	for (const channel of catalog.channels) {
		const slot = channel.schedule[slotIndex];
		if (slot?.showSlug === showSlug) return slot;
	}
	return null;
}

function localDateKey(date: Date, timezone: string): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);

	const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
	const month = parts.find((part) => part.type === 'month')?.value ?? '00';
	const day = parts.find((part) => part.type === 'day')?.value ?? '00';
	return `${year}-${month}-${day}`;
}

function formatSlotStart(slotIndex: number, date: Date, timezone: string): string {
	const totalMinutes = slotIndex * 30;
	const hour = Math.floor(totalMinutes / 60);
	const minute = totalMinutes % 60;
	const hour12 = ((hour + 11) % 12) + 1;
	const ampm = hour >= 12 ? 'PM' : 'AM';
	const time =
		minute === 0 ? `${hour12}:00 ${ampm}` : `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
	const tzName =
		new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
			.formatToParts(date)
			.find((part) => part.type === 'timeZoneName')?.value ?? timezone;
	return `${time} ${tzName}`;
}

export function buildReminderCandidates(
	catalog: PublicContentCatalog,
	subscribers: ReminderSubscriber[],
	now: Date,
	leadMinutes: number
): ReminderCandidate[] {
	const target = new Date(now.getTime() + leadMinutes * 60_000);
	const candidates: ReminderCandidate[] = [];

	for (const subscriber of subscribers) {
		const slotIndex = getSlotIndex(target, subscriber.timezone);
		const dateKey = localDateKey(target, subscriber.timezone);
		const nextAirTime = formatSlotStart(slotIndex, target, subscriber.timezone);

		for (const showSlug of subscriber.showSubscriptions) {
			const show = findShow(catalog, showSlug);
			const bot = findBot(catalog, showSlug);
			const slot = findSlot(catalog, showSlug, slotIndex);
			if (!show || !bot || !slot) continue;

			candidates.push({
				email: subscriber.email,
				timezone: subscriber.timezone,
				showSlug,
				showName: show.name,
				characterName: bot.name,
				characterGreeting: bot.greeting,
				nextAirTime,
				slotKey: `${subscriber.timezone}:${dateKey}:${slotIndex}:${showSlug}`
			});
		}
	}

	return candidates;
}
