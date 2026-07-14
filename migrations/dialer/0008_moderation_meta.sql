-- Migration number: 0008	2026-07-13
-- Small key/value side table; first tenant is the moderation seam's daily
-- LLM-call counter (moderation-calls:<UTC date>), pruned by the nightly cron.
CREATE TABLE meta (
	key TEXT PRIMARY KEY,
	value INTEGER NOT NULL DEFAULT 0
);
