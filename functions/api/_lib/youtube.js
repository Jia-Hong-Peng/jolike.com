/**
 * YouTube subtitle fetcher — InnerTube multi-client fallback strategy.
 *
 * YouTube occasionally blocks or returns empty captions for specific clients.
 * We try multiple InnerTube clients in order until one returns caption tracks.
 *
 * Client priority:
 *   1. ANDROID (19.09.37) — most permissive for captions, no bot check
 *   2. TVHTML5_SIMPLY_EMBEDDED_PLAYER — reliable fallback, no PO token needed
 *   3. IOS — second mobile fallback
 *   4. WEB_EMBEDDED_PLAYER — last resort web client
 */

const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'

const CLIENTS = [
  {
    clientName: 'ANDROID',
    clientVersion: '19.09.37',
    userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 14)',
  },
  {
    clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    clientVersion: '2.0',
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1',
  },
  {
    clientName: 'IOS',
    clientVersion: '19.45.4',
    userAgent: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_7_1 like Mac OS X)',
  },
  {
    clientName: 'WEB_EMBEDDED_PLAYER',
    clientVersion: '2.20240726.00.00',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  },
]

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
 * Tries multiple clients in order until one succeeds.
 *
 * @param {string} videoId
 * @returns {Promise<{transcript: Array<{text,start,dur}>} | {error: string}>}
 */
export async function fetchTranscript(videoId) {
  // Try each client in priority order
  for (const client of CLIENTS) {
    const tracks = await tryGetCaptionTracks(videoId, client)
    if (!tracks || tracks.length === 0) continue

    const captionUrl = findEnglishCaptionUrl(tracks)
    if (!captionUrl) continue

    // Fetch and parse the caption XML
    try {
      const res = await fetch(captionUrl, {
        headers: { 'User-Agent': client.userAgent },
      })
      if (!res.ok) continue

      const xml = await res.text()
      const transcript = parseCaptionXml(xml)
      if (transcript.length > 0) return { transcript }
    } catch {
      // try next client
    }
  }

  return { error: 'NO_CAPTIONS' }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Call InnerTube /player for a given client, return captionTracks array or null.
 * @param {string} videoId
 * @param {{ clientName, clientVersion, userAgent }} client
 * @returns {Promise<Array|null>}
 */
async function tryGetCaptionTracks(videoId, client) {
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': client.userAgent,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: client.clientName,
            clientVersion: client.clientVersion,
            hl: 'en',
          },
        },
        videoId,
      }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    return Array.isArray(tracks) && tracks.length > 0 ? tracks : null
  } catch {
    return null
  }
}

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

  // InnerTube srv3 format: <p t="START_MS" d="DUR_MS">...</p>
  const pRegex = /<p[^>]+\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  let match
  while ((match = pRegex.exec(xml)) !== null) {
    const start = parseInt(match[1], 10) / 1000
    const dur   = parseInt(match[2], 10) / 1000
    const rawText = decodeEntities(match[3].replace(/<[^>]+>/g, ' '))
    if (rawText) segments.push({ text: rawText, start, dur })
  }

  // Fallback: timedtext XML format <text start="..." dur="...">...</text>
  if (segments.length === 0) {
    const textRegex = /<text[^>]+start="([0-9.]+)"[^>]*(?:dur="([0-9.]+)")?[^>]*>([\s\S]*?)<\/text>/g
    while ((match = textRegex.exec(xml)) !== null) {
      const start = parseFloat(match[1])
      const dur   = parseFloat(match[2] || '2')
      const rawText = decodeEntities(match[3].replace(/<[^>]+>/g, ' '))
      if (rawText) segments.push({ text: rawText, start, dur })
    }
  }

  return segments
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&#39;/g,  "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g,    ' ')
    .trim()
}
