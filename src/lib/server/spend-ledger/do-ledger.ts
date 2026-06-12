import { DurableObject } from 'cloudflare:workers';
import { LedgerCore, type LedgerState } from './ledger-core';
import { resolveCeilings, DEFAULT_RESERVATION_TTL_MS, type CeilingEnv } from './config';
import { logLedgerEvent } from './observability';
import type { LedgerStatus, ReconcileInput, ReserveRequest, ReserveResult } from './types';

/**
 * The single global Spend Ledger, as a Durable Object.
 *
 * One instance (`idFromName('global')`) serializes every chat request through a
 * single authority, which is what makes the dollar ceilings *exact* — concurrent
 * requests can't race a counter the way they could on KV. The DO owns no rules
 * of its own: it delegates to the pure `LedgerCore` and persists the core's
 * snapshot after each mutation so state survives eviction.
 *
 * This file imports `cloudflare:workers`, so it is only ever loaded inside the
 * Worker runtime (the reminder Worker re-exports it). The Pages app talks to it
 * through the HTTP adapter in `do-adapter.ts`, never by importing this class.
 *
 * Time crosses the wire as epoch milliseconds (`nowMs`) rather than `Date`, so
 * the contract is explicit and JSON-safe.
 */

const STORAGE_KEY = 'ledger';

export type SpendLedgerDOEnv = CeilingEnv;

export class SpendLedgerDO extends DurableObject<SpendLedgerDOEnv> {
	private core!: LedgerCore;

	constructor(ctx: DurableObjectState, env: SpendLedgerDOEnv) {
		super(ctx, env);
		// Restore committed totals + live reservations before any request runs.
		ctx.blockConcurrencyWhile(async () => {
			const state = await ctx.storage.get<LedgerState>(STORAGE_KEY);
			this.core = new LedgerCore({
				ceilings: resolveCeilings(env),
				reservationTtlMs: DEFAULT_RESERVATION_TTL_MS,
				state,
				// Production observability — captured by the Worker's `observability`.
				emit: logLedgerEvent
			});
		});
	}

	private persist(): Promise<void> {
		return this.ctx.storage.put(STORAGE_KEY, this.core.snapshot());
	}

	async reserve(req: ReserveRequest, nowMs: number): Promise<ReserveResult> {
		const result = this.core.reserve(req, new Date(nowMs));
		await this.persist();
		return result;
	}

	async reconcile(reservationId: string, actual: ReconcileInput, nowMs: number): Promise<void> {
		this.core.reconcile(reservationId, actual, new Date(nowMs));
		await this.persist();
	}

	async release(reservationId: string, nowMs: number): Promise<void> {
		void nowMs;
		this.core.release(reservationId);
		await this.persist();
	}

	async status(nowMs: number): Promise<LedgerStatus> {
		return this.core.status(new Date(nowMs));
	}
}
