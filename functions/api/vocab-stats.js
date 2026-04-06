/**
 * GET /api/vocab-stats?list=coca&limit=100
 * Return word frequency rankings for a vocabulary list across all indexed videos.
 * Words are ranked by how many distinct videos contain them.
 */
import { getVocabWordRankings, getVideoStats, getAvailableVocabLists } from './_lib/db.js'

const VALID_LISTS = new Set([
  'coca', 'ngsl', 'toeic', 'bsl', 'ielts', 'toefl',
  'academic', 'advanced', 'cefr_a', 'cefr_b1', 'cefr_c1', 'opal',
])

export async function onRequestGet(context) {
  const { request, env } = context
  const DB = env.DB

  const url = new URL(request.url)
  const listId = url.searchParams.get('list') || 'coca'
  const limit  = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)

  if (!VALID_LISTS.has(listId)) {
    return new Response(JSON.stringify({ error: 'Invalid list ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const [words, stats, available_lists] = await Promise.all([
      getVocabWordRankings(DB, listId, limit),
      getVideoStats(DB),
      getAvailableVocabLists(DB),
    ])
    return new Response(JSON.stringify({ list: listId, words, stats, available_lists }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('vocab-stats error:', err)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
