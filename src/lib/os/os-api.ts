import type { WindowState, TweaksState, GroupMeta } from '$lib/types';

export interface AboutSection {
	h: string;
	body: string;
}

export interface AboutSpec {
	title: string;
	version: string;
	tagline: string;
	glyph: string;
	glyphBg: string;
	glyphFg?: string;
	sections: AboutSection[];
}

export type PrefField =
	| {
			kind: 'slider';
			key: string;
			label: string;
			min: number;
			max: number;
			step: number;
			unit?: string;
			hint?: string;
	  }
	| { kind: 'toggle'; key: string; label: string; hint?: string }
	| { kind: 'select'; key: string; label: string; options: { value: string; label: string }[] }
	| { kind: 'text'; key: string; label: string; placeholder?: string };

export type PreferencesSpec =
	| { kind: 'window'; windowId: string }
	| { kind: 'fields'; fields: PrefField[] };

export interface StatusExtra {
	label: string;
	kind?: string;
}

export type MenuItemAction = {
	type: 'action';
	label: string;
	shortcut?: string;
	action?: (os: OsApi) => void;
	disabled?: boolean;
};

export type MenuItemSeparator = { type: 'separator' };

export type MenuItemCheck = {
	type: 'check';
	label: string;
	checked: boolean;
	toggle: (os: OsApi) => void;
};

export type AppMenuItem = MenuItemAction | MenuItemSeparator | MenuItemCheck;

export interface AppMenuSpec {
	label: string;
	items: AppMenuItem[];
}

export interface AppDef {
	id: string;
	name: string;
	filename: string;
	about: AboutSpec;
	preferences?: string | null;
	menus: (os: OsApi) => AppMenuSpec[];
	statusExtra?: (os: OsApi) => StatusExtra | null;
}

export interface ShowInfo {
	id: string;
	name: string;
	onAir: boolean;
}

export interface GuideApi {
	currentlyAiring: (showId: string) => boolean;
	nextAiring: (showId: string) => string;
	liveCount: () => number;
	shows: () => ShowInfo[];
}

export interface OsApi {
	launchApp: (appId: string, payload?: Record<string, unknown>) => void;
	closeFocused: () => void;
	closeWindow: (windowId: string) => void;
	focusWindow: (windowId: string) => void;
	openWindow: (windowId: string) => void;

	openSystemPreferences: () => void;
	openPreferences: (appId: string) => void;
	openAbout: (appId: string | null) => void;

	now: Date;
	timezone: string | undefined;
	tweaks: TweaksState;
	setTweak: (key: keyof TweaksState, value: TweaksState[keyof TweaksState]) => void;

	guide: GuideApi;

	listWindows: () => WindowState[];

	alert: (spec: AlertSpec) => void;
	showAlert: (spec: AlertSpec) => void;
	dismissAlert: () => void;
	startNewConversation: () => void;

	emptyTrash: () => Promise<void>;
	exportBackup: () => void;
	restoreBackup: () => void;
	reinstallOS: () => void;

	registerLaunchHandler: (
		appId: string,
		handler: (payload?: Record<string, unknown>) => void
	) => void;

	moveWindow: (id: string, x: number, y: number) => void;
	resizeWindow: (id: string, w: number, h: number) => void;
	getWindowDef: (id: string) => { title: string; w: number; h: number };

	openChat: (group: GroupMeta) => void;
	setTimezone: (tz: string) => void;
	isAppInstalled: (appId: string) => boolean;
}

export interface AlertButton {
	label: string;
	primary?: boolean;
	action?: () => void;
}

export interface AlertSpec {
	title: string;
	body: string;
	buttons?: AlertButton[];
	progress?: { durationMs: number };
}

export const WINDOW_APP_MAP: Record<string, string> = {
	'terminal-prefs': 'finder',
	welcome: 'finder',
	finder: 'finder',
	'tv-guide': 'tvguide',
	'tvguide-prefs': 'tvguide',
	'chatrbot-prefs': 'chatrbot',
	stats: 'stats',
	about: 'finder',
	'about-chatrbot': 'chatrbot',
	'about-tvguide': 'tvguide',
	'about-textedit': 'textedit',
	'about-stats': 'stats',
	'about-stickies': 'stickies',
	error: 'finder',
	trash: 'finder',
	recorder: 'recorder',
	'about-recorder': 'recorder',
	'software-shop': 'software-shop',
	'about-software-shop': 'software-shop',
	'computer-store': 'computer-store',
	'about-computer-store': 'computer-store',
	vcr: 'vcr',
	'about-vcr': 'vcr'
};

export function windowAppId(windowId: string): string {
	if (windowId.startsWith('chat-')) return 'chatrbot';
	if (windowId.startsWith('sticky-')) return 'stickies';
	if (windowId.startsWith('textedit-')) return 'textedit';
	if (windowId.startsWith('recorder-')) return 'recorder';
	return WINDOW_APP_MAP[windowId] || 'finder';
}

export {
	getAppWindowId,
	getAppIconKind,
	isSpecialLaunchApp
} from '$lib/terminalos/apps/app-install';
