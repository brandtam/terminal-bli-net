export type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface Slot {
	day: DayOfWeek;
	start: string;
	duration: number;
}

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
	schedule?: Slot[];
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

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
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
	type: 'text' | 'done' | 'error';
	text?: string;
	tokenCount?: number;
	error?: string;
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
