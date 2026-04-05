/**
 * GET /api/video/:id
 * Returns cached video + transcript from D1.
 * If the video is a stub (empty transcript from channel import), fetches the
 * actual transcript from YouTube on-demand and updates the D1 record.
 */

import { getVideo, upsertVideo } from '../_lib/db.js'
import { fetchTranscript } from '../_lib/youtube.js'

export async function onRequestGet(context) {
  const { params, env } = context
  const DB = env.DB
  const videoId = params.id

  if (!videoId) {
    return jsonError(400, 'INVALID_ID', 'Missing video ID')
  }

  const video = await getVideo(DB, videoId)

  // Video not in D1 at all
  if (!video) {
    return jsonError(404, 'NOT_FOUND', 'Video not found')
  }

  // Stub: transcript was not yet fetched (channel import stores empty transcript)
  const isStub = !video.raw_transcript || video.raw_transcript.length === 0

  if (isStub) {
    // Fetch transcript from YouTube on-demand
    const result = await fetchTranscript(videoId)

    if (result?.transcript && result.transcript.length > 0) {
      // Update D1 with real transcript (upsert overwrites the empty stub)
      await upsertVideo(DB, {
        id: videoId,
        title: video.title,
        duration_seconds: video.duration_seconds,
        transcript: result.transcript,
      })

      return jsonOk({
        video: { id: videoId, title: video.title, duration_seconds: video.duration_seconds },
        transcript: result.transcript,
        cached: false,
      })
    }

    // YouTube has no English captions for this video
    return jsonError(422, 'NO_CAPTIONS', '此影片不含英文字幕，請換一支影片')
  }

  return jsonOk({
    video: {
      id: video.id,
      title: video.title,
      duration_seconds: video.duration_seconds,
    },
    transcript: video.raw_transcript,
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
