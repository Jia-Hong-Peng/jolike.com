/**
 * GET /api/video/:id
 * Returns cached video + transcript from D1.
 * If the video is a stub (empty transcript from channel import), fetches the
 * actual transcript from YouTube on-demand and updates the D1 record.
 */

import { getVideo, upsertVideo, deleteVideo } from '../_lib/db.js'
import { fetchTranscript } from '../_lib/youtube.js'
import { getTranscript, saveTranscript } from '../_lib/r2.js'

export async function onRequestGet(context) {
  const { params, env } = context
  const DB = env.DB
  const R2 = env.TRANSCRIPTS
  const videoId = params.id

  if (!videoId) {
    return jsonError(400, 'INVALID_ID', 'Missing video ID')
  }

  const video = await getVideo(DB, videoId)

  // Video not in D1 at all
  if (!video) {
    return jsonError(404, 'NOT_FOUND', 'Video not found')
  }

  // Stub: no transcript in D1 or R2
  const isStub = !video.raw_transcript && !video.transcript_in_r2

  if (isStub) {
    // Fetch transcript from YouTube on-demand
    const result = await fetchTranscript(videoId)

    if (result?.transcript && result.transcript.length > 0) {
      // Save to R2 (preferred) then update D1 with sentinel or fallback JSON
      if (R2) await saveTranscript(R2, videoId, result.transcript)
      await upsertVideo(DB, {
        id: videoId,
        title: video.title,
        duration_seconds: video.duration_seconds,
        transcript: R2 ? 'r2' : result.transcript,
      })

      return jsonOk({
        video: { id: videoId, title: video.title, duration_seconds: video.duration_seconds },
        transcript: result.transcript,
        cached: false,
      })
    }

    // YouTube has no English captions — remove the stub so it doesn't stay in the library
    await deleteVideo(DB, videoId).catch(() => {})
    return jsonError(422, 'NO_CAPTIONS', '此影片不含英文字幕，請換一支影片')
  }

  // Serve transcript from D1 (legacy) or R2
  const transcript = video.transcript_in_r2 && R2
    ? await getTranscript(R2, videoId)
    : video.raw_transcript

  return jsonOk({
    video: {
      id: video.id,
      title: video.title,
      duration_seconds: video.duration_seconds,
    },
    transcript,
    cached: true,
  })
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
