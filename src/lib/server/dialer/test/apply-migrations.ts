import { applyD1Migrations } from 'cloudflare:test';
import { env } from './env';

// Applies the real shipped migrations from migrations/dialer/ before the
// suite, so the tests exercise the exact production schema. Idempotent — the
// helper tracks already-applied migrations.
await applyD1Migrations(env.DIALER_DB, env.TEST_MIGRATIONS);
