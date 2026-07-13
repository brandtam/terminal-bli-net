-- Live boards (slice 2). Topics gain the message section they were posted in
-- (a board's sections are canon — General Chatter, The Grapevine, … — and the
-- server validates against src/lib/server/dialer/boards.ts), plus a seed slug.
-- Canon topics are seeded from the client content modules keyed by (board,
-- slug), which makes seed migrations idempotent and gives read-tracking a
-- stable id; user-created topics leave slug NULL.
ALTER TABLE topics ADD COLUMN section TEXT NOT NULL DEFAULT '';
ALTER TABLE topics ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX idx_topics_board_slug ON topics(board, slug) WHERE slug IS NOT NULL;
