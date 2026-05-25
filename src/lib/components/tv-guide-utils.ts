import type { ChannelSlot, Channel, GroupMeta } from '$lib/types';
import { getSlotIndex } from '$lib/schedule';

const DAY_SLOTS = 48;

export interface TimeSlot {
	label: string;
	hour24: number;
	minute: number;
	isNow: boolean;
	isDayBoundary: boolean;
	slotIndex: number;
}

export interface MergedCell {
	startSlot: number;
	span: number;
	showSlug: string;
	season: number;
	episode: number;
	title: string;
	year: string;
	isLive: boolean;
}

export function getEpisodeInfo(
	slot: ChannelSlot,
	groupMap: Map<string, GroupMeta>
): { title: string; year: string } | null {
	const show = groupMap.get(slot.showSlug);
	const ep = show?.episodes?.find((e) => e.season === slot.season && e.episode === slot.episode);
	return ep ? { title: ep.title, year: ep.year } : null;
}

export function buildTimeSlots(date: Date, tz?: string): TimeSlot[] {
	const currentSlotIdx = getSlotIndex(date, tz);
	const slots: TimeSlot[] = [];

	for (let i = 0; i < DAY_SLOTS; i++) {
		const slotIdx = (currentSlotIdx + i) % DAY_SLOTS;
		const h24 = Math.floor(slotIdx / 2);
		const m = (slotIdx % 2) * 30;
		const h12 = h24 % 12 || 12;
		const ampm = h24 >= 12 ? 'PM' : 'AM';
		slots.push({
			label: `${h12}:${String(m).padStart(2, '0')} ${ampm}`,
			hour24: h24,
			minute: m,
			isNow: i === 0,
			isDayBoundary: i > 0 && slotIdx === 0,
			slotIndex: slotIdx
		});
	}
	return slots;
}

export function buildMergedCells(
	channel: Channel,
	slotOrder: TimeSlot[],
	currentSlotIdx: number,
	groupMap: Map<string, GroupMeta>
): MergedCell[] {
	const cells: MergedCell[] = [];
	let i = 0;

	while (i < slotOrder.length) {
		const slotIdx = slotOrder[i].slotIndex;
		const channelSlot = channel.schedule[slotIdx] ?? null;

		if (!channelSlot) {
			i++;
			continue;
		}

		const epInfo = getEpisodeInfo(channelSlot, groupMap);
		let span = 1;

		// Merge consecutive slots with the same show+episode
		while (i + span < slotOrder.length) {
			const nextSlotIdx = slotOrder[i + span].slotIndex;
			const nextSlot = channel.schedule[nextSlotIdx] ?? null;
			if (
				nextSlot &&
				nextSlot.showSlug === channelSlot.showSlug &&
				nextSlot.season === channelSlot.season &&
				nextSlot.episode === channelSlot.episode
			) {
				span++;
			} else {
				break;
			}
		}

		// A cell is live if any of its slot indices equals the current slot
		const isLive = slotOrder.slice(i, i + span).some((s) => s.slotIndex === currentSlotIdx);

		cells.push({
			startSlot: i,
			span,
			showSlug: channelSlot.showSlug,
			season: channelSlot.season,
			episode: channelSlot.episode,
			title: epInfo?.title ?? `S${channelSlot.season}E${channelSlot.episode}`,
			year: epInfo?.year ?? '',
			isLive
		});

		i += span;
	}
	return cells;
}

export function formatGuideDate(d: Date, tz?: string): string {
	const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
	if (tz) opts.timeZone = tz;
	return new Intl.DateTimeFormat('en-US', opts).format(d).toUpperCase();
}

export function formatLiveClock(d: Date, tz?: string): string {
	const opts: Intl.DateTimeFormatOptions = {
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
		hour12: true
	};
	if (tz) opts.timeZone = tz;
	return new Intl.DateTimeFormat('en-US', opts).format(d);
}
