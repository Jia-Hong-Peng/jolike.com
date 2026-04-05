/**
 * YouTube subtitle fetcher — watch page HTML strategy.
 *
 * Strategy:
 *   1. Fetch youtube.com/watch?v={id} with browser User-Agent
 *   2. Extract captionTracks from ytInitialPlayerResponse in the HTML
 *   3. Find the English track and fetch its timedtext XML
 *
 * Why not InnerTube API:
 *   YouTube's /youtubei/v1/player now requires a Proof-of-Origin (PO) token
 *   when called server-side, causing empty captionTracks for most videos.
 *   The watch page delivers captions without that requirement.
 */

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// Headers that make the watch-page request look like a real browser navigation.
// sec-fetch-* and sec-ch-ua are the most effective signals against bot detection.
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
  // Bypass YouTube's GDPR consent page.
  // SOCS=CAI is the current (2024+) minimal consent cookie.
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
  // Step 1: fetch the watch page HTML
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

  // Step 2: extract captionTracks from ytInitialPlayerResponse
  const tracks = extractCaptionTracks(html)

  // Step 3: pick the best English track
  // Fallback: if watch-page extraction fails (bot detection / changed HTML structure),
  // try the direct timedtext API which works without parsing the watch page.
  let captionUrl
  let captionBody  // may already be populated by the direct fallback (avoids re-fetch)
  if (tracks && tracks.length > 0) {
    captionUrl = findEnglishCaptionUrl(tracks)
  }
  if (!captionUrl) {
    const direct = await findEnglishCaptionUrlDirect(videoId)
    if (direct) {
      captionUrl = direct.url
      captionBody = direct.body  // already fetched during probing — reuse it
    }
  }
  if (!captionUrl) return { error: 'NO_CAPTIONS' }

  // Step 4: fetch the caption XML/JSON (skip if body already obtained in step 3)
  if (!captionBody) {
    try {
      const res = await fetch(captionUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) return { error: 'NO_CAPTIONS' }
      captionBody = await res.text()
    } catch {
      return { error: 'NETWORK_ERROR' }
    }
  }

  const transcript = parseCaptions(captionBody)
  if (transcript.length === 0) return { error: 'NO_CAPTIONS' }

  return { transcript }
}

// ---------------------------------------------------------------------------
// Helpers
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

  // Find the opening '[' of the array value
  const bracketStart = html.indexOf('[', start + key.length)
  if (bracketStart === -1) return null

  // Walk forward counting brackets until the matching ']'
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
 * Fallback: probe the direct timedtext API when watch-page extraction fails.
 * YouTube's timedtext endpoint accepts language code directly and doesn't require
 * parsing ytInitialPlayerResponse. Tries en, en-US, and auto-generated (kind=asr).
 * Returns { url, body } for the first working track, or null if none found.
 * The body is the already-fetched caption text so the caller avoids re-fetching.
 * @param {string} videoId
 * @returns {Promise<{ url: string, body: string } | null>}
 */
async function findEnglishCaptionUrlDirect(videoId) {
  const candidates = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&kind=asr&fmt=json3`,
  ]
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const text = await res.text()
      // Non-empty JSON with events means the track exists and has content
      if (text && text.length > 10 && text.trimStart().startsWith('{')) {
        const data = JSON.parse(text)
        if (data?.events?.length > 0) return { url, body: text }
      }
    } catch {
      // try next candidate
    }
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
