/**
 * POST /api/admin/index-phrases
 * Internal endpoint: receives batch of phrase frequency data and upserts into phrase_stats.
 *
 * Body: { secret: string, phrases: Array<{ phrase, video_count, total_count,
 *           example_video_id, example_start, example_text }> }
 * Returns: { upserted, skipped, errors }
 */

export async function onRequestPost(context) {
  const { request, env } = context
  const DB = env.DB

  let body
  try { body = await request.json() } catch { return err(400, 'Invalid JSON') }

  const secret = env.CHANNEL_SYNC_SECRET || env.BATCH_SECRET
  if (!secret || body.secret !== secret) return err(401, 'Unauthorized')

  const phrases = body.phrases
  if (!Array.isArray(phrases) || phrases.length === 0) {
    return err(400, 'phrases array required')
  }
  if (phrases.length > 500) {
    return err(400, 'Max 500 phrases per request')
  }

  let upserted = 0, skipped = 0, errors = 0

  const stmts = []
  for (const p of phrases) {
    if (!p.phrase || typeof p.video_count !== 'number') { skipped++; continue }
    stmts.push(
      DB.prepare(`
        INSERT INTO phrase_stats (phrase, video_count, total_count,
          example_video_id, example_start, example_text, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(phrase) DO UPDATE SET
          video_count      = MAX(video_count, excluded.video_count),
          total_count      = MAX(total_count, excluded.total_count),
          example_video_id = COALESCE(excluded.example_video_id, example_video_id),
          example_start    = COALESCE(excluded.example_start, example_start),
          example_text     = COALESCE(excluded.example_text, example_text),
          updated_at       = strftime('%s', 'now')
      `).bind(
        p.phrase,
        p.video_count,
        p.total_count || p.video_count,
        p.example_video_id || null,
        p.example_start ?? null,
        p.example_text || null,
      )
    )
    upserted++
  }

  try {
    if (stmts.length > 0) await DB.batch(stmts)
  } catch (e) {
    console.error('index-phrases batch error:', e)
    errors = stmts.length
    upserted = 0
  }

  return new Response(JSON.stringify({ upserted, skipped, errors }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function err(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
