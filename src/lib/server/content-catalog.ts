import type { Bot, Channel, ChannelSlot, Episode, GroupMeta, PublicBot, Show } from '$lib/types';

const REQUIRED_PROMPT_SECTIONS = ['# Character', '# Voice', '# Examples', '# Format'];

export class ContentCatalogError extends Error {
	readonly errors: string[];

	constructor(errors: string[]) {
		super(`Content catalog is invalid:\n- ${errors.join('\n- ')}`);
		this.name = 'ContentCatalogError';
		this.errors = errors;
	}
}

export interface ContentCatalog {
	bots: Bot[];
	groups: GroupMeta[];
	shows: Show[];
	channels: Channel[];
	botsById: Map<string, Bot>;
	botsByGroup: Map<string, Bot[]>;
	groupsBySlug: Map<string, GroupMeta>;
	showsBySlug: Map<string, Show>;
	channelsBySlug: Map<string, Channel>;
}

export interface PublicContentCatalog {
	groups: GroupMeta[];
	bots: PublicBot[];
	channels: Channel[];
}

export interface ContentCatalogModules {
	botModules: Record<string, unknown>;
	groupModules: Record<string, unknown>;
	channelModules: Record<string, unknown>;
}

let cachedCatalog: ContentCatalog | null = null;

export function loadContentCatalog(): ContentCatalog {
	if (cachedCatalog) return cachedCatalog;

	cachedCatalog = createContentCatalog({
		botModules: import.meta.glob('/bots/**/*.json', { eager: true, import: 'default' }),
		groupModules: import.meta.glob('/bots/**/_meta.json', { eager: true, import: 'default' }),
		channelModules: import.meta.glob('/channels/*.json', { eager: true, import: 'default' })
	});

	return cachedCatalog;
}

export function loadPublicContentCatalog(): PublicContentCatalog {
	const catalog = loadContentCatalog();
	return {
		groups: catalog.groups,
		bots: catalog.bots.map(toPublicBot),
		channels: catalog.channels
	};
}

export function toPublicBot(bot: Bot): PublicBot {
	return {
		id: bot.id,
		group: bot.group,
		name: bot.name,
		occupation: bot.occupation,
		image: bot.image,
		greeting: bot.greeting,
		bio: bot.bio
	};
}

export function createContentCatalog(modules: ContentCatalogModules): ContentCatalog {
	const errors: string[] = [];
	const botEntries: { source: string; bot: Bot }[] = [];
	const groupEntries: { source: string; group: GroupMeta }[] = [];
	const channelEntries: { source: string; channel: Channel }[] = [];

	for (const [path, raw] of sortedModuleEntries(modules.groupModules)) {
		const source = normalizeSource(path);
		const group = parseGroup(source, raw, errors);
		if (group) groupEntries.push({ source, group });
	}

	for (const [path, raw] of sortedModuleEntries(modules.botModules)) {
		if (path.endsWith('/_meta.json') || path.endsWith('_meta.json')) continue;
		const source = normalizeSource(path);
		const bot = parseBot(source, raw, errors);
		if (bot) botEntries.push({ source, bot });
	}

	for (const [path, raw] of sortedModuleEntries(modules.channelModules)) {
		const source = normalizeSource(path);
		const channel = parseChannel(source, raw, errors);
		if (channel) channelEntries.push({ source, channel });
	}

	const groupsBySlug = new Map<string, GroupMeta>();
	const showsBySlug = new Map<string, Show>();
	const botsById = new Map<string, Bot>();
	const botsByGroup = new Map<string, Bot[]>();
	const channelsBySlug = new Map<string, Channel>();

	addUnique(
		groupEntries,
		({ group }) => group.slug,
		({ group }) => group,
		groupsBySlug,
		'show slug',
		errors
	);
	for (const { group } of groupEntries) {
		if (groupsBySlug.get(group.slug) === group) {
			showsBySlug.set(group.slug, group);
		}
	}

	addUnique(
		botEntries,
		({ bot }) => bot.id,
		({ bot }) => bot,
		botsById,
		'bot id',
		errors
	);

	addUnique(
		channelEntries,
		({ channel }) => channel.slug,
		({ channel }) => channel,
		channelsBySlug,
		'channel slug',
		errors
	);

	for (const { source, bot } of botEntries) {
		if (!groupsBySlug.has(bot.group)) {
			errors.push(`${source} group "${bot.group}" does not match any show slug`);
			continue;
		}
		const groupBots = botsByGroup.get(bot.group) ?? [];
		groupBots.push(bot);
		botsByGroup.set(bot.group, groupBots);
	}

	for (const { source, channel } of channelEntries) {
		validateChannelLinks(source, channel, groupsBySlug, errors);
	}

	if (errors.length > 0) {
		throw new ContentCatalogError(errors);
	}

	return {
		bots: botEntries.map(({ bot }) => bot),
		groups: groupEntries.map(({ group }) => group),
		shows: groupEntries.map(({ group }) => group),
		channels: channelEntries.map(({ channel }) => channel),
		botsById,
		botsByGroup,
		groupsBySlug,
		showsBySlug,
		channelsBySlug
	};
}

