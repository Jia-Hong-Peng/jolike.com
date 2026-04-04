/**
 * DELETE /api/library/:id
 * Soft-deletes a video from the public library.
 * Requires Authorization: Bearer <ADMIN_TOKEN> header.
 */

import { softDeleteVideo } from '../_lib/db.js'

export async function onRequestDelete(context) {
  const { params, request, env } = context
  const DB = env.DB
  const ADMIN_TOKEN = env.ADMIN_TOKEN

  // Auth check
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: '無權限' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const videoId = params.id
  if (!videoId) {
    return new Response(JSON.stringify({ error: 'INVALID_ID', message: 'Missing video ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await softDeleteVideo(DB, videoId)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('library DELETE error:', err)
    return new Response(JSON.stringify({ error: 'SERVER_ERROR', message: '刪除失敗' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
