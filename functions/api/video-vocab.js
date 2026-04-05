/**
 * POST /api/video-vocab
 * Store vocabulary index for a video.
 * Body: { video_id: string, vocab: { list_id: string[] } }
 * Called by the client after scanning the full transcript client-side.
 */
import { saveVocabIndex } from './_lib/db.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const DB = env.DB

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError(400, 'Invalid JSON')
  }

  const { video_id, vocab } = body ?? {}
  if (!video_id || typeof vocab !== 'object') {
    return jsonError(400, 'Missing video_id or vocab')
  }

  try {
    await saveVocabIndex(DB, video_id, vocab)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('saveVocabIndex error:', err)
    return jsonError(500, 'Failed to save vocab index')
  }
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
