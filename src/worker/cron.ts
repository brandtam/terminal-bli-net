/// <reference types="@cloudflare/workers-types" />
/**
 * Cron dispatch table (docs/adr/0008): one `scheduled()` handler, one entry
 * per app. Handlers live in their app's server space and must be idempotent —
 * a handler that throws must not stop the others, so each runs try/caught.
 */
import { dialerNightly } from '../lib/server/dialer/cron';

type Env = App.Platform['env'];
type CronHandler = { app: string; run: (env: Env, ctx: ExecutionContext) => Promise<void> };

// Keyed by the literal expression workerd hands to `controller.cron` — it must
// match wrangler.jsonc `triggers.crons` exactly or handlers silently never run
// (cron.test.ts holds the two in agreement).
export const DISPATCH: Record<string, CronHandler[]> = {
	// 05:00 UTC = midnight Eastern (winter; the fiction survives DST drift).
	'0 5 * * *': [{ app: 'dialer', run: dialerNightly }]
};

export async function runScheduled(
	controller: ScheduledController,
	env: Env,
	ctx: ExecutionContext
): Promise<void> {
	const handlers = DISPATCH[controller.cron] ?? [];
	for (const handler of handlers) {
		try {
			await handler.run(env, ctx);
		} catch (err) {
			console.error(`[cron] ${handler.app} handler failed for "${controller.cron}"`, err);
		}
	}
}
