import type { Channel, Show } from '$lib/types';
import { isShowOnAir, getCurrentSlot, getEpisodePremise } from '$lib/schedule';

/**
 * Builds the system prompt for a chat bot, optionally prepending episode context
 * if the show is currently airing on any channel.
 */
export function buildSystemPrompt(
	basePrompt: string,
	showSlug: string,
	channels: Channel[],
	shows: Show[],
	now: Date,
	timezone?: string
): string {
	if (!isShowOnAir(showSlug, channels, now, timezone)) {
		return basePrompt;
	}

	// Find the first channel airing this show and get its current slot
	for (const channel of channels) {
		const slot = getCurrentSlot(channel, now, timezone);
		if (slot && slot.showSlug === showSlug) {
			const premise = getEpisodePremise(showSlug, slot.season, slot.episode, shows);
			if (!premise) return basePrompt;

			// Look up episode title
			const show = shows.find((s) => s.slug === showSlug);
			const ep = show?.episodes?.find(
				(e) => e.season === slot.season && e.episode === slot.episode
			);
			const title = ep?.title ?? 'Unknown';

			return `[SCENE CONTEXT: Currently airing S${slot.season}E${slot.episode} "${title}" — ${premise}]\n\n${basePrompt}`;
		}
	}

	return basePrompt;
}
