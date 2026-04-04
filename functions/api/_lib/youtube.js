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

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'

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
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        // Bypass YouTube's GDPR consent page (shown to non-US Cloudflare IPs)
        'Cookie': 'CONSENT=YES+cb; YSC=1; VISITOR_INFO1_LIVE=1',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { error: 'NO_CAPTIONS' }
    html = await res.text()
  } catch {
    return { error: 'NETWORK_ERROR' }
  }

  // Step 2: extract captionTracks from ytInitialPlayerResponse
  const tracks = extractCaptionTracks(html)
  if (!tracks || tracks.length === 0) return { error: 'NO_CAPTIONS' }

  // Step 3: pick the best English track
  const captionUrl = findEnglishCaptionUrl(tracks)
  if (!captionUrl) return { error: 'NO_CAPTIONS' }

  // Step 4: fetch the caption XML/JSON
  let captionBody
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
 */
function extractCaptionTracks(html) {
  // Match the captionTracks JSON array directly — fastest extraction
  const match = html.match(/"captionTracks":(\[.*?\])/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
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
