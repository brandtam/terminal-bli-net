import type { CanonSystem } from './types';
import { RUSTY_DISKETTE } from './rusty-diskette';
import { NIGHT_CIRCUIT } from './night-circuit';
import { FOUNDRY } from './foundry';
import { LODESTONE } from './lodestone';

/**
 * Every dialable canon system, in chain order: the three public boards (live
 * server layer) and PROJECT LODESTONE (static secret). The chain test walks
 * this registry end to end.
 */
export const CANON_SYSTEMS: CanonSystem[] = [RUSTY_DISKETTE, NIGHT_CIRCUIT, FOUNDRY, LODESTONE];

export function systemByNumber(digits: string): CanonSystem | null {
	return CANON_SYSTEMS.find((s) => s.number === digits) ?? null;
}

export function systemById(id: string): CanonSystem | null {
	return CANON_SYSTEMS.find((s) => s.id === id) ?? null;
}
