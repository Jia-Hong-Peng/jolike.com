/**
 * GET  /api/channels  — list all subscribed channels
 * POST /api/channels  — add a channel by URL / handle / ID
 *                       + kick off RSS import (recent 15 videos stored as stubs)
 */

import { resolveChannelId, fetchChannelInfo, fetchChannelRss } from './_lib/youtube.js'
import {
  getAllChannels, getChannel, saveChannel,
  saveChannelVideoStub, updateChannelVideoCount, markChannelSynced,
} from './_lib/db.js'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── GET /api/channels ─────────────────────────────────────────────────────────
export async function onRequestGet(context) {
  const DB = context.env.DB
  const channels = await getAllChannels(DB)
  return json({ channels })
}

// ── POST /api/channels ────────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context
  const DB = env.DB

  let body
  try { body = await request.json() } catch { return json({ error: 'INVALID_JSON' }, 400) }

  const { url } = body || {}
  if (!url || typeof url !== 'string') return json({ error: 'MISSING_URL' }, 400)

  // Resolve channel ID from URL / handle / raw ID
  const resolved = await resolveChannelId(url)
  if (!resolved) return json({ error: 'INVALID_CHANNEL_URL' }, 400)
  const { id: channelId, handle } = resolved

  // Check if already subscribed
  const existing = await getChannel(DB, channelId)
  if (existing) return json({ error: 'ALREADY_SUBSCRIBED', channel: existing }, 409)

  // Fetch channel metadata from InnerTube
  const info = await fetchChannelInfo(channelId)
  if (!info) return json({ error: 'CHANNEL_NOT_FOUND' }, 404)

  // Save channel
  await saveChannel(DB, {
    id: channelId,
    name: info.name,
    handle: handle ?? null,
    thumbnail_url: info.thumbnail_url ?? null,
  })

  // Import recent videos from RSS as stubs (fast, no transcript yet)
  const rssVideos = await fetchChannelRss(channelId)
  if (rssVideos.length > 0) {
    for (const v of rssVideos) {
      await saveChannelVideoStub(DB, { id: v.id, title: v.title, channel_id: channelId })
    }
    await updateChannelVideoCount(DB, channelId)
    await markChannelSynced(DB, channelId)
  }

  const channel = await getChannel(DB, channelId)
  return json({ channel, rssImported: rssVideos.length }, 201)
}
