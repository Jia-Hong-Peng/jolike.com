-- video_vocab: index of vocabulary list words found in each video's full transcript.
-- Populated client-side after transcript scan; queried for "which videos have word X".

CREATE TABLE IF NOT EXISTS video_vocab (
  video_id   TEXT    NOT NULL,
  list_id    TEXT    NOT NULL,
  words      TEXT    NOT NULL DEFAULT '[]',  -- JSON array of matched canonical words
  indexed_at INTEGER NOT NULL,
  PRIMARY KEY (video_id, list_id)
);

-- Fast lookup: given a list + word, find all matching video_ids via JSON scan (app-side)
CREATE INDEX IF NOT EXISTS idx_video_vocab_list ON video_vocab(list_id);
CREATE INDEX IF NOT EXISTS idx_video_vocab_video ON video_vocab(video_id);