function sortedModuleEntries(modules: Record<string, unknown>): [string, unknown][] {
	return Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));
}

function normalizeSource(path: string): string {
	return path.replace(/^\/+/, '');
}

function parseGroup(source: string, raw: unknown, errors: string[]): GroupMeta | null {
	const record = readRecord(source, raw, errors);
	if (!record) return null;

	const slug = readString(record, 'slug', source, errors);
	const name = readString(record, 'name', source, errors);
	const description = readString(record, 'description', source, errors);
	const setting = readString(record, 'setting', source, errors);
	const era = readString(record, 'era', source, errors);
	const image = readString(record, 'image', source, errors);
	const active = readBoolean(record, 'active', source, errors);
	const color = readOptionalString(record, 'color', source, errors);
	const episodes = readEpisodes(record, source, errors);

	if ('schedule' in record) {
		errors.push(`${source} schedule is retired; use channels/*.json schedules`);
	}

	if (
		slug === undefined ||
		name === undefined ||
		description === undefined ||
		setting === undefined ||
		era === undefined ||
		image === undefined ||
		active === undefined ||
		episodes === undefined
	) {
		return null;
	}

	return {
		slug,
		name,
		description,
		setting,
		era,
		image,
		active,
		...(color === undefined ? {} : { color }),
		episodes
	};
}

function parseBot(source: string, raw: unknown, errors: string[]): Bot | null {
	const record = readRecord(source, raw, errors);
	if (!record) return null;

	const id = readString(record, 'id', source, errors);
	const group = readString(record, 'group', source, errors);
	const name = readString(record, 'name', source, errors);
	const occupation = readString(record, 'occupation', source, errors);
	const image = readString(record, 'image', source, errors);
	const greeting = readString(record, 'greeting', source, errors);
	const bio = readString(record, 'bio', source, errors);
	const prompt = readString(record, 'prompt', source, errors);

	if (prompt !== undefined) {
		validatePrompt(source, id ?? 'unknown', prompt, errors);
	}

	if (
		id === undefined ||
		group === undefined ||
		name === undefined ||
		occupation === undefined ||
		image === undefined ||
		greeting === undefined ||
		bio === undefined ||
		prompt === undefined
	) {
		return null;
	}

	return { id, group, name, occupation, image, greeting, bio, prompt };
}

function parseChannel(source: string, raw: unknown, errors: string[]): Channel | null {
	const record = readRecord(source, raw, errors);
	if (!record) return null;

	const slug = readString(record, 'slug', source, errors);
	const name = readString(record, 'name', source, errors);
	const number = readNumber(record, 'number', source, errors);
	const network = readString(record, 'network', source, errors);
	const schedule = readSchedule(record, source, errors);

	if (
		slug === undefined ||
		name === undefined ||
		number === undefined ||
		network === undefined ||
		schedule === undefined
	) {
		return null;
	}

	return { slug, name, number, network, schedule };
}

function readRecord(
	source: string,
	raw: unknown,
	errors: string[]
): Record<string, unknown> | null {
	if (!isRecord(raw)) {
		errors.push(`${source} must be a JSON object`);
		return null;
	}
	return raw;
}

function readString(
	record: Record<string, unknown>,
	field: string,
	source: string,
	errors: string[]
): string | undefined {
	const value = record[field];
	if (typeof value !== 'string' || value.trim() === '') {
		errors.push(`${source} ${field} must be a non-empty string`);
		return undefined;
	}
	return value;
}

function readOptionalString(
	record: Record<string, unknown>,
	field: string,
	source: string,
	errors: string[]
): string | undefined {
	const value = record[field];
	if (value === undefined) return undefined;
	if (typeof value !== 'string' || value.trim() === '') {
		errors.push(`${source} ${field} must be a non-empty string when present`);
		return undefined;
	}
	return value;
}

function readBoolean(
	record: Record<string, unknown>,
	field: string,
	source: string,
	errors: string[]
): boolean | undefined {
	const value = record[field];
	if (typeof value !== 'boolean') {
		errors.push(`${source} ${field} must be a boolean`);
		return undefined;
	}
	return value;
}

function readNumber(
	record: Record<string, unknown>,
	field: string,
	source: string,
	errors: string[]
): number | undefined {
	const value = record[field];
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		errors.push(`${source} ${field} must be a finite number`);
		return undefined;
	}
	return value;
}

function readPositiveInteger(
	record: Record<string, unknown>,
	field: string,
	source: string,
	errors: string[]
): number | undefined {
	const value = record[field];
	if (!Number.isInteger(value) || (value as number) <= 0) {
		errors.push(`${source} ${field} must be a positive integer`);
		return undefined;
	}
	return value as number;
}

