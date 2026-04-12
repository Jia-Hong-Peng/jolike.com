/**
 * POST /api/admin/rebuild-word-freq
 * Rebuilds the word_freq pre-computed table from video_vocab.
 * Protected by CHANNEL_SYNC_SECRET (same as batch operations).
 *
 * Optional body: { list_id: "coca" } to rebuild a single list.
 * Omit body to rebuild all lists.
 */
import { rebuildWordFreq } from '../_lib/db.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const DB = env.DB

  const auth = request.headers.get('Authorization') || ''
  const secret = env.CHANNEL_SYNC_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return json({ error: 'UNAUTHORIZED' }, 401)
  }

  let listId = null
  try {
    const body = await request.json().catch(() => ({}))
    listId = body?.list_id || null
  } catch {}

  try {
    await rebuildWordFreq(DB, listId)
    return json({ ok: true, rebuilt: listId ?? 'all' })
  } catch (err) {
    console.error('rebuild-word-freq error:', err)
    return json({ error: 'REBUILD_FAILED', message: String(err) }, 500)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
