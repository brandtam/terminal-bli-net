import type { AppId } from '../filesystem/types';
import { getAppDef } from './app-library';

/**
 * Maps an appId to the window ID that should be opened when that app is launched.
 * Some apps have fixed window IDs; some are launched differently (e.g., stickies creates new notes).
 *
 * Returns undefined if the app requires special handling (like chatrbot which needs a show context).
 */
export function getAppWindowId(appId: AppId): string | undefined {
	const map: Record<string, string> = {
		tvguide: 'tv-guide',
		recorder: 'recorder',
		stats: 'stats',
		error: 'error',
		'system-prefs': 'terminal-prefs',
		'about-terminal': 'about',
		'software-shop': 'software-shop',
		finder: 'finder'
	};
	return map[appId];
}

/**
 * Maps an appId to the PixelIcon kind string used by Desktop and Finder.
 */
export function getAppIconKind(appId: AppId): string {
	const map: Record<string, string> = {
		tvguide: 'tvguide',
		stickies: 'stickies',
		recorder: 'tv',
		stats: 'calc',
		error: 'floppy',
		'system-prefs': 'hd',
		'about-terminal': 'doc',
		textedit: 'doc',
		chatrbot: 'doc',
		'software-shop': 'floppy',
		finder: 'hd'
	};
	return map[appId] ?? 'doc';
}

/**
 * Returns true if the given appId is installed (has a filesystem node).
 * For v1 this checks the AppLibrary catalog.
 */
export function isAppInstalled(appId: AppId): boolean {
	const def = getAppDef(appId);
	if (!def) return false;
	return def.defaultInstalled;
}

/**
 * Apps that require special launch handling (not just "open window X").
 * - 'stickies' creates a new note
 * - 'chatrbot' needs a show context from TV Guide
 * - 'textedit' opens a specific document or creates a new one
 */
export type SpecialLaunchApp = 'stickies' | 'chatrbot' | 'textedit';

export function isSpecialLaunchApp(appId: AppId): appId is SpecialLaunchApp {
	return appId === 'stickies' || appId === 'chatrbot' || appId === 'textedit';
}
