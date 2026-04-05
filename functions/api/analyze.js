/**
 * POST /api/analyze
 * Accepts a YouTube URL, fetches English subtitles, caches to D1, returns transcript.
 * NLP analysis is performed client-side (compromise.js).
 */

import { extractVideoId, fetchTranscript } from './_lib/youtube.js'
import { getVideo, saveVideo, upsertVideo, deleteVideo } from './_lib/db.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const DB = env.DB

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError(400, 'INVALID_URL', '請輸入有效的 YouTube 連結')
  }

  const { url, transcript: preloadedTranscript, title: preloadedTitle, duration_seconds: preloadedDuration } = body || {}

  // ── Pre-fetched transcript path (GitHub Actions batch fetcher) ──────────────
  // When transcript is provided directly, skip YouTube fetch and save immediately.
  // Requires Bearer BATCH_SECRET to prevent abuse.
  if (Array.isArray(preloadedTranscript) && preloadedTranscript.length > 0) {
    const auth = request.headers.get('Authorization')
    const batchSecret = env.CHANNEL_SYNC_SECRET || env.BATCH_SECRET
    if (!batchSecret || auth !== `Bearer ${batchSecret}`) {
      return jsonError(401, 'UNAUTHORIZED', '需要驗證')
    }
    const videoId = extractVideoId(url || '')
    if (!videoId) return jsonError(400, 'INVALID_URL', '請輸入有效的 YouTube 連結')
    try {
      await upsertVideo(DB, {
        id: videoId,
        title: preloadedTitle || '',
        duration_seconds: preloadedDuration || 0,
        transcript: preloadedTranscript,
      })
    } catch (err) {
      console.error('D1 save error:', err)
    }
    return jsonOk({
      video: { id: videoId, title: preloadedTitle || '', duration_seconds: preloadedDuration || 0 },
      transcript: preloadedTranscript,
      cached: false,
    })
  }

  // Validate URL
  const videoId = extractVideoId(url || '')
  if (!videoId) {
    return jsonError(400, 'INVALID_URL', '請輸入有效的 YouTube 連結')
  }

  // Check D1 cache first
  const cached = await getVideo(DB, videoId)
  const isStub = cached && (!cached.raw_transcript || cached.raw_transcript.length === 0)

  // Return real cached transcript immediately
  if (cached && !isStub) {
    return jsonOk({
      video: {
        id: cached.id,
        title: cached.title,
        duration_seconds: cached.duration_seconds,
      },
      transcript: cached.raw_transcript,
      cached: true,
    })
  }

  // Fetch transcript from YouTube (new video, or stub that needs real transcript)
  const [result, title] = await Promise.all([
    fetchTranscript(videoId),
    isStub ? Promise.resolve(cached.title || '') : fetchOEmbedTitle(videoId),
  ])

  if (result.error === 'RATE_LIMITED') {
    return jsonError(429, 'RATE_LIMITED', 'YouTube 請求過於頻繁，請稍後再試')
  }
  if (result.error === 'NO_CAPTIONS') {
    // If it's a stub, Cloudflare IPs may be blocked by YouTube — auto-trigger GitHub Actions.
    if (isStub) {
      triggerGithubFetch(env, cached.channel_id).catch(() => {})
      return jsonError(422, 'TRANSCRIPT_PENDING', '字幕準備中，請稍候 1-2 分鐘再試')
    }
    return jsonError(422, 'NO_CAPTIONS', '此影片不含英文字幕，請換一支影片')
  }
  if (result.error) {
    return jsonError(500, 'ANALYSIS_FAILED', '分析失敗，請稍後再試')
  }

  const { transcript } = result

  // Estimate duration from last segment
  const lastSeg = transcript[transcript.length - 1]
  const duration_seconds = lastSeg ? Math.ceil(lastSeg.start + lastSeg.dur) : 0

  // Persist to D1 (upsert for stubs, insert-ignore for new videos)
  try {
    if (isStub) {
      await upsertVideo(DB, { id: videoId, title: cached.title || title, duration_seconds, transcript })
    } else {
      await saveVideo(DB, { id: videoId, title, duration_seconds, transcript })
    }
  } catch (err) {
    console.error('D1 save error:', err)
    // Non-fatal: still return transcript to client
  }

  return jsonOk({
    video: { id: videoId, title: isStub ? cached.title || title : title, duration_seconds },
    transcript,
    cached: false,
  })
}

/**
 * Fetch video title via YouTube oEmbed (no API key required).
 * Returns empty string on any failure — non-blocking.
 * @param {string} videoId
 * @returns {Promise<string>}
 */
async function fetchOEmbedTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=https://youtu.be/${videoId}&format=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return ''
    const data = await res.json()
    return data?.title || ''
  } catch {
    return ''
  }
}

/**
 * Fire-and-forget: trigger GitHub Actions to fetch transcripts for a channel.
 * Uses the same workflow as the admin UI button.
 */
async function triggerGithubFetch(env, channelId) {
  const token = env.GITHUB_TOKEN
  if (!token) return
  const body = { ref: 'main', inputs: { limit: '50' } }
  if (channelId) body.inputs.channel = channelId
  await fetch(
    'https://api.github.com/repos/Jia-Hong-Peng/jolike.com/actions/workflows/fetch-transcripts.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'jolike.com',
      },
      body: JSON.stringify(body),
    }
  )
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonError(status, error, message) {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
