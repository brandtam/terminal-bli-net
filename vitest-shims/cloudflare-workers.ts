/**
 * Node-test shim for the `cloudflare:workers` runtime module.
 *
 * The `unit` Vitest project runs the reminder Worker's node-friendly handler
 * tests (`workers/reminder-agent/src/index.test.ts`) in plain Node, but that
 * entry transitively imports `SpendLedgerDO`, which extends the real
 * `DurableObject` base from `cloudflare:workers` — a module that only exists in
 * workerd. The DO class is never *instantiated* in those tests (they exercise
 * pure functions), so a no-op base is enough to let the import graph load.
 *
 * The Durable Object's real behaviour is covered in the Cloudflare pool project
 * (`workers/reminder-agent/test/spend-ledger.test.ts`), inside actual workerd.
 */
export class DurableObject<Env = unknown> {
	protected ctx: DurableObjectState;
	protected env: Env;

	constructor(ctx: DurableObjectState, env: Env) {
		this.ctx = ctx;
		this.env = env;
	}
}
