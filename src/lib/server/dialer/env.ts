/// <reference types="@cloudflare/workers-types" />
/**
 * The Dialer's slice of the Worker env (docs/adr/0008: app-prefixed bindings).
 * Kept free of SvelteKit imports so the worker entry graph (cron dispatch, DO
 * barrel) can share it; route-only helpers live in guard.ts.
 */
import type { DialerBoardNode } from './board-node';

export interface DialerEnv {
	DIALER_DB: D1Database;
	DIALER_FILES: R2Bucket;
	DIALER_BOARD_NODE: DurableObjectNamespace<DialerBoardNode>;
	/**
	 * Kill switch: a Worker secret (`wrangler secret put DIALER_FORCE_LOCAL`),
	 * flippable without a deploy. When on, every /api/dialer/* route answers 503
	 * and clients degrade to LOCAL MODE.
	 */
	DIALER_FORCE_LOCAL?: string;
	/** Shared with the chat gate; registration reuses the same Turnstile seam. */
	TURNSTILE_SECRET?: string;
}

export function isForcedLocal(env: Pick<DialerEnv, 'DIALER_FORCE_LOCAL'>): boolean {
	const value = env.DIALER_FORCE_LOCAL?.trim().toLowerCase();
	return value === '1' || value === 'true' || value === 'on';
}
