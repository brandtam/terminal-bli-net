-- Dialer schema v1 (docs/apps-exploration/dialer/prd.md, backend spec).
-- Timestamps are unix epoch seconds. Soft delete everywhere (`deleted_at`);
-- the nightly cron hard-deletes. Canon handles are seeded caller rows with
-- pass_hash NULL + is_canon=1 so nobody can register (or log in as) the fiction.

CREATE TABLE callers (
	handle TEXT PRIMARY KEY,            -- uppercase-canonical, A-Z 0-9 . - (2-16 chars)
	pass_hash TEXT,                     -- PBKDF2-SHA256 100k iters, base64url; NULL = canon (unclaimable)
	salt TEXT,                          -- 16 random bytes, base64url
	created_at INTEGER NOT NULL,
	last_seen INTEGER,
	calls INTEGER NOT NULL DEFAULT 0,
	minutes_today INTEGER NOT NULL DEFAULT 0,   -- connect-time budget, reset nightly
	uploads_today INTEGER NOT NULL DEFAULT 0,   -- 3/day, reset nightly
	ratio_credits INTEGER NOT NULL DEFAULT 3,   -- 1:3 ratio; 3 starter credits on registration
	questionnaire_json TEXT,
	is_canon INTEGER NOT NULL DEFAULT 0,
	last_post_at INTEGER,               -- 60s post cooldown
	last_sweep_at INTEGER,              -- one autodialer sweep/day
	failed_count INTEGER NOT NULL DEFAULT 0,    -- 5 fails -> 15-min lock
	locked_until INTEGER
);

-- Sessions store only the SHA-256 of the 32-byte token; 30-day sliding expiry
-- (bumped at most once a day). The raw token never touches the database.
CREATE TABLE sessions (
	token_hash TEXT PRIMARY KEY,
	handle TEXT NOT NULL REFERENCES callers(handle),
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_handle ON sessions(handle);

CREATE TABLE topics (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	board TEXT NOT NULL,
	title TEXT NOT NULL,
	author TEXT NOT NULL REFERENCES callers(handle),
	created_at INTEGER NOT NULL,
	canon INTEGER NOT NULL DEFAULT 0,
	pinned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_topics_board ON topics(board);

CREATE TABLE posts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	topic_id INTEGER NOT NULL REFERENCES topics(id),
	author TEXT NOT NULL REFERENCES callers(handle),
	body TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	canon INTEGER NOT NULL DEFAULT 0,
	pinned INTEGER NOT NULL DEFAULT 0,
	flagged INTEGER NOT NULL DEFAULT 0,
	deleted_at INTEGER
);
CREATE INDEX idx_posts_topic ON posts(topic_id);
CREATE INDEX idx_posts_flagged ON posts(flagged) WHERE flagged = 1;

CREATE TABLE files (
	id TEXT PRIMARY KEY,                -- uuid; R2 key is <board>/<id>.png for images
	board TEXT NOT NULL,
	name TEXT NOT NULL,
	kind TEXT NOT NULL,                 -- 'txt' | 'md' | 'png'
	size INTEGER NOT NULL,
	uploader TEXT NOT NULL REFERENCES callers(handle),
	body_text TEXT,                     -- txt/md live inline; NULL for images
	r2_key TEXT,                        -- images only; NULL for text
	downloads INTEGER NOT NULL DEFAULT 0,
	flagged INTEGER NOT NULL DEFAULT 0,
	deleted_at INTEGER,
	created_at INTEGER NOT NULL
);
CREATE INDEX idx_files_board ON files(board);

CREATE TABLE scores (
	board TEXT NOT NULL,
	handle TEXT NOT NULL REFERENCES callers(handle),
	score INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX idx_scores_board ON scores(board, score DESC);

-- Reserved canon handles: registration and login are both impossible against
-- pass_hash NULL, so the fiction can't be impersonated. Canon posts/topics are
-- seeded from the client content/ modules by a generator (lands with the app).
INSERT INTO callers (handle, created_at, is_canon) VALUES
	('CAPT.VECTOR', unixepoch(), 1),
	('MAINFRAME.MARY', unixepoch(), 1),
	('SLAG', unixepoch(), 1),
	('PHRACTURE', unixepoch(), 1),
	('NO.CARRIER', unixepoch(), 1),
	('WF-7', unixepoch(), 1),
	('E.WEISS', unixepoch(), 1),
	('OPERATOR', unixepoch(), 1);
