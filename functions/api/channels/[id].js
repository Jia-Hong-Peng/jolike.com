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
  saveChannelVideoStub, updateChannelVideoCount, markChannelSynced,
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
  if (method === 'POST' && action === 'import-all') return handleImportAll(DB, channelId)

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
// Uses InnerTube browse to get ALL historical video IDs, stores stubs in D1.
// The admin page then calls /api/analyze for each video to fetch transcripts.
async function handleImportAll(DB, channelId) {
  const channel = await getChannel(DB, channelId)
  if (!channel) return json({ error: 'NOT_FOUND' }, 404)

  const allVideos = await fetchChannelVideoIds(channelId, { maxVideos: 5000 })

  for (const v of allVideos) {
    await saveChannelVideoStub(DB, { id: v.id, title: v.title, channel_id: channelId })
  }

  await markChannelImportDone(DB, channelId)
  await updateChannelVideoCount(DB, channelId)

  return json({
    imported: allVideos.length,
    videos: allVideos,
  })
}
