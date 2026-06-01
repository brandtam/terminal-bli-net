export interface Episode {
	season: number;
	episode: number;
	title: string;
	year: string;
	premise: string;
}

export interface ChannelSlot {
	showSlug: string;
	season: number;
	episode: number;
}

export interface Channel {
	slug: string;
	name: string;
	number: number;
	network: string;
	schedule: (ChannelSlot | null)[];
}

export interface GroupMeta {
	slug: string;
	name: string;
	description: string;
	setting: string;
	era: string;
	image: string;
	active: boolean;
	color?: string;
	episodes?: Episode[];
}

export type Show = GroupMeta;

export interface Bot {
	id: string;
	group: string;
	name: string;
	occupation: string;
	image: string;
	greeting: string;
	bio: string;
	prompt: string;
}

export type PublicBot = Omit<Bot, 'prompt'>;

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export type LlmProvider = 'claude' | 'openai';

export interface LlmTokenUsage {
	provider: LlmProvider;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheCreationInputTokens?: number;
	cacheReadInputTokens?: number;
	estimated?: boolean;
}

export interface Conversation {
	botId: string;
	group: string;
	messages: ChatMessage[];
	updatedAt: number;
}

export interface Subscriber {
	email: string;
	timezone: string;
	showSubscriptions: string[];
	createdAt: string;
}

export interface TextChunk {
	type: 'text' | 'done' | 'error' | 'usage';
	text?: string;
	tokenCount?: number;
	usage?: LlmTokenUsage;
	error?: string;
	retryable?: boolean;
}

export interface WindowState {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	z: number;
}

export interface TweaksState {
	wallpaper: string;
	accent: string;
	tvGridLoop: number;
	marqueeLoop: number;
	tvPauseOnHover: boolean;
}
