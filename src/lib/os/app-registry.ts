import type { AppDef } from './os-api';
import { synthApps, synthWindowComponent } from '$lib/terminalos/apps/app-catalog';

/**
 * The app registry — menus, About content, and Preferences per app.
 *
 * Synthesized from the per-app manifests (see manifests.ts / app-catalog.ts).
 * Only apps that have menus/about/preferences UI appear here, exactly as the
 * hand-authored map did.
 */
export const APPS: Record<string, AppDef> = synthApps();

/**
 * Resolves a window-id to its lazy component loader (or undefined for windows
 * Desktop renders with bespoke markup). Desktop awaits the loader so each app's
 * chunk is fetched only when its window opens.
 */
export { synthWindowComponent as getWindowComponent };
