import type { AppId } from '../filesystem/types';
import type { TerminalAppDefinition } from './app-types';
import { synthAppLibrary } from './app-catalog';

/**
 * The app library — install/ownership/lifecycle metadata for every app.
 *
 * Synthesized from the per-app manifests (see manifests.ts / app-catalog.ts),
 * which are now the single source of truth. The shape and contents are
 * byte-identical to the hand-authored list this replaced.
 */
export const APP_LIBRARY: TerminalAppDefinition[] = synthAppLibrary();

export function getAppDef(appId: AppId): TerminalAppDefinition | undefined {
	return APP_LIBRARY.find((a) => a.id === appId);
}

/** System apps — always owned, seeded on a clean disk. */
export function getSystemApps(): TerminalAppDefinition[] {
	return APP_LIBRARY.filter((a) => a.isSystem);
}

export function getDesktopAliasApps(): TerminalAppDefinition[] {
	return APP_LIBRARY.filter((a) => a.desktopAliasByDefault);
}

export function getStoreApps(): TerminalAppDefinition[] {
	return APP_LIBRARY.filter((a) => !a.isSystem);
}
