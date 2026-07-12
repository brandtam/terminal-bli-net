import type { WindowState, TweaksState, GroupMeta } from '$lib/types';
import type { BodyGcReport, FsFile, FsResult } from '$lib/terminalos';
import { synthWindowAppMap, synthWindowAppId } from '$lib/terminalos/apps/app-catalog';

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
	activeId: string | null;
	launchApp: (appId: string, payload?: Record<string, unknown>) => void;
	closeFocused: () => void;
	closeWindow: (windowId: string) => void;
	focusWindow: (windowId: string) => void;
	openWindow: (windowId: string) => void;
	openFolder: (folderId: string, opts?: { replaceWindowId?: string }) => void;
	openDocument: (file: FsFile) => void;

	openSystemPreferences: () => void;
	openSystemMaintenance: () => void;
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
	/** The retro "disk full" dialog — one shared voice for every quota failure. */
	showDiskFullAlert: () => void;
	dismissAlert: () => void;
	startNewConversation: () => void;

	emptyTrash: () => Promise<void>;
	collectFilesystemGarbage: () => Promise<FsResult<BodyGcReport>>;
	exportBackup: () => void;
	restoreBackup: () => void;
	reinstallOS: () => void;

	moveWindow: (id: string, x: number, y: number) => void;
	resizeWindow: (id: string, w: number, h: number) => void;
	getWindowDef: (id: string) => { title: string; w: number; h: number };

	openChat: (group: GroupMeta) => void;
	openChatByShowId: (showId: string) => void;
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

// Synthesized from the per-app manifests (see manifests.ts / app-catalog.ts).
// The shape (window-id → app-id) and contents are byte-identical to the
// hand-authored map this replaced.
export const WINDOW_APP_MAP: Record<string, string> = synthWindowAppMap();

export function windowAppId(windowId: string): string {
	return synthWindowAppId(windowId);
}

export {
	getAppWindowId,
	getAppIconKind,
	isSpecialLaunchApp
} from '$lib/terminalos/apps/app-install';
