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
    .prepare('SELECT id, channel_id, title, duration_seconds, analyzed_at, raw_transcript FROM videos WHERE id = ?')
    .bind(id)
    .first()

  if (!row) return null

  return {
    id: row.id,
    channel_id: row.channel_id,
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
 * Uses INSERT OR IGNORE — does not overwrite existing records.
 * @param {D1Database} DB
 * @param {{ id: string, title: string, duration_seconds: number, transcript: Array }} video
 */
export async function saveVideo(DB, { id, title, duration_seconds, transcript }) {
  const analyzed_at = Math.floor(Date.now() / 1000)

  await DB
    .prepare(
      'INSERT OR IGNORE INTO videos (id, title, duration_seconds, analyzed_at, raw_transcript) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, title ?? '', duration_seconds ?? 0, analyzed_at, JSON.stringify(transcript))
    .run()
}

/**
 * Upsert a video record — updates transcript + duration if the record already exists.
 * Used when filling in transcripts for channel-import stubs.
 * @param {D1Database} DB
 * @param {{ id: string, title: string, duration_seconds: number, transcript: Array }} video
 */
export async function upsertVideo(DB, { id, title, duration_seconds, transcript }) {
  const analyzed_at = Math.floor(Date.now() / 1000)
  await DB
    .prepare(
      `INSERT INTO videos (id, title, duration_seconds, analyzed_at, raw_transcript)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         raw_transcript = excluded.raw_transcript,
         duration_seconds = CASE WHEN excluded.duration_seconds > 0 THEN excluded.duration_seconds ELSE duration_seconds END,
         analyzed_at = excluded.analyzed_at`
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

export async function deleteVideo(DB, id) {
  await DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run()
}

// ── video_vocab ────────────────────────────────────────────────────────────────

/**
 * Save vocabulary index for a video (upsert per list).
 * @param {D1Database} DB
 * @param {string} videoId
 * @param {Record<string, string[]>} vocab - { list_id: [word, ...] }
 */
export async function saveVocabIndex(DB, videoId, vocab) {
  const indexed_at = Math.floor(Date.now() / 1000)
  const statements = Object.entries(vocab).map(([list_id, words]) =>
    DB.prepare(
      'INSERT OR REPLACE INTO video_vocab (video_id, list_id, words, indexed_at) VALUES (?, ?, ?, ?)'
    ).bind(videoId, list_id, JSON.stringify(words), indexed_at)
  )
  if (statements.length > 0) await DB.batch(statements)
}

// ── channels ──────────────────────────────────────────────────────────────────

export async function getAllChannels(DB) {
  const { results } = await DB
    .prepare('SELECT id, name, handle, thumbnail_url, last_synced_at, import_all_done, video_count, created_at FROM channels ORDER BY created_at DESC')
    .all()
  return results ?? []
}

export async function getChannel(DB, id) {
  return DB
    .prepare('SELECT id, name, handle, thumbnail_url, last_synced_at, import_all_done, video_count, created_at FROM channels WHERE id = ?')
    .bind(id)
    .first()
}

export async function saveChannel(DB, { id, name, handle, thumbnail_url }) {
  await DB
    .prepare('INSERT OR IGNORE INTO channels (id, name, handle, thumbnail_url, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, name, handle ?? null, thumbnail_url ?? null, Math.floor(Date.now() / 1000))
    .run()
}

export async function markChannelSynced(DB, id) {
  await DB
    .prepare('UPDATE channels SET last_synced_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), id)
    .run()
}

export async function markChannelImportDone(DB, id) {
  await DB
    .prepare('UPDATE channels SET import_all_done = 1 WHERE id = ?')
    .bind(id)
    .run()
}

export async function updateChannelVideoCount(DB, id) {
  await DB
    .prepare('UPDATE channels SET video_count = (SELECT COUNT(*) FROM videos WHERE channel_id = ? AND deleted_at IS NULL) WHERE id = ?')
    .bind(id, id)
    .run()
}

export async function deleteChannel(DB, id) {
  await DB.prepare('DELETE FROM channels WHERE id = ?').bind(id).run()
}

/**
 * Save a video that came from a channel subscription.
 * Upserts — if video already exists (user-submitted), adds channel_id.
 */
export async function saveChannelVideo(DB, { id, title, duration_seconds, transcript, channel_id }) {
  const analyzed_at = Math.floor(Date.now() / 1000)
  await DB
    .prepare(
      `INSERT INTO videos (id, title, duration_seconds, analyzed_at, raw_transcript, channel_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET channel_id = COALESCE(channel_id, excluded.channel_id)`
    )
    .bind(id, title ?? '', duration_seconds ?? 0, analyzed_at, JSON.stringify(transcript), channel_id)
    .run()
}

/**
 * Save a video stub (no transcript yet) from channel import.
 */
export async function saveChannelVideoStub(DB, { id, title, channel_id }) {
  await DB
    .prepare(
      `INSERT OR IGNORE INTO videos (id, title, duration_seconds, analyzed_at, raw_transcript, channel_id)
       VALUES (?, ?, 0, ?, '[]', ?)`
    )
    .bind(id, title ?? '', Math.floor(Date.now() / 1000), channel_id)
    .run()
}

/**
 * Batch-insert multiple video stubs (much faster than individual inserts).
 * Uses D1 batch() to execute up to 100 statements per round-trip.
 * @param {D1Database} DB
 * @param {Array<{id, title, channel_id}>} videos
 */
export async function saveChannelVideoStubs(DB, videos) {
  if (videos.length === 0) return
  const now = Math.floor(Date.now() / 1000)
  const CHUNK = 100
  for (let i = 0; i < videos.length; i += CHUNK) {
    const chunk = videos.slice(i, i + CHUNK)
    await DB.batch(
      chunk.map(v =>
        DB.prepare(
          `INSERT OR IGNORE INTO videos (id, title, duration_seconds, analyzed_at, raw_transcript, channel_id)
           VALUES (?, ?, 0, ?, '[]', ?)`
        ).bind(v.id, v.title ?? '', now, v.channel_id)
      )
    )
  }
}

/**
 * Get all video IDs for a channel (with/without transcript).
 */
export async function getChannelVideoIds(DB, channelId, { limit = 500, offset = 0 } = {}) {
  const { results } = await DB
    .prepare('SELECT id, title, raw_transcript FROM videos WHERE channel_id = ? AND deleted_at IS NULL ORDER BY analyzed_at DESC LIMIT ? OFFSET ?')
    .bind(channelId, limit, offset)
    .all()
  return (results ?? []).map(r => ({
    id: r.id,
    title: r.title,
    hasTranscript: r.raw_transcript && r.raw_transcript !== '[]',
  }))
}

/**
 * Get site-wide video statistics.
 * @param {D1Database} DB
 * @returns {Promise<{total: number, with_transcript: number, indexed: number}>}
 *   total           — all non-deleted videos (including stubs)
 *   with_transcript — videos that have a real transcript
 *   indexed         — videos that have at least one vocab_vocab entry
 */
export async function getVideoStats(DB) {
  const [totals, indexedRow] = await Promise.all([
    DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN raw_transcript IS NOT NULL AND raw_transcript != '[]' THEN 1 ELSE 0 END) AS with_transcript
      FROM videos
      WHERE deleted_at IS NULL
    `).first(),
    DB.prepare(`
      SELECT COUNT(DISTINCT video_id) AS indexed FROM video_vocab
    `).first(),
  ])
  return {
    total:           totals?.total           ?? 0,
    with_transcript: totals?.with_transcript ?? 0,
    indexed:         indexedRow?.indexed     ?? 0,
  }
}

/**
 * Get list IDs that have at least one entry in video_vocab.
 * Used to hide empty list tabs in the UI.
 * @param {D1Database} DB
 * @returns {Promise<string[]>}
 */
export async function getAvailableVocabLists(DB) {
  const { results } = await DB
    .prepare(`
      SELECT DISTINCT vv.list_id
      FROM video_vocab vv
      WHERE EXISTS (
        SELECT 1 FROM videos v
        WHERE v.id = vv.video_id AND v.deleted_at IS NULL
      )
    `)
    .all()
  return (results ?? []).map(r => r.list_id)
}

/**
 * Get word frequency rankings across all indexed videos for a given vocab list.
 * Uses json_each to unpack the JSON words array stored in each row.
 * @param {D1Database} DB
 * @param {string} listId - e.g. 'coca', 'toeic', 'ngsl'
 * @param {number} limit
 * @param {number} offset - for pagination (0 = top 100, 100 = 101-200, etc.)
 * @returns {Promise<Array<{word: string, video_count: number}>>}
 */
export async function getVocabWordRankings(DB, listId, limit = 100, offset = 0) {
  const { results } = await DB
    .prepare(`
      SELECT je.value AS word, COUNT(DISTINCT vv.video_id) AS video_count
      FROM video_vocab vv, json_each(vv.words) je
      WHERE vv.list_id = ?
        AND EXISTS (
          SELECT 1 FROM videos v
          WHERE v.id = vv.video_id AND v.deleted_at IS NULL
        )
      GROUP BY je.value
      ORDER BY video_count DESC
      LIMIT ? OFFSET ?
    `)
    .bind(listId, limit, offset)
    .all()
  return results ?? []
}

/**
 * Get all videos that contain a specific word in a vocab list.
 * Loads all rows for the list then filters by word in application code.
 * @param {D1Database} DB
 * @param {string} listId
 * @param {string} word - canonical word to search
 * @returns {Promise<Array<{id, title}>>}
 */
export async function getVideosForWord(DB, listId, word) {
  const { results } = await DB
    .prepare(`
      SELECT v.id, v.title, vv.words
      FROM video_vocab vv
      JOIN videos v ON v.id = vv.video_id
      WHERE vv.list_id = ?
        AND v.deleted_at IS NULL
      ORDER BY v.analyzed_at DESC
    `)
    .bind(listId)
    .all()

  const lw = word.toLowerCase()
  return (results ?? [])
    .filter(row => {
      try {
        return JSON.parse(row.words).some(w => w.toLowerCase() === lw)
      } catch { return false }
    })
    .map(row => ({ id: row.id, title: row.title }))
}
