import type { NodeId } from './types';

/** Lowercase for case-insensitive name comparison. */
export function normalizeNameForComparison(name: string): string {
	return name.toLowerCase();
}

/** Returns true if any sibling has the same name (case-insensitive). */
export function hasSiblingConflict(name: string, siblings: { name: string }[]): boolean {
	const normalized = normalizeNameForComparison(name);
	return siblings.some((s) => normalizeNameForComparison(s.name) === normalized);
}

/** Generate a unique node ID. Uses crypto.randomUUID() if available, falls back to timestamp+random. */
export function generateUniqueId(): NodeId {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
