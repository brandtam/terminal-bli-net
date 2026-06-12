import type { LlmProvider } from '$lib/types';
import type { DenialReason } from './types';

/**
 * One structured event per ledger decision, so the cap can be watched working
 * in production and refusals can be diagnosed (docs/prd/cost-abuse-hardening.md).
 *
 * The pure `LedgerCore` takes an `emit` sink (default no-op, to stay
 * deterministic in tests); the production Durable Object wires it to
 * `logLedgerEvent`, which the reminder Worker's `observability` captures.
 */
export type LedgerEvent =
	| {
			type: 'reserve';
			reservationId: string;
			provider: LlmProvider;
			model: string;
			reservedUsd: number;
			day: string;
			month: string;
	  }
	| { type: 'deny'; reason: DenialReason; detail: string }
	| { type: 'commit'; reservationId: string; provider: LlmProvider; usd: number }
	| { type: 'refund'; reservationId: string }
	| { type: 'expire'; reservationId: string; provider: LlmProvider; usd: number };

export type LedgerEventSink = (event: LedgerEvent) => void;

/**
 * Default sink: emit one JSON line per event. Cloudflare's Workers Logs index
 * the fields, so `event:"spend-ledger"` + `decision` are queryable. Logging must
 * never break a chat response, so a failing sink is swallowed.
 */
export function logLedgerEvent(event: LedgerEvent): void {
	try {
		console.log(JSON.stringify({ event: 'spend-ledger', decision: event.type, ...event }));
	} catch {
		// Never let observability throw into the request path.
	}
}
