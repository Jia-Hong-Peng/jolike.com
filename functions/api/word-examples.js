/**
 * GET /api/word-examples?word=analyze&list=ngsl&limit=3
 *
 * Returns real transcript segments that contain the given word.
 * Queries video_vocab for matching video_ids, then parses raw_transcript
 * in JS to find segments. Stays well within the 10ms Cloudflare CPU limit
 * by capping at 10 videos × ~50KB transcript each.
 */

const VALID_LISTS = new Set([
  'coca', 'ngsl', 'toeic', 'bsl', 'ielts', 'toefl',
  'academic', 'advanced', 'cefr_a', 'cefr_b1', 'cefr_c1', 'opal',
])

const MAX_VIDEOS  = 10
const MAX_RESULTS = 5

export async function onRequestGet(context) {
  const { request, env } = context
  const DB = env.DB

  const url    = new URL(request.url)
  const word   = (url.searchParams.get('word') || '').trim()
  const listId = url.searchParams.get('list') || 'ngsl'
  const limit  = Math.min(parseInt(url.searchParams.get('limit') || '3', 10), MAX_RESULTS)

  if (!word) {
    return json({ error: 'word parameter required' }, 400)
  }
  if (!VALID_LISTS.has(listId)) {
    return json({ error: 'Invalid list ID' }, 400)
  }

  try {
    // Step 1: find video_ids that contain this word in the given list
    // Use json_each for exact match — avoids LIKE false positives
    const lw = word.toLowerCase()
    const { results: vocabRows } = await DB
      .prepare(`
        SELECT DISTINCT vv.video_id
        FROM video_vocab vv, json_each(vv.words) je
        JOIN videos v ON v.id = vv.video_id
        WHERE vv.list_id = ?
          AND LOWER(je.value) = ?
          AND v.deleted_at IS NULL
          AND v.raw_transcript IS NOT NULL
        LIMIT ?
      `)
      .bind(listId, lw, MAX_VIDEOS)
      .all()

    if (!vocabRows || vocabRows.length === 0) {
      return json({ word, examples: [] })
    }

    const videoIds = vocabRows.map(r => r.video_id)

    // Step 2: fetch transcripts for matched videos
    // D1 doesn't support IN with variable length — use individual queries batched
    const transcriptQueries = videoIds.map(id =>
      DB.prepare('SELECT id, title, raw_transcript FROM videos WHERE id = ?').bind(id)
    )
    const transcriptResults = await DB.batch(transcriptQueries)

    // Step 3: parse each transcript and find segments containing the word
    const examples = []
    const wordRe = new RegExp(`\\b${lw}\\b`, 'i')

    for (const result of transcriptResults) {
      if (examples.length >= limit) break
      const row = result.results?.[0]
      if (!row || !row.raw_transcript) continue

      let transcript
      try {
        transcript = JSON.parse(row.raw_transcript)
      } catch {
        continue
      }
      if (!Array.isArray(transcript) || transcript.length === 0) continue

      // Find first segment that contains the word as a whole word
      const segment = transcript.find(s => wordRe.test(s.text || ''))
      if (!segment) continue

      // Include a bit of context: grab surrounding segments for natural reading
      const idx = transcript.indexOf(segment)
      const contextSegments = transcript.slice(Math.max(0, idx - 1), idx + 3)
      const text = contextSegments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()

      examples.push({
        video_id: row.id,
        title:    row.title,
        text,
        start: segment.start,
      })
    }

    return json({ word, examples })
  } catch (err) {
    console.error('word-examples error:', err)
    return json({ error: 'Server error' }, 500)
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
