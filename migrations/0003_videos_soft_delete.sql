-- Add soft-delete support to videos table
-- Admin can remove a video from the public library without losing the cached transcript.
ALTER TABLE videos ADD COLUMN deleted_at INTEGER DEFAULT NULL;
