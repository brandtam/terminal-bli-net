import type { CanonSystem } from './types';
import { RUSTY_DISKETTE } from './rusty-diskette';

/**
 * Every dialable canon system. Later slices append Night Circuit, The
 * Foundry, PROJECT LODESTONE, and the Back Room; the chain test walks this
 * registry end to end.
 */
export const CANON_SYSTEMS: CanonSystem[] = [RUSTY_DISKETTE];

export function systemByNumber(digits: string): CanonSystem | null {
	return CANON_SYSTEMS.find((s) => s.number === digits) ?? null;
}

export function systemById(id: string): CanonSystem | null {
	return CANON_SYSTEMS.find((s) => s.id === id) ?? null;
}