function readEpisodes(
	record: Record<string, unknown>,
	source: string,
	errors: string[]
): Episode[] | undefined {
	const rawEpisodes = record.episodes;
	if (!Array.isArray(rawEpisodes) || rawEpisodes.length === 0) {
		errors.push(`${source} episodes must be a non-empty array`);
		return undefined;
	}

	const episodes: Episode[] = [];
	const seenEpisodes = new Set<string>();

	for (let i = 0; i < rawEpisodes.length; i++) {
		const episodeSource = `${source} episodes[${i}]`;
		const episode = parseEpisode(episodeSource, rawEpisodes[i], errors);
		if (!episode) continue;

		const key = episodeKey(episode);
		if (seenEpisodes.has(key)) {
			errors.push(`${episodeSource} duplicates episode S${episode.season}E${episode.episode}`);
			continue;
		}
		seenEpisodes.add(key);
		episodes.push(episode);
	}

	return episodes.length > 0 ? episodes : undefined;
}

function parseEpisode(source: string, raw: unknown, errors: string[]): Episode | null {
	const record = readRecord(source, raw, errors);
	if (!record) return null;

	const season = readPositiveInteger(record, 'season', source, errors);
	const episode = readPositiveInteger(record, 'episode', source, errors);
	const title = readString(record, 'title', source, errors);
	const year = readString(record, 'year', source, errors);
	const premise = readString(record, 'premise', source, errors);

	if (premise !== undefined && premise.length < 20) {
		errors.push(`${source} premise must be at least 20 characters`);
	}

	if (
		season === undefined ||
		episode === undefined ||
		title === undefined ||
		year === undefined ||
		premise === undefined ||
		premise.length < 20
	) {
		return null;
	}

	return { season, episode, title, year, premise };
}

function readSchedule(
	record: Record<string, unknown>,
	source: string,
	errors: string[]
): Channel['schedule'] | undefined {
	const rawSchedule = record.schedule;
	if (!Array.isArray(rawSchedule)) {
		errors.push(`${source} schedule must be an array`);
		return undefined;
	}

	if (rawSchedule.length !== 48) {
		errors.push(`${source} schedule must contain exactly 48 slots`);
	}

	const schedule: Channel['schedule'] = [];
	for (let i = 0; i < rawSchedule.length; i++) {
		const slotSource = `${source} schedule[${i}]`;
		const slot = parseChannelSlot(slotSource, rawSchedule[i], errors);
		schedule.push(slot);
	}

	return rawSchedule.length === 48 ? schedule : undefined;
}

function parseChannelSlot(source: string, raw: unknown, errors: string[]): ChannelSlot | null {
	if (raw === null) {
		errors.push(`${source} must be a channel slot, not null`);
		return null;
	}

	const record = readRecord(source, raw, errors);
	if (!record) return null;

	const showSlug = readString(record, 'showSlug', source, errors);
	const season = readPositiveInteger(record, 'season', source, errors);
	const episode = readPositiveInteger(record, 'episode', source, errors);

	if (showSlug === undefined || season === undefined || episode === undefined) {
		return null;
	}

	return { showSlug, season, episode };
}

function validatePrompt(source: string, botId: string, prompt: string, errors: string[]): void {
	for (const section of REQUIRED_PROMPT_SECTIONS) {
		if (!prompt.includes(section)) {
			errors.push(`${source} prompt for bot "${botId}" is missing section "${section}"`);
		}
	}

	const examplesIdx = prompt.indexOf('# Examples');
	const formatIdx = prompt.indexOf('# Format');
	if (examplesIdx !== -1 && formatIdx !== -1) {
		const examplesBlock = prompt.slice(examplesIdx + '# Examples'.length, formatIdx).trim();
		if (!examplesBlock.includes('User:') || !examplesBlock.includes(':')) {
			errors.push(`${source} prompt for bot "${botId}" has an empty or malformed examples block`);
		}
	}
}

function validateChannelLinks(
	source: string,
	channel: Channel,
	groupsBySlug: Map<string, GroupMeta>,
	errors: string[]
): void {
	for (let i = 0; i < channel.schedule.length; i++) {
		const slot = channel.schedule[i];
		if (!slot) continue;

		const show = groupsBySlug.get(slot.showSlug);
		if (!show) {
			errors.push(`${source} schedule[${i}] references missing show "${slot.showSlug}"`);
			continue;
		}

		const episode = show.episodes?.find(
			(e) => e.season === slot.season && e.episode === slot.episode
		);
		if (!episode) {
			errors.push(
				`${source} schedule[${i}] references missing episode ${slot.showSlug} S${slot.season}E${slot.episode}`
			);
		}
	}
}

function addUnique<TEntry, TValue>(
	entries: TEntry[],
	keyFor: (entry: TEntry) => string,
	valueFor: (entry: TEntry) => TValue,
	map: Map<string, TValue>,
	label: string,
	errors: string[]
): void {
	const sources = new Map<string, string>();

	for (const entry of entries) {
		const source = (entry as { source: string }).source;
		const key = keyFor(entry);
		const firstSource = sources.get(key);
		if (firstSource) {
			errors.push(`${source} duplicates ${label} "${key}" already defined in ${firstSource}`);
			continue;
		}

		sources.set(key, source);
		map.set(key, valueFor(entry));
	}
}

function episodeKey(episode: Pick<Episode, 'season' | 'episode'>): string {
	return `${episode.season}:${episode.episode}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
