-- Canon file areas share the community files table (PRD: "canon and community
-- share one surface"). `canon=1` rows are seeded by generated migrations and
-- immutable by construction — no API write path updates or deletes them; the
-- nightly sweep skips them. `pinned_rank` lists canon files in authored module
-- order above community uploads, mirroring topics.pinned_rank.
ALTER TABLE files ADD COLUMN canon INTEGER NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN pinned_rank INTEGER;
