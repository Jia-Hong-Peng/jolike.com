-- Channel subscription table
-- Stores subscribed YouTube channels for automatic video import

CREATE TABLE IF NOT EXISTS channels (
  id             TEXT    PRIMARY KEY,  -- YouTube channel ID (UCxxxxxx)
  name           TEXT    NOT NULL,
  handle         TEXT,                 -- @handle if known (e.g. "@TED")
  thumbnail_url  TEXT,
  last_synced_at INTEGER,              -- Unix ts of last RSS check
  import_all_done INTEGER DEFAULT 0,  -- 1 = historical bulk import done
  video_count    INTEGER DEFAULT 0,   -- total videos imported from this channel
  created_at     INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Track which channel each video came from (nullable — user-submitted videos have no channel)
ALTER TABLE videos ADD COLUMN channel_id TEXT REFERENCES channels(id);
