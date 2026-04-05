/**
 * GET    /api/channels/:id               — channel details + video list
 * DELETE /api/channels/:id               — unsubscribe (videos are kept)
 * POST   /api/channels/:id?action=sync   — manual RSS sync for this channel
 * POST   /api/channels/:id?action=import-all — fetch ALL video IDs via InnerTube browse
 *                                             returns list; browser then calls /api/analyze per video
 */

import { fetchChannelRss, fetchChannelVideoIds } from '../_lib/youtube.js'
import {
  getChannel, deleteChannel,
  saveChannelVideoStubs, updateChannelVideoCount, markChannelSynced,
  markChannelImportDone, getChannelVideoIds,
} from '../_lib/db.js'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function onRequest(context) {
  const { request, env, params } = context
  const DB = env.DB
  const channelId = params.id
  const method = request.method
  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  if (method === 'GET')    return handleGet(DB, channelId, url)
  if (method === 'DELETE') return handleDelete(DB, channelId)
  if (method === 'POST' && action === 'sync')       return handleSync(DB, channelId)
  if (method === 'POST' && action === 'import-all') return handleImportAll(DB, channelId, url)

  return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
}

// ── GET /api/channels/:id ─────────────────────────────────────────────────────
async function handleGet(DB, channelId, url) {
  const channel = await getChannel(DB, channelId)
  if (!channel) return json({ error: 'NOT_FOUND' }, 404)

  const limit  = parseInt(url.searchParams.get('limit')  || '200')
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const videos = await getChannelVideoIds(DB, channelId, { limit, offset })

  return json({ channel, videos })
}

// ── DELETE /api/channels/:id ──────────────────────────────────────────────────
async function handleDelete(DB, channelId) {
  const channel = await getChannel(DB, channelId)
  if (!channel) return json({ error: 'NOT_FOUND' }, 404)
  await deleteChannel(DB, channelId)
  return json({ deleted: true })
}

// ── POST /api/channels/:id?action=sync ────────────────────────────────────────
async function handleSync(DB, channelId) {
  const channel = await getChannel(DB, channelId)
  if (!channel) return json({ error: 'NOT_FOUND' }, 404)

  const rssVideos = await fetchChannelRss(channelId)
  let newCount = 0
  for (const v of rssVideos) {
    try {
      await saveChannelVideoStub(DB, { id: v.id, title: v.title, channel_id: channelId })
      newCount++
    } catch {
      // INSERT OR IGNORE — already exists
    }
  }

  await updateChannelVideoCount(DB, channelId)
  await markChannelSynced(DB, channelId)

  return json({ synced: true, checked: rssVideos.length, new: newCount })
}

// ── POST /api/channels/:id?action=import-all ──────────────────────────────────
// Fetches video IDs via InnerTube browse, stores stubs in D1 via batch inserts.
//
// Large channels (JRE has 2000+ videos) exceed Cloudflare's 30s wall-clock limit
// if we try to get everything at once. Solution: cap at 300 per call, support
// ?page=N for subsequent pages. Frontend calls in a loop until hasMore = false.
//
// Each page fetches from InnerTube from scratch (no stored continuation token).
// INSERT OR IGNORE means re-fetching the same videos is safe (no duplicates).
async function handleImportAll(DB, channelId, url) {
  const channel = await getChannel(DB, channelId)
  if (!channel) return json({ error: 'NOT_FOUND' }, 404)

  const PER_PAGE = 300
  const page = parseInt(url.searchParams.get('page') || '0')
  // Fetch (page+1)*PER_PAGE videos total, then slice the new page's window.
  // InnerTube always starts from the latest, so we overfetch and slice.
  const fetchUpTo = (page + 1) * PER_PAGE
  let allVideos = []
  try {
    allVideos = await fetchChannelVideoIds(channelId, { maxVideos: fetchUpTo })
  } catch {
    return json({ error: 'FETCH_FAILED' }, 502)
  }

  const pageVideos = allVideos.slice(page * PER_PAGE)
  const hasMore = allVideos.length >= fetchUpTo  // might be more pages

  if (pageVideos.length > 0) {
    await saveChannelVideoStubs(DB, pageVideos.map(v => ({ ...v, channel_id: channelId })))
  }

  await updateChannelVideoCount(DB, channelId)

  // Mark done only when no more pages
  if (!hasMore) await markChannelImportDone(DB, channelId)

  return json({
    page,
    imported: pageVideos.length,
    total_so_far: allVideos.length,
    hasMore,
  })
}
