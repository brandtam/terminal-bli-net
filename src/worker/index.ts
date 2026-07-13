/// <reference types="@cloudflare/workers-types" />
/**
 * The deployed Worker entry (wrangler.jsonc `main`). It wraps the
 * adapter-generated SvelteKit worker and adds the two things SvelteKit output
 * cannot carry on a Workers deploy: Durable Object class exports and a
 * `scheduled()` handler. Every HTTP request still flows through SvelteKit —
 * this file must never grow app-specific routing (docs/adr/0008: an app's
 * shared-surface footprint is one line in durable-objects.ts and one entry in
 * cron.ts, nothing here).
 */
import sveltekit from 'sveltekit-worker';
import { runScheduled } from './cron';

export * from './durable-objects';

type Env = App.Platform['env'];

export default {
	fetch: (request, env, ctx) => sveltekit.fetch(request, env, ctx),
	scheduled: (controller, env, ctx) => runScheduled(controller, env, ctx)
} satisfies ExportedHandler<Env>;
