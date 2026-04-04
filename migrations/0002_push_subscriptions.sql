-- Migration 0002: push_subscriptions table for Web Push notifications
-- Apply with: wrangler d1 execute DB --local --file=migrations/0002_push_subscriptions.sql

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint   TEXT    NOT NULL UNIQUE,
  p256dh     TEXT    NOT NULL,   -- subscriber's ECDH public key (base64url)
  auth       TEXT    NOT NULL,   -- subscriber's auth secret (base64url)
  created_at INTEGER NOT NULL    -- Unix timestamp
);
