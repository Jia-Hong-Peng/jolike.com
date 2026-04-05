/**
 * POST /api/channels/sync
 *
 * Poll RSS feeds for all subscribed channels and store new videos as stubs.
 * Called by GitHub Actions cron every hour.
 *
 * Auth: Bearer token from CHANNEL_SYNC_SECRET env var (same pattern as push-send).
 */

import { getAllChannels, saveChannelVideoStub, updateChannelVideoCount, markChannelSynced } from '../_lib/db.js'
import { fetchChannelRss } from '../_lib/youtube.js'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function onRequestPost(context) {
  const { request, env } = context

  // Auth check
  const auth = request.headers.get('Authorization') || ''
  const secret = env.CHANNEL_SYNC_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return json({ error: 'UNAUTHORIZED' }, 401)
  }

  const DB = env.DB
  const channels = await getAllChannels(DB)

  if (channels.length === 0) return json({ synced: 0, channels: [] })

  const results = []
  for (const channel of channels) {
    try {
      const rssVideos = await fetchChannelRss(channel.id)
      let newCount = 0
      for (const v of rssVideos) {
        try {
          await saveChannelVideoStub(DB, { id: v.id, title: v.title, channel_id: channel.id })
          newCount++
        } catch {
          // INSERT OR IGNORE — video already exists
        }
      }
      await updateChannelVideoCount(DB, channel.id)
      await markChannelSynced(DB, channel.id)
      results.push({ id: channel.id, name: channel.name, checked: rssVideos.length, new: newCount })
    } catch (err) {
      results.push({ id: channel.id, name: channel.name, error: err.message })
    }
  }

  return json({ synced: channels.length, results })
}
