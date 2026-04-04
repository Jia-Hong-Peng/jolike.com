/**
 * GET /api/video/:id
 * Returns cached video + transcript from D1.
 */

import { getVideo } from '../_lib/db.js'

export async function onRequestGet(context) {
  const { params, env } = context
  const DB = env.DB
  const videoId = params.id

  if (!videoId) {
    return jsonError(400, 'INVALID_ID', 'Missing video ID')
  }

  const video = await getVideo(DB, videoId)
  if (!video) {
    return jsonError(404, 'NOT_FOUND', 'Video not found')
  }

  return new Response(
    JSON.stringify({
      video: {
        id: video.id,
        title: video.title,
        duration_seconds: video.duration_seconds,
      },
      transcript: video.raw_transcript,
      cached: true,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

function jsonError(status, error, message) {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
