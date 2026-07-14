/**
 * Dialer-specific device taste (PRD persistence spec): baud rate and phosphor
 * tint. A module-level `$state` singleton so the open terminal window and the
 * prefs dialog share one live copy — a knob turned in prefs recolors the
 * terminal immediately. Persistence rides the per-app storage handle (same
 * appId → same namespace), hydrated once and written back on every change.
 *
 * Volume and mute are NOT here: they're the OS master audio setting (every app
 * synth routes through `os.audio`), so the prefs dialog drives `os.audio`
 * directly rather than keeping a second copy.
 */
import type { AppStorageHandle } from '$lib/os/os-context';
import type { BaudRate } from './terminal';

export type PhosphorTint = 'amber' | 'green' | 'white';

/** The amber/green/white phosphor colors, as the terminal's --phos value. */
export const PHOSPHOR_COLORS: Record<PhosphorTint, string> = {
	amber: '#ffb000',
	green: '#33ff66',
	white: '#e8e8e8'
};

interface DialerPrefs {
	baud: BaudRate;
	phosphor: PhosphorTint;
}

export const prefs = $state<DialerPrefs>({ baud: 2400, phosphor: 'amber' });

let hydrated = false;

/** Load saved prefs into the singleton once (idempotent across both windows). */
export function loadPrefs(storage: AppStorageHandle): void {
	if (hydrated) return;
	prefs.baud = storage.get<BaudRate>('baud', 2400);
	prefs.phosphor = normalizeTint(storage.get<string>('phosphor', 'amber'));
	hydrated = true;
}

export function setBaud(storage: AppStorageHandle, baud: BaudRate): void {
	prefs.baud = baud;
	storage.set('baud', baud);
}

export function setPhosphor(storage: AppStorageHandle, phosphor: PhosphorTint): void {
	prefs.phosphor = phosphor;
	storage.set('phosphor', phosphor);
}

function normalizeTint(value: string): PhosphorTint {
	return value === 'green' || value === 'white' ? value : 'amber';
}
