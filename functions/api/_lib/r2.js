/**
 * R2 transcript storage helpers.
 * Transcripts are stored as JSON under key: transcripts/{videoId}.json
 * D1 raw_transcript sentinel 'r2' indicates the transcript lives here.
 */

const key = id => `transcripts/${id}.json`

/**
 * @param {R2Bucket} R2
 * @param {string} videoId
 * @returns {Promise<Array|null>}
 */
export async function getTranscript(R2, videoId) {
  const obj = await R2.get(key(videoId))
  if (!obj) return null
  return obj.json()
}

/**
 * @param {R2Bucket} R2
 * @param {string} videoId
 * @param {Array} transcript
 */
export async function saveTranscript(R2, videoId, transcript) {
  await R2.put(key(videoId), JSON.stringify(transcript), {
    httpMetadata: { contentType: 'application/json' },
  })
}
