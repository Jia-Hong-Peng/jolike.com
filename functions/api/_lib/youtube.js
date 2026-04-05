/**
 * YouTube subtitle fetcher — InnerTube ANDROID client strategy.
 *
 * Strategy:
 *   1. POST to /youtubei/v1/player with ANDROID client credentials (no PO token needed)
 *   2. Extract captionTracks from the JSON response
 *   3. Find the English track and fetch its timedtext XML
 *   4. Fallback: watch page HTML parsing if InnerTube returns no tracks
 *
 * Why ANDROID client:
 *   The WEB InnerTube client now requires a Proof-of-Origin (PO) token server-side.
 *   The ANDROID client uses a different auth path and returns captionTracks without
 *   a PO token. The timedtext URLs it provides work without IP or session binding.
 *
 * Why not the direct timedtext API:
 *   /api/timedtext?v=ID&lang=en returns HTTP 200 with 0 bytes for most videos
 *   unless the full set of session parameters (ei, signature, etc.) is included.
 *   Those parameters come from the InnerTube / watch-page response.
 */

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const ANDROID_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
const ANDROID_CLIENT_VERSION = '20.10.38'

// Headers that make the watch-page request look like a real browser navigation.
const WATCH_PAGE_HEADERS = {
  'User-Agent': BROWSER_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cookie': 'SOCS=CAI; YSC=1; VISITOR_INFO1_LIVE=1',
}

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
 * Fetch English transcript for a YouTube video.
 * @param {string} videoId
 * @returns {Promise<{transcript: Array<{text,start,dur}>} | {error: string}>}
 */
export async function fetchTranscript(videoId) {
  // Strategy 1: InnerTube ANDROID client (primary — works without PO token)
  const result = await fetchTranscriptViaAndroid(videoId)
  if (result) return result

  // Strategy 2: Watch page HTML parsing (fallback)
  return fetchTranscriptViaWatchPage(videoId)
}

// ---------------------------------------------------------------------------
// Strategy 1: InnerTube ANDROID client
// ---------------------------------------------------------------------------

/**
 * Fetch transcript via InnerTube ANDROID client.
 * The ANDROID client returns captionTracks with timedtext URLs that work
 * server-side without a PO token or IP binding.
 * @param {string} videoId
 * @returns {Promise<{transcript: Array<{text,start,dur}>} | null>}
 */
async function fetchTranscriptViaAndroid(videoId) {
  let tracks
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_UA,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: ANDROID_CLIENT_VERSION,
          },
        },
        videoId,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  } catch {
    return null
  }

  if (!Array.isArray(tracks) || tracks.length === 0) return null

  const captionUrl = findEnglishCaptionUrl(tracks)
  if (!captionUrl) return null

  try {
    const res = await fetch(captionUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const body = await res.text()
    if (!body) return null
    const transcript = parseCaptions(body)
    if (transcript.length === 0) return null
    return { transcript }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Strategy 2: Watch page HTML parsing (fallback)
// ---------------------------------------------------------------------------

async function fetchTranscriptViaWatchPage(videoId) {
  let html
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: WATCH_PAGE_HEADERS,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { error: 'NO_CAPTIONS' }
    html = await res.text()
  } catch {
    return { error: 'NETWORK_ERROR' }
  }

  const tracks = extractCaptionTracks(html)
  if (!tracks || tracks.length === 0) return { error: 'NO_CAPTIONS' }

  const captionUrl = findEnglishCaptionUrl(tracks)
  if (!captionUrl) return { error: 'NO_CAPTIONS' }

  try {
    const res = await fetch(captionUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return { error: 'NO_CAPTIONS' }
    const body = await res.text()
    if (!body) return { error: 'NO_CAPTIONS' }
    const transcript = parseCaptions(body)
    if (transcript.length === 0) return { error: 'NO_CAPTIONS' }
    return { transcript }
  } catch {
    return { error: 'NETWORK_ERROR' }
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Extract captionTracks array from the YouTube watch page HTML.
 * They live inside ytInitialPlayerResponse as JSON.
 *
 * Uses bracket counting instead of regex so nested arrays inside track objects
 * (e.g. translationLanguages) don't truncate the extraction prematurely.
 */
function extractCaptionTracks(html) {
  const key = '"captionTracks":'
  const start = html.indexOf(key)
  if (start === -1) return null

  const bracketStart = html.indexOf('[', start + key.length)
  if (bracketStart === -1) return null

  let depth = 0
  let inString = false
  let escape = false
  let end = -1

  for (let i = bracketStart; i < html.length; i++) {
    const ch = html[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }

  if (end === -1) return null
  try {
    return JSON.parse(html.slice(bracketStart, end + 1))
  } catch {
    return null
  }
}

function findEnglishCaptionUrl(tracks) {
  const priority = [
    t => t.languageCode === 'en' && t.kind !== 'asr',      // manual English
    t => t.languageCode === 'en',                             // auto-generated English
    t => t.languageCode === 'en-US',                          // en-US variant
    t => typeof t.languageCode === 'string' && t.languageCode.startsWith('en'),
  ]
  for (const pred of priority) {
    const track = tracks.find(pred)
    if (track?.baseUrl) return track.baseUrl
  }
  return null
}

/**
 * Parse caption response — handles both timedtext XML and srv3 JSON formats.
 */
function parseCaptions(body) {
  const trimmed = body.trimStart()

  // JSON3 format (YouTube timedtext fmt=json3)
  if (trimmed.startsWith('{')) {
    return parseJson3(body)
  }

  // XML formats
  return parseXml(body)
}

function parseJson3(body) {
  try {
    const data = JSON.parse(body)
    const events = data?.events ?? []
    const segments = []
    for (const ev of events) {
      if (!ev.segs) continue
      const start = (ev.tStartMs ?? 0) / 1000
      const dur   = (ev.dDurationMs ?? 2000) / 1000
      const text = ev.segs.map(s => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim()
      if (text && text !== '\n') segments.push({ text, start, dur })
    }
    return segments
  } catch {
    return []
  }
}

function parseXml(xml) {
  const segments = []
  let match

  // srv3 format: <p t="START_MS" d="DUR_MS">...</p>
  const pRegex = /<p[^>]+\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  while ((match = pRegex.exec(xml)) !== null) {
    const start = parseInt(match[1], 10) / 1000
    const dur   = parseInt(match[2], 10) / 1000
    const text  = decodeEntities(match[3].replace(/<[^>]+>/g, ' '))
    if (text) segments.push({ text, start, dur })
  }
  if (segments.length > 0) return segments

  // timedtext format: <text start="..." dur="...">...</text>
  const textRegex = /<text[^>]+start="([0-9.]+)"[^>]*(?:dur="([0-9.]+)")?[^>]*>([\s\S]*?)<\/text>/g
  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1])
    const dur   = parseFloat(match[2] || '2')
    const text  = decodeEntities(match[3].replace(/<[^>]+>/g, ' '))
    if (text) segments.push({ text, start, dur })
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
