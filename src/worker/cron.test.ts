import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, type ParseError } from 'jsonc-parser';
import { DISPATCH } from './cron';

/**
 * DISPATCH is keyed by the literal cron expression workerd reports on
 * `controller.cron`. If wrangler.jsonc `triggers.crons` and DISPATCH drift —
 * an edited schedule, a typo, a trigger added without a handler — the miss is
 * silent: the cron fires into an empty table, or a handler waits on a trigger
 * that never comes. This test holds the two files in exact agreement.
 */
describe('cron dispatch table (src/worker/cron.ts)', () => {
	it('matches wrangler.jsonc triggers.crons exactly', () => {
		const configPath = fileURLToPath(new URL('../../wrangler.jsonc', import.meta.url));
		const errors: ParseError[] = [];
		const config = parse(readFileSync(configPath, 'utf8'), errors) as {
			triggers?: { crons?: string[] };
		};
		expect(errors).toEqual([]);

		const triggers = config.triggers?.crons ?? [];
		expect(Object.keys(DISPATCH).sort()).toEqual([...triggers].sort());
	});

	it('never maps a trigger to an empty handler list', () => {
		// An empty list is indistinguishable from a missing entry at runtime;
		// remove the trigger instead of stranding it.
		for (const [cron, handlers] of Object.entries(DISPATCH)) {
			expect(handlers.length, cron).toBeGreaterThan(0);
		}
	});
});
