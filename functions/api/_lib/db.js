/**
 * Cloudflare D1 query helpers for the `videos` table.
 * All queries use parameterized statements to prevent SQL injection.
 */

/**
 * Retrieve a cached video record from D1.
 * @param {D1Database} DB
 * @param {string} id - YouTube video ID
 * @returns {Promise<{id,title,duration_seconds,analyzed_at,raw_transcript}|null>}
 */
export async function getVideo(DB, id) {
  const row = await DB
    .prepare('SELECT id, title, duration_seconds, analyzed_at, raw_transcript FROM videos WHERE id = ?')
    .bind(id)
    .first()

  if (!row) return null

  return {
    id: row.id,
    title: row.title,
    duration_seconds: row.duration_seconds,
    analyzed_at: row.analyzed_at,
    raw_transcript: JSON.parse(row.raw_transcript),
  }
}

/**
 * Save a Web Push subscription to D1.
 * Uses INSERT OR REPLACE to handle re-subscriptions from the same browser.
 * @param {D1Database} DB
 * @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription
 */
export async function savePushSubscription(DB, subscription) {
  const { endpoint, keys } = subscription
  await DB
    .prepare(
      'INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)'
    )
    .bind(endpoint, keys.p256dh, keys.auth, Math.floor(Date.now() / 1000))
    .run()
}

/**
 * Retrieve all push subscriptions.
 * @param {D1Database} DB
 * @returns {Promise<Array<{ endpoint, p256dh, auth }>>}
 */
export async function getAllPushSubscriptions(DB) {
  const { results } = await DB
    .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions')
    .all()
  return results ?? []
}

/**
 * Delete a push subscription by endpoint (used when push fails with 410 Gone).
 * @param {D1Database} DB
 * @param {string} endpoint
 */
export async function deletePushSubscription(DB, endpoint) {
  await DB
    .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
    .bind(endpoint)
    .run()
}

/**
 * Insert a new video record into D1.
 * @param {D1Database} DB
 * @param {{ id: string, title: string, duration_seconds: number, transcript: Array }} video
 */
export async function saveVideo(DB, { id, title, duration_seconds, transcript }) {
  const analyzed_at = Math.floor(Date.now() / 1000)

  await DB
    .prepare(
      'INSERT INTO videos (id, title, duration_seconds, analyzed_at, raw_transcript) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, title ?? '', duration_seconds ?? 0, analyzed_at, JSON.stringify(transcript))
    .run()
}

/**
 * List all public (non-deleted) videos for the library, newest first.
 * Returns only display metadata — no transcript (keeps response small).
 * @param {D1Database} DB
 * @param {{ limit?: number, offset?: number }} options
 * @returns {Promise<Array<{id, title, duration_seconds, analyzed_at}>>}
 */
export async function getPublicVideos(DB, { limit = 50, offset = 0 } = {}) {
  const { results } = await DB
    .prepare(
      'SELECT id, title, duration_seconds, analyzed_at FROM videos WHERE deleted_at IS NULL ORDER BY analyzed_at DESC LIMIT ? OFFSET ?'
    )
    .bind(limit, offset)
    .all()
  return results ?? []
}

/**
 * Soft-delete a video from the public library (admin only).
 * The cached transcript is preserved so existing sessions still work.
 * @param {D1Database} DB
 * @param {string} id - YouTube video ID
 */
export async function softDeleteVideo(DB, id) {
  await DB
    .prepare('UPDATE videos SET deleted_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), id)
    .run()
}
