import type { WindowState, TweaksState, Conversation } from './types';

const KEYS = {
	windows: 'terminal.os.windows',
	tweaks: 'terminal.os.tweaks',
	conversations: 'terminal.app.chatrbot.conversations',
	timezone: 'terminal.os.timezone',
	sessionId: 'terminal.os.session',
	firstVisit: 'terminal.os.firstVisit'
} as const;

const LEGACY_KEYS: Record<string, string> = {
	'terminal.os.windows': 'chatrbot:windows',
	'terminal.os.tweaks': 'chatrbot:tweaks',
	'terminal.app.chatrbot.conversations': 'chatrbot:conversations',
	'terminal.os.timezone': 'chatrbot:timezone',
	'terminal.os.session': 'chatrbot:session',
	'terminal.os.firstVisit': 'chatrbot:firstVisit'
};

function get<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		let raw = localStorage.getItem(key);
		if (raw === null) {
			const legacyKey = LEGACY_KEYS[key];
			if (legacyKey) {
				raw = localStorage.getItem(legacyKey);
				if (raw !== null) {
					localStorage.setItem(key, raw);
					localStorage.removeItem(legacyKey);
				}
			}
		}
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
		// quota exceeded
	}
}

export function loadWindows(): WindowState[] {
	return get<WindowState[]>(KEYS.windows, []);
}

export function saveWindows(windows: WindowState[]): void {
	set(KEYS.windows, windows);
}

export function loadTweaks(): TweaksState {
	return get<TweaksState>(KEYS.tweaks, {
		wallpaper: 'teal',
		accent: '#f54e00',
		tvGridLoop: 400,
		marqueeLoop: 100,
		tvPauseOnHover: false
	});
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

export function appRead<T>(appId: string, key: string, fallback: T): T {
	return get<T>(`terminal.app.${appId}.${key}`, fallback);
}

export function appWrite<T>(appId: string, key: string, value: T): void {
	set(`terminal.app.${appId}.${key}`, value);
}
