import type { WindowState, TweaksState, Conversation } from './types';

const KEYS = {
	windows: 'chatrbot:windows',
	tweaks: 'chatrbot:tweaks',
	conversations: 'chatrbot:conversations',
	timezone: 'chatrbot:timezone',
	sessionId: 'chatrbot:session',
	firstVisit: 'chatrbot:firstVisit'
} as const;

function get<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function set<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// quota exceeded — silently fail
	}
}

export function loadWindows(): WindowState[] {
	return get<WindowState[]>(KEYS.windows, []);
}

export function saveWindows(windows: WindowState[]): void {
	set(KEYS.windows, windows);
}

export function loadTweaks(): TweaksState {
	return get<TweaksState>(KEYS.tweaks, { wallpaper: 'teal', accent: '#f54e00' });
}

export function saveTweaks(tweaks: TweaksState): void {
	set(KEYS.tweaks, tweaks);
}

export function loadConversations(): Record<string, Conversation> {
	return get<Record<string, Conversation>>(KEYS.conversations, {});
}

export function saveConversation(botId: string, conversation: Conversation): void {
	const all = loadConversations();
	all[botId] = conversation;
	set(KEYS.conversations, all);
}

export function loadTimezone(): string | null {
	return get<string | null>(KEYS.timezone, null);
}

export function saveTimezone(tz: string): void {
	set(KEYS.timezone, tz);
}

export function getSessionId(): string {
	const existing = get<string | null>(KEYS.sessionId, null);
	if (existing) return existing;
	const id = crypto.randomUUID();
	set(KEYS.sessionId, id);
	return id;
}

export function isFirstVisit(): boolean {
	const visited = get<boolean>(KEYS.firstVisit, false);
	if (!visited) {
		set(KEYS.firstVisit, true);
		return true;
	}
	return false;
}
