/**
 * The Autodialer — the exchange sweeper (never the "war" kind). Pure logic:
 * given a 100-number block, it decides what each number answers with. Real
 * canon carriers always surface; everything else is deterministic noise so a
 * given block reads the same every time (no Math.random — that would make a
 * sweep un-reproducible and untestable). The window plays the compressed
 * per-call audio and prints the lines; the server's one-block-a-night gate
 * decides whether a sweep is allowed at all.
 */
import { CANON_SYSTEMS } from './content';
import { formatNumber } from './content/types';

export type CallOutcome = 'VOICE' | 'BUSY' | 'NO ANSWER' | 'CARRIER';

export type SweepCall = {
	number: string;
	outcome: CallOutcome;
	/** The canon system id if this number is a real carrier, else null. */
	systemId: string | null;
};

export type SweepResult = {
	/** e.g. "5550100-5550199". */
	block: string;
	calls: SweepCall[];
	/** The numbers that answered with a carrier — candidates for the phonebook. */
	carriers: string[];
};

/**
 * The 100 dialable blocks of the exchange. A 555 number is 555 + four digits;
 * a block fixes the first two (00..99) and sweeps the last two. So the prefix
 * is a five-char string ("55501" → 555-01xx, where LODESTONE's 555-0113
 * lives). The player learns which block to scan from the boards, not from here.
 */
export function blockPrefixes(): string[] {
	return Array.from({ length: 100 }, (_, i) => `555${String(i).padStart(2, '0')}`);
}

/** The two-digit label for a block prefix — "55501" → "01" (shown as "01xx"). */
export function blockLabel(prefix: string): string {
	return prefix.slice(3);
}

/**
 * Sweep one 100-number block (prefix like "55501"). Deterministic: a canon
 * carrier always answers CARRIER; other numbers hash to VOICE/BUSY/NO ANSWER
 * in period-plausible proportions.
 */
export function sweepBlock(prefix: string): SweepResult {
	const calls: SweepCall[] = [];
	const carriers: string[] = [];
	for (let i = 0; i < 100; i++) {
		const number = `${prefix}${String(i).padStart(2, '0')}`;
		const system = CANON_SYSTEMS.find((s) => s.number === number);
		if (system) {
			calls.push({ number, outcome: 'CARRIER', systemId: system.id });
			carriers.push(number);
		} else {
			calls.push({ number, outcome: nonCarrierOutcome(number), systemId: null });
		}
	}
	return { block: `${prefix}00-${prefix}99`, calls, carriers };
}

/**
 * The SCANLOG.TXT the window persists and the phonebook screen shows. One
 * aligned line per number, plus a header — the in-fiction artifact.
 */
export function scanlogLines(result: SweepResult): string[] {
	return result.calls.map((call) => {
		const tag = call.systemId ? 'CARRIER 2400 -- NAMED BOARD' : call.outcome;
		return `  ${formatNumber(call.number)} ... ${tag}`;
	});
}

/** A stable pseudo-outcome from the digits — no randomness, so blocks repeat. */
function nonCarrierOutcome(number: string): CallOutcome {
	let hash = 0;
	for (const ch of number) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
	const bucket = hash % 10;
	// ~40% voice, ~20% busy, ~40% no answer — a quiet residential exchange.
	if (bucket < 4) return 'VOICE';
	if (bucket < 6) return 'BUSY';
	return 'NO ANSWER';
}
