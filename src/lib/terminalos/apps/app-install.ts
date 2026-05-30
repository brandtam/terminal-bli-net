import type { AppId } from '../filesystem/types';
import { synthAppWindowId, synthAppIconKind } from './app-catalog';

/**
 * Maps an appId to the window ID that should be opened when that app is launched.
 * Some apps have fixed window IDs; some are launched differently (e.g., stickies creates new notes).
 *
 * Returns undefined if the app requires special handling (like chatrbot which needs a show context).
 *
 * Synthesized from the per-app manifests (see manifests.ts / app-catalog.ts).
 */
export function getAppWindowId(appId: AppId): string | undefined {
	return synthAppWindowId(appId);
}

/**
 * Maps an appId to the PixelIcon kind string used by Desktop and Finder.
 *
 * Synthesized from the per-app manifests (see manifests.ts / app-catalog.ts).
 */
export function getAppIconKind(appId: AppId): string {
	return synthAppIconKind(appId);
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
