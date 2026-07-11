/**
 * Browser storage capacity awareness. `navigator.storage.estimate()` covers
 * everything this origin stores — the localStorage manifest/preferences and
 * the IndexedDB blob bodies — so it is the closest thing to a real "disk
 * gauge" Terminal HD has. Browser estimates are deliberately fuzzy, so the
 * threshold is a warning line, not a hard limit.
 */

/** Warn when estimated usage crosses this fraction of the quota. */
export const CAPACITY_WARN_RATIO = 0.8;

export type CapacityEstimate = {
	usageBytes: number;
	quotaBytes: number;
	/** usageBytes / quotaBytes, 0..1 */
	ratio: number;
};

/**
 * Read the browser's storage estimate. Returns null where the API is
 * unavailable (older browsers, some private modes, SSR) or reports nothing
 * usable — callers treat null as "no capacity data", never as "disk full".
 */
export async function estimateCapacity(): Promise<CapacityEstimate | null> {
	if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
	try {
		const { usage, quota } = await navigator.storage.estimate();
		if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) return null;
		return { usageBytes: usage, quotaBytes: quota, ratio: usage / quota };
	} catch {
		return null;
	}
}

/**
 * True when the estimate (plus an optional pending write) crosses the warning
 * threshold. Pure — no session gating here.
 */
export function isNearCapacity(estimate: CapacityEstimate | null, extraBytes = 0): boolean {
	if (!estimate) return false;
	return (estimate.usageBytes + extraBytes) / estimate.quotaBytes >= CAPACITY_WARN_RATIO;
}

// ── Once-per-session gate ────────────────────────────────────────────────
// Capacity is checked on boot and after every blob-file creation; without a
// gate a user hovering at 81% would get the same dialog after every clip.
let capacityWarned = false;

/**
 * Returns true only for the first near-capacity estimate seen this session.
 * Subsequent crossings return false until the page reloads.
 */
export function shouldWarnCapacity(estimate: CapacityEstimate | null): boolean {
	if (!isNearCapacity(estimate)) return false;
	if (capacityWarned) return false;
	capacityWarned = true;
	return true;
}

export function resetCapacityWarningForTests(): void {
	capacityWarned = false;
}

/** "1.5 MB", "512 KB" — for the maintenance window and disk dialogs. */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
