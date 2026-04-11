-- phrase_stats: top N-gram phrases extracted from all video transcripts.
-- Populated by scripts/index-phrases.mjs.
-- Used by /phrases/ page for high-frequency phrase learning.

CREATE TABLE IF NOT EXISTS phrase_stats (
  phrase           TEXT    PRIMARY KEY,
  video_count      INTEGER NOT NULL DEFAULT 0,  -- distinct videos containing this phrase
  total_count      INTEGER NOT NULL DEFAULT 0,  -- total occurrences across all videos
  example_video_id TEXT,
  example_start    REAL,   -- seconds into example video
  example_text     TEXT,   -- surrounding transcript sentence
  updated_at       INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_phrase_stats_freq ON phrase_stats(video_count DESC);
