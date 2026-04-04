/**
 * YouTube subtitle fetcher — InnerTube Android client approach.
 *
 * Strategy:
 * 1. POST to /youtubei/v1/player with ANDROID client context
 * 2. Extract captionTracks from response
 * 3. Fetch the English caption XML
 *
 * No API key required. Mimics the YouTube Android app.
 */

const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const ANDROID_VERSION = '20.10.38'
const ANDROID_UA = `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 14)`

/**
 * Extract video ID from a YouTube URL.
 * Supports youtube.com/watch?v= and youtu.be/
 * @param {string} url
 * @returns {string|null}
 */
export function extractVideoId(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null
    }
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      return u.searchParams.get('v') || null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Fetch English transcript for a YouTube video via InnerTube API.
 * Caps at 900 seconds (15 minutes) per spec edge case.
 *
 * @param {string} videoId
 * @returns {Promise<{transcript: Array<{text,start,dur}>} | {error: string}>}
 */
export async function fetchTranscript(videoId) {
  // Step 1: call InnerTube player endpoint (Android client — returns captions without bot check)
  let playerData
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_UA,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: ANDROID_VERSION,
          },
        },
        videoId,
      }),
    })
    if (!res.ok) return { error: 'NO_CAPTIONS' }
    playerData = await res.json()
  } catch {
    return { error: 'NETWORK_ERROR' }
  }

  // Step 2: find English caption track
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(tracks) || tracks.length === 0) return { error: 'NO_CAPTIONS' }

  const captionUrl = findEnglishCaptionUrl(tracks)
  if (!captionUrl) return { error: 'NO_CAPTIONS' }

  // Step 3: fetch caption XML
  let captionXml
  try {
    const res = await fetch(captionUrl, {
      headers: { 'User-Agent': ANDROID_UA },
    })
    if (!res.ok) return { error: 'NO_CAPTIONS' }
    captionXml = await res.text()
  } catch {
    return { error: 'NETWORK_ERROR' }
  }

  const transcript = parseCaptionXml(captionXml)
  if (transcript.length === 0) return { error: 'NO_CAPTIONS' }

  return { transcript }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findEnglishCaptionUrl(tracks) {
  const priority = [
    t => t.languageCode === 'en' && t.kind !== 'asr',  // manual English
    t => t.languageCode === 'en',                        // auto-generated English
    t => typeof t.languageCode === 'string' && t.languageCode.startsWith('en'),
  ]
  for (const pred of priority) {
    const track = tracks.find(pred)
    if (track?.baseUrl) return track.baseUrl
  }
  return null
}

function parseCaptionXml(xml) {
  const segments = []

  // InnerTube returns srv3 format: <p t="START_MS" d="DUR_MS">...</p>
  // with inner <s> word tags or plain text
  const pRegex = /<p[^>]+\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/g

  let match
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10)
    const durMs   = parseInt(match[2], 10)
    const start   = startMs / 1000
    const dur     = durMs   / 1000

    // 15-minute cap (spec edge case)
    if (start >= 900) continue

    // Strip inner tags, decode entities
    const rawText = match[3]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g,  '<')
      .replace(/&gt;/g,  '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()

    if (rawText) segments.push({ text: rawText, start, dur })
  }

  // Fallback: timedtext XML format <text start="..." dur="...">...</text>
  if (segments.length === 0) {
    const textRegex = /<text[^>]+start="([0-9.]+)"[^>]*(?:dur="([0-9.]+)")?[^>]*>([\s\S]*?)<\/text>/g
    while ((match = textRegex.exec(xml)) !== null) {
      const start = parseFloat(match[1])
      const dur   = parseFloat(match[2] || '2')
      if (start >= 900) continue
      const rawText = match[3]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim()
      if (rawText) segments.push({ text: rawText, start, dur })
    }
  }

  return segments
}
