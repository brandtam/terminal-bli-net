import type { ResolvedWindow } from './window-host';

/**
 * The window-resolution memo, kept in its own leaf module so app state that must
 * invalidate it (e.g. vcr-prefs on a device switch) can import `invalidateWindow`
 * WITHOUT pulling in window-host → app-catalog → manifests. That chain is a cycle
 * for any module manifests.ts imports at top level (vcr-prefs is one): app-catalog
 * evaluates PREFIX_ROUTES from MANIFESTS at load, so reaching it before manifests
 * finishes reads an undefined MANIFESTS. This module imports nothing at runtime
 * (the ResolvedWindow import is type-only, erased), so it breaks the cycle.
 */
export const resolutionCache = new Map<string, ResolvedWindow | null>();

/** Drop the memoized resolution for one window (e.g. a VCR device switch). */
export function invalidateWindow(id: string): void {
	resolutionCache.delete(id);
}
