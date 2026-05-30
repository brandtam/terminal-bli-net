export type ShuttleDir = 'ff' | 'rew';
/** A shuttle state. level 1..3 maps to 2×/4×/8×. `null` elsewhere means "normal 1× play". */
export type Shuttle = { dir: ShuttleDir; level: 1 | 2 | 3 };

/** Speed multiplier for a shuttle level. */
export const SHUTTLE_RATES = [1, 2, 4, 8] as const; // index by level (0 = normal)

export function rateForLevel(level: number): number {
	return SHUTTLE_RATES[level] ?? 1;
}

/** The level reached by advancing from the current one. `null` = back to normal 1× play. */
const NEXT_LEVEL: Record<1 | 2 | 3, (1 | 2 | 3) | null> = {
	1: 2,
	2: 3,
	3: null
};

/**
 * Tap a shuttle direction. Returns the next shuttle state, or null for "back to normal 1× play".
 * - From normal (null) OR when switching direction → level 1 in the tapped direction.
 * - Tapping the SAME direction advances level: 1 → 2 → 3 → null (normal).
 */
export function nextShuttle(cur: Shuttle | null, dir: ShuttleDir): Shuttle | null {
	if (!cur || cur.dir !== dir) return { dir, level: 1 };
	const lvl = NEXT_LEVEL[cur.level];
	if (lvl === null) return null;
	return { dir, level: lvl };
}
