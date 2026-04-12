-- word_freq: pre-computed per-list word frequency table.
-- Rebuilt after batch vocab indexing; avoids expensive json_each full scan on every page load.
-- video_count = distinct non-deleted videos that contain the word in the given list.

CREATE TABLE IF NOT EXISTS word_freq (
  list_id     TEXT    NOT NULL,
  word        TEXT    NOT NULL,
  video_count INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (list_id, word)
);

-- Fast ranked lookup: top words per list sorted by frequency
CREATE INDEX IF NOT EXISTS idx_word_freq_rank ON word_freq(list_id, video_count DESC);
