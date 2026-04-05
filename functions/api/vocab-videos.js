/**
 * GET /api/vocab-videos?list=toeic&word=acquire
 * Return videos that contain a specific word from a vocabulary list.
 */
import { getVideosForWord } from './_lib/db.js'

export async function onRequestGet(context) {
  const { request, env } = context
  const DB = env.DB

  const url = new URL(request.url)
  const listId = url.searchParams.get('list')
  const word   = url.searchParams.get('word')

  if (!listId || !word) {
    return new Response(JSON.stringify({ error: 'Missing list or word param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const videos = await getVideosForWord(DB, listId, word)
    return new Response(JSON.stringify({ videos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('getVideosForWord error:', err)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
