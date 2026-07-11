import type { WindowState, TweaksState, Conversation } from './types';

function isWindowState(v: unknown): v is WindowState {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		typeof o.id === 'string' &&
		typeof o.x === 'number' &&
		typeof o.y === 'number' &&
		typeof o.w === 'number' &&
		typeof o.h === 'number' &&
		typeof o.z === 'number'
	);
}

function isWindowStateArray(v: unknown): v is WindowState[] {
	return Array.isArray(v) && v.every(isWindowState);
}

function isTweaksState(v: unknown): v is TweaksState {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		typeof o.wallpaper === 'string' &&
		typeof o.accent === 'string' &&
		typeof o.tvGridLoop === 'number' &&
		typeof o.marqueeLoop === 'number' &&
		typeof o.tvPauseOnHover === 'boolean'
	);
}

const KEYS = {
	windows: 'terminal.os.windows',
	tweaks: 'terminal.os.tweaks',
	conversations: 'terminal.app.chatrbot.conversations',
	timezone: 'terminal.os.timezone',
	sessionId: 'terminal.os.session',
	firstVisit: 'terminal.os.firstVisit',
	chatSessionToken: 'terminal.app.chatrbot.sessionToken'
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

// ── Quota failure surfacing ─────────────────────────────────────────────
// This module can't import the OS alert system (the OS imports persistence —
// that would be a cycle), so quota failures are surfaced through a callback
// the OS registers at boot. Writes keep degrading gracefully: the failure is
// reported once per session, then set() goes back to failing silently so a
// full disk doesn't spam a dialog on every keystroke.
let quotaListener: (() => void) | null = null;
let quotaReported = false;

export function onPersistenceQuotaExceeded(listener: () => void): void {
	quotaListener = listener;
}

export function resetQuotaReportingForTests(): void {
	quotaListener = null;
	quotaReported = false;
}

function set<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Quota exceeded — the write is lost but the app must keep running.
		// Only consume the once-per-session report when a listener actually
		// hears it, so a failure before the OS boots doesn't burn the dialog.
		if (!quotaReported && quotaListener) {
			quotaReported = true;
			quotaListener();
		}
	}
}

export function loadWindows(): WindowState[] {
	const raw = get<unknown>(KEYS.windows, []);
	return isWindowStateArray(raw) ? raw : [];
}

export function saveWindows(windows: WindowState[]): void {
	set(KEYS.windows, windows);
}

const TWEAKS_DEFAULTS: TweaksState = {
	wallpaper: 'teal',
	// Mirrors --brand-color-orange in brand.css. A TS default can't read a CSS
	// var, so keep this hex in sync with that token if the brand orange changes.
	accent: '#f54e00',
	tvGridLoop: 400,
	marqueeLoop: 100,
	tvPauseOnHover: false
};

export function loadTweaks(): TweaksState {
	const raw = get<unknown>(KEYS.tweaks, TWEAKS_DEFAULTS);
	return isTweaksState(raw) ? raw : TWEAKS_DEFAULTS;
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

export function saveConversations(all: Record<string, Conversation>): void {
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

/**
 * The signed Turnstile session token (issued by /api/chat for ~30 min). Stored
 * so subsequent messages — even across reloads — skip the human challenge. An
 * expired token is harmless: the server rejects it and the client re-challenges.
 */
export function getChatSessionToken(): string | null {
	return get<string | null>(KEYS.chatSessionToken, null) || null;
}

export function setChatSessionToken(token: string): void {
	set(KEYS.chatSessionToken, token);
}

export function clearChatSessionToken(): void {
	set(KEYS.chatSessionToken, '');
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

export function clearAllPreferences(): void {
	if (typeof localStorage === 'undefined') return;
	for (const key of Object.values(KEYS)) {
		localStorage.removeItem(key);
	}
}
