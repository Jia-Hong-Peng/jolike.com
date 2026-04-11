/**
 * POST /api/analyze
 * Accepts a YouTube URL, fetches English subtitles, caches to D1, returns transcript.
 * NLP analysis is performed client-side (compromise.js).
 */

import { extractVideoId, fetchTranscript } from './_lib/youtube.js'
import { getVideo, saveVideo, upsertVideo, deleteVideo } from './_lib/db.js'
import { getTranscript, saveTranscript } from './_lib/r2.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const DB = env.DB
  const R2 = env.TRANSCRIPTS

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
      if (R2) await saveTranscript(R2, videoId, preloadedTranscript)
      await upsertVideo(DB, {
        id: videoId,
        title: preloadedTitle || '',
        duration_seconds: preloadedDuration || 0,
        transcript: R2 ? 'r2' : preloadedTranscript,
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
  console.log(`[analyze] ${videoId} cached=${!!cached} isStub=${isStub} channel_id=${cached?.channel_id ?? 'n/a'}`)

  // Return real cached transcript immediately
  if (cached && !isStub) {
    const transcript = cached.transcript_in_r2 && R2
      ? await getTranscript(R2, videoId)
      : cached.raw_transcript
    return jsonOk({
      video: {
        id: cached.id,
        title: cached.title,
        duration_seconds: cached.duration_seconds,
      },
      transcript,
      cached: true,
    })
  }

  // Fetch transcript from YouTube (new video, or stub that needs real transcript)
  const [result, title] = await Promise.all([
    fetchTranscript(videoId),
    isStub ? Promise.resolve(cached.title || '') : fetchOEmbedTitle(videoId),
  ])

  console.log(`[analyze] ${videoId} fetchTranscript result=${result.error ?? 'ok'} segments=${result.transcript?.length ?? 0}`)

  // RATE_LIMITED = Cloudflare IP blocked by YouTube (429). Save as stub for local batch processing.
  if (result.error === 'RATE_LIMITED') {
    if (!isStub) {
      await saveVideo(DB, { id: videoId, title, duration_seconds: 0, transcript: [] }).catch(() => {})
    }
    return jsonError(422, 'TRANSCRIPT_PENDING', '字幕準備中，請稍候 1-2 分鐘再試')
  }

  if (result.error === 'NO_CAPTIONS') {
    return jsonError(422, 'NO_CAPTIONS', '此影片不含英文字幕，請換一支影片')
  }
  if (result.error) {
    return jsonError(500, 'ANALYSIS_FAILED', '分析失敗，請稍後再試')
  }

  const { transcript } = result

  // Estimate duration from last segment
  const lastSeg = transcript[transcript.length - 1]
  const duration_seconds = lastSeg ? Math.ceil(lastSeg.start + lastSeg.dur) : 0

  // Persist transcript to R2 (preferred) then update D1 with sentinel or fallback JSON
  try {
    if (R2) await saveTranscript(R2, videoId, transcript)
    const raw = R2 ? 'r2' : transcript
    if (isStub) {
      await upsertVideo(DB, { id: videoId, title: cached.title || title, duration_seconds, transcript: raw })
    } else {
      await saveVideo(DB, { id: videoId, title, duration_seconds, transcript: raw })
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
