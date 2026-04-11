/**
 * GET /api/phrase-stats?limit=100&offset=0&min_videos=5
 *
 * Returns top phrases ranked by how many distinct videos contain them.
 * Used by the /phrases/ page for high-frequency phrase learning.
 */

export async function onRequestGet(context) {
  const { request, env } = context
  const DB = env.DB

  const url    = new URL(request.url)
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '100', 10), 500)
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10))
  const minVid = parseInt(url.searchParams.get('min_videos') || '3', 10)

  try {
    const { results } = await DB.prepare(`
      SELECT phrase, video_count, total_count,
             example_video_id, example_start, example_text
      FROM phrase_stats
      WHERE video_count >= ?
      ORDER BY video_count DESC, total_count DESC
      LIMIT ? OFFSET ?
    `).bind(minVid, limit + 1, offset).all()

    const has_more = results.length > limit
    const phrases  = results.slice(0, limit)

    return json({ phrases, has_more, offset })
  } catch (err) {
    console.error('phrase-stats error:', err)
    return json({ error: 'Server error' }, 500)
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
