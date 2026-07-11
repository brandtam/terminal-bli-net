/**
 * The desktop-vs-wall gate.
 *
 * The OS needs room to drag windows around, so truly small screens get a
 * static wall instead of a broken desktop. The rule differs by pointer:
 *
 * - Fine pointer (mouse/trackpad): the viewport is freely resizable, so judge
 *   the current width — the historical `< 720px` rule.
 * - Coarse pointer (tablet/phone): judge the *device*, not the orientation.
 *   Using the short/long side of the viewport makes the verdict identical in
 *   portrait and landscape, so an iPad rotating to 768px-wide portrait never
 *   flips a running session onto the wall. Tablets (short side >= 600, long
 *   side >= 720) pass in both orientations; phones fail in both — including
 *   landscape phones that are 800+ px wide but far too short to stack a menu
 *   bar, a window, and a dock.
 */
export interface ViewportInfo {
	width: number;
	height: number;
	coarsePointer: boolean;
}

export const MIN_DESKTOP_WIDTH = 720;
export const MIN_TABLET_SHORT_SIDE = 600;

export function isViewportBlocked({ width, height, coarsePointer }: ViewportInfo): boolean {
	if (coarsePointer) {
		const shortSide = Math.min(width, height);
		const longSide = Math.max(width, height);
		return shortSide < MIN_TABLET_SHORT_SIDE || longSide < MIN_DESKTOP_WIDTH;
	}
	return width < MIN_DESKTOP_WIDTH;
}

/** Read the live viewport. Browser-only — tests build a ViewportInfo by hand. */
export function readViewport(): ViewportInfo {
	return {
		width: window.innerWidth,
		height: window.innerHeight,
		coarsePointer:
			typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
	};
}
