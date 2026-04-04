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
