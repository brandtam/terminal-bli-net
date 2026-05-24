import type { Channel, ChannelSlot, Show } from './types';

function parseTime(timeStr: string): { hours: number; minutes: number } {
	const [h, m] = timeStr.split(':').map(Number);
	return { hours: h, minutes: m };
}

export function formatTimeUntil(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}

export function formatSlotTime(start: string, duration: number): string {
	const { hours: sh, minutes: sm } = parseTime(start);
	const endTotal = sh * 60 + sm + duration;
	const eh = Math.floor(endTotal / 60) % 24;
	const em = endTotal % 60;

	const fmt = (h: number, m: number) => {
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = ((h + 11) % 12) + 1;
		return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
	};

	return `${fmt(sh, sm)}–${fmt(eh, em)}`;
}

// ─── Channel-based schedule functions ───────────────────────────────────────

/**
 * Maps current time to a 0-47 slot index (each slot = 30 minutes).
 * Slot 0 = 00:00–00:29, Slot 1 = 00:30–00:59, ..., Slot 47 = 23:30–23:59.
 */
export function getSlotIndex(now: Date, timezone?: string): number {
	let hour: number;
	let minute: number;

	if (timezone) {
		const opts: Intl.DateTimeFormatOptions = {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: timezone
		};
		const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
		hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0');
		minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0');
		// Intl can return hour=24 for midnight in some locales; normalize
		if (hour === 24) hour = 0;
	} else {
		hour = now.getHours();
		minute = now.getMinutes();
	}

	return hour * 2 + Math.floor(minute / 30);
}

/**
 * Returns the ChannelSlot currently airing on a channel, or null if off-air.
 */
export function getCurrentSlot(channel: Channel, now: Date, timezone?: string): ChannelSlot | null {
	const idx = getSlotIndex(now, timezone);
	return channel.schedule[idx] ?? null;
}

/**
 * Checks if ANY channel is currently airing the given show.
 */
export function isShowOnAir(
	showSlug: string,
	channels: Channel[],
	now: Date,
	timezone?: string
): boolean {
	const idx = getSlotIndex(now, timezone);
	return channels.some((ch) => {
		const slot = ch.schedule[idx];
		return slot !== null && slot !== undefined && slot.showSlug === showSlug;
	});
}

/**
 * Looks up a specific episode's premise from the shows array.
 * Returns null if the show or episode is not found.
 */
export function getEpisodePremise(
	showSlug: string,
	season: number,
	episode: number,
	shows: Show[]
): string | null {
	const show = shows.find((s) => s.slug === showSlug);
	if (!show || !show.episodes) return null;
	const ep = show.episodes.find((e) => e.season === season && e.episode === episode);
	return ep?.premise ?? null;
}
