-- JoLike English MVP — D1 Schema
-- Only videos table: learning_cards are generated client-side by nlp.js

CREATE TABLE IF NOT EXISTS videos (
  id               TEXT    PRIMARY KEY,  -- YouTube video ID (e.g. dQw4w9WgXcQ)
  title            TEXT,
  duration_seconds INTEGER,
  analyzed_at      INTEGER,              -- Unix timestamp
  raw_transcript   TEXT                  -- JSON array: [{text, start, dur}]
);
