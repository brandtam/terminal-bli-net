/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env as rawEnv } from 'cloudflare:test';
import type { D1Migration } from '@cloudflare/vitest-pool-workers';
import type { DialerBoardNode } from '../board-node';

/**
 * The bindings test/wrangler.jsonc provides, typed. The pool types `env` as
 * the global `Cloudflare.Env`; augmenting that global would force DIALER_*
 * onto every worker env in the repo, so this project casts locally instead.
 */
export interface DialerTestEnv {
	DIALER_DB: D1Database;
	DIALER_FILES: R2Bucket;
	DIALER_BOARD_NODE: DurableObjectNamespace<DialerBoardNode>;
	TEST_MIGRATIONS: D1Migration[];
}

export const env = rawEnv as unknown as DialerTestEnv;
