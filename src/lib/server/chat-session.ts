import type { Bot, Channel, ChannelSlot, Show } from '$lib/types';
import { getCurrentSlot } from '$lib/schedule';
import { buildSystemPrompt } from './prompt';

export interface AiringSlot {
	channel: Channel;
	slot: ChannelSlot;
}

export interface ChatSessionResult {
	allowed: boolean;
	status: number;
	reason?: string;
	systemPrompt?: string;
	show?: Show;
	airing?: AiringSlot;
}

export function validateChatTimezone(raw: unknown): string {
	if (typeof raw !== 'string' || raw.trim() === '') {
		throw new Error('timezone is required');
	}

	const timezone = raw.trim();

	try {
		new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
	} catch {
		throw new Error(`timezone "${timezone}" is invalid`);
	}

	return timezone;
}

export function findAiringSlotForShow(
	showSlug: string,
	channels: Channel[],
	now: Date,
	timezone: string
): AiringSlot | null {
	for (const channel of channels) {
		const slot = getCurrentSlot(channel, now, timezone);
		if (slot?.showSlug === showSlug) {
			return { channel, slot };
		}
	}

	return null;
}

export function createChatSession({
	bot,
	channels,
	shows,
	now,
	timezone
}: {
	bot: Bot;
	channels: Channel[];
	shows: Show[];
	now: Date;
	timezone: string;
}): ChatSessionResult {
	const show = shows.find((candidate) => candidate.slug === bot.group);
	if (!show) {
		return {
			allowed: false,
			status: 404,
			reason: `Show "${bot.group}" not found for bot "${bot.id}"`
		};
	}

	const airing = findAiringSlotForShow(show.slug, channels, now, timezone);
	if (!airing) {
		return {
			allowed: false,
			status: 403,
			reason: `${show.name} is not currently airing`
		};
	}

	return {
		allowed: true,
		status: 200,
		show,
		airing,
		systemPrompt: buildSystemPrompt(bot.prompt, show.slug, channels, shows, now, timezone)
	};
}
