-- Live boards (slice 2). Topics gain the message section they were posted in
-- (a board's sections are canon — General Chatter, The Grapevine, … — and the
-- server validates against src/lib/server/dialer/boards.ts), plus a seed slug.
-- Canon topics are seeded from the client content modules keyed by (board,
-- slug), which makes seed migrations idempotent and gives read-tracking a
-- stable id; user-created topics leave slug NULL.
--
-- pinned_rank carries the content module's authored fiction order (canon
-- post dates are not monotonic, so created_at cannot): pinned topics list by
-- it, community topics leave it NULL and list by activity.
ALTER TABLE topics ADD COLUMN section TEXT NOT NULL DEFAULT '';
ALTER TABLE topics ADD COLUMN slug TEXT;
ALTER TABLE topics ADD COLUMN pinned_rank INTEGER;
CREATE UNIQUE INDEX idx_topics_board_slug ON topics(board, slug) WHERE slug IS NOT NULL;
