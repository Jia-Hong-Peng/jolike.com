/**
 * GET /api/library
 * Returns all public (non-deleted) videos, newest first.
 * Query params: limit (default 50), offset (default 0)
 */

import { getPublicVideos } from '../_lib/db.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const DB = env.DB

  const url = new URL(request.url)
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '50', 10), 100)
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0',  10), 0)

  try {
    const videos = await getPublicVideos(DB, { limit, offset })
    return new Response(JSON.stringify({ videos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('library GET error:', err)
    return new Response(JSON.stringify({ error: 'SERVER_ERROR', message: '載入失敗' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
