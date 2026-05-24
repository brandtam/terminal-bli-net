import type { Bot, GroupMeta } from '$lib/types';

let cachedBots: Bot[] | null = null;
let cachedGroups: GroupMeta[] | null = null;

export function loadBots(): Bot[] {
	if (cachedBots) return cachedBots;

	const botModules = import.meta.glob('/bots/**/*.json', { eager: true, import: 'default' });
	const bots: Bot[] = [];

	for (const [path, data] of Object.entries(botModules)) {
		if (path.endsWith('_meta.json')) continue;
		bots.push(data as Bot);
	}

	cachedBots = bots;
	return bots;
}

export function loadGroups(): GroupMeta[] {
	if (cachedGroups) return cachedGroups;

	const metaModules = import.meta.glob('/bots/**/_meta.json', { eager: true, import: 'default' });
	const groups: GroupMeta[] = [];

	for (const [, data] of Object.entries(metaModules)) {
		groups.push(data as GroupMeta);
	}

	cachedGroups = groups;
	return groups;
}

export function getBotById(id: string): Bot | undefined {
	return loadBots().find((b) => b.id === id);
}

export function getBotsByGroup(group: string): Bot[] {
	return loadBots().filter((b) => b.group === group);
}

export function getGroupBySlug(slug: string): GroupMeta | undefined {
	return loadGroups().find((g) => g.slug === slug);
}

const REQUIRED_SECTIONS = ['# Character', '# Voice', '# Examples', '# Format'];

export function validateBotPrompt(bot: Bot): string[] {
	const errors: string[] = [];

	for (const section of REQUIRED_SECTIONS) {
		if (!bot.prompt.includes(section)) {
			errors.push(`Missing section "${section}" in bot "${bot.id}"`);
		}
	}

	const examplesIdx = bot.prompt.indexOf('# Examples');
	const formatIdx = bot.prompt.indexOf('# Format');
	if (examplesIdx !== -1 && formatIdx !== -1) {
		const examplesBlock = bot.prompt.slice(examplesIdx + '# Examples'.length, formatIdx).trim();
		if (!examplesBlock.includes('User:') || !examplesBlock.includes(':')) {
			errors.push(`Empty or malformed examples block in bot "${bot.id}"`);
		}
	}

	if (!bot.id) errors.push('Missing id');
	if (!bot.group) errors.push('Missing group');
	if (!bot.name) errors.push('Missing name');
	if (!bot.greeting) errors.push('Missing greeting');
	if (!bot.bio) errors.push('Missing bio');
	if (!bot.prompt) errors.push('Missing prompt');

	return errors;
}

export function validateAllBots(bots: Bot[]): Map<string, string[]> {
	const results = new Map<string, string[]>();
	const ids = new Set<string>();

	for (const bot of bots) {
		const errors = validateBotPrompt(bot);

		if (ids.has(bot.id)) {
			errors.push(`Duplicate bot id "${bot.id}"`);
		}
		ids.add(bot.id);

		if (errors.length > 0) {
			results.set(bot.id, errors);
		}
	}

	return results;
}
