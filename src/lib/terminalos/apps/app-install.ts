import type { AppId, PersistedAppId } from '../filesystem/types';
import {
	synthAppWindowId,
	synthAppIconKind,
	synthAppLaunchStrategy,
	synthIsSpecialLaunchApp,
	type SynthAppLaunchStrategy
} from './app-catalog';

/**
 * Maps an appId to the window ID that should be opened when that app is launched.
 * Some apps have fixed window IDs; some are launched differently (e.g., stickies creates new notes).
 *
 * Returns undefined if the app requires special handling (like chatrbot which needs a show context).
 *
 * Takes PersistedAppId: getInstalledApps feeds it ids read off disk, so an
 * unknown id must resolve to undefined rather than fail to compile.
 *
 * Synthesized from the per-app manifests (see manifests.ts / app-catalog.ts).
 */
export function getAppWindowId(appId: PersistedAppId): string | undefined {
	return synthAppWindowId(appId);
}

/**
 * Maps an appId to the PixelIcon kind string used by Desktop and Finder.
 *
 * Takes PersistedAppId for the same reason as getAppWindowId — it falls back to
 * 'doc' for ids the catalog no longer knows.
 *
 * Synthesized from the per-app manifests (see manifests.ts / app-catalog.ts).
 */
export function getAppIconKind(appId: PersistedAppId): string {
	return synthAppIconKind(appId);
}

/**
 * The complete launch strategy for an app. Fixed-window apps open their exact
 * app window, custom apps run their manifest-owned handler, and catalog-only or
 * coming-soon apps are not launchable.
 */
export function getAppLaunchStrategy(appId: PersistedAppId): SynthAppLaunchStrategy {
	return synthAppLaunchStrategy(appId);
}

export function isLaunchableApp(appId: PersistedAppId): boolean {
	return getAppLaunchStrategy(appId).kind !== 'none';
}

/**
 * Apps that require custom launch handling (not just "open window X").
 * Derived from manifest launch metadata; keep no hardcoded app-id list here.
 */
export type SpecialLaunchApp = AppId;

export function isSpecialLaunchApp(appId: AppId): appId is SpecialLaunchApp {
	return synthIsSpecialLaunchApp(appId);
}
