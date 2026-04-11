/**
 * POST /api/admin/migrate-r2
 * Internal endpoint: reads raw_transcript from D1, saves to R2, updates D1 to 'r2' sentinel.
 * Processes one page of videos per request to stay within Worker CPU limits.
 *
 * Body: { secret: string, offset?: number, limit?: number }
 * Returns: { migrated, skipped, errors, has_more, next_offset }
 */
import { saveTranscript } from '../_lib/r2.js'

const PAGE = 50

export async function onRequestPost(context) {
  const { request, env } = context
  const DB = env.DB
  const R2 = env.TRANSCRIPTS

  if (!R2) return err(500, 'R2 binding not configured')

  let body
  try { body = await request.json() } catch { return err(400, 'Invalid JSON') }

  const secret = env.CHANNEL_SYNC_SECRET || env.BATCH_SECRET
  if (!secret || body.secret !== secret) return err(401, 'Unauthorized')

  const limit = Math.min(parseInt(body.limit ?? PAGE, 10), PAGE)

  // Always fetch from the top of the remaining non-migrated rows.
  // Do NOT use OFFSET — as rows get set to 'r2' mid-flight, OFFSET shifts.
  const { results } = await DB.prepare(`
    SELECT id, title, duration_seconds, analyzed_at, raw_transcript
    FROM videos
    WHERE raw_transcript IS NOT NULL
      AND raw_transcript != '[]'
      AND raw_transcript != 'r2'
    ORDER BY id
    LIMIT ?
  `).bind(limit + 1).all()

  const has_more = results.length > limit
  const page = results.slice(0, limit)

  let migrated = 0, skipped = 0, errors = 0

  const d1Updates = []

  for (const row of page) {
    let transcript
    try {
      transcript = JSON.parse(row.raw_transcript)
    } catch {
      errors++
      continue
    }
    if (!Array.isArray(transcript) || transcript.length === 0) {
      skipped++
      continue
    }

    try {
      await saveTranscript(R2, row.id, transcript)
      d1Updates.push(
        DB.prepare("UPDATE videos SET raw_transcript = 'r2' WHERE id = ?").bind(row.id)
      )
      migrated++
    } catch (e) {
      console.error(`migrate-r2 error for ${row.id}:`, e)
      errors++
    }
  }

  // Batch D1 updates (shrinks DB significantly)
  if (d1Updates.length > 0) {
    try {
      await DB.batch(d1Updates)
    } catch (e) {
      console.error('D1 batch update failed:', e)
      // R2 uploads succeeded; D1 updates can be retried on next call
    }
  }

  return new Response(JSON.stringify({
    migrated,
    skipped,
    errors,
    has_more,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function err(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
