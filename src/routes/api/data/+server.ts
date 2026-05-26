import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadBots, loadChannels, loadGroups } from '$lib/server/bots';

export const GET: RequestHandler = async () => {
	const bots = loadBots();
	const groups = loadGroups();

	const safeBots = bots.map(({ prompt: _, ...rest }) => rest);

	return json({ groups, bots: safeBots, channels: loadChannels() });
};
