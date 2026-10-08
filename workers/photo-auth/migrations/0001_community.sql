CREATE TABLE IF NOT EXISTS community_visitors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 40),
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  hidden_at INTEGER,
  client_request_id TEXT NOT NULL,
  request_body TEXT NOT NULL,
  UNIQUE(visitor_id, client_request_id)
);
CREATE INDEX IF NOT EXISTS comments_photo_order ON comments(journey_id, photo_id, created_at, id) WHERE deleted_at IS NULL AND hidden_at IS NULL;
CREATE INDEX IF NOT EXISTS comments_export_order ON comments(created_at, id);
