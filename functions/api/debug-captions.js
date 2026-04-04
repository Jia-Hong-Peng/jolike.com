/**
 * GET /api/debug-captions?v={videoId}
 * Temporary debug endpoint — shows what the Cloudflare environment sees
 * when fetching YouTube captions. Remove after debugging.
 */

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'

export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const videoId = url.searchParams.get('v')
  if (!videoId) return json({ error: 'missing v param' })

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': 'CONSENT=YES+cb; YSC=1; VISITOR_INFO1_LIVE=1',
      },
      signal: AbortSignal.timeout(8000),
    })

    const html = await res.text()
    const hasConsent  = html.includes('consent.youtube.com') || html.includes('Before you continue')
    const hasCaptions = html.includes('"captionTracks"')
    const playMatch   = html.match(/"status":"([A-Z_]+)"/)

    // Try to extract captionTracks
    let tracks = []
    const m = html.match(/"captionTracks":(\[.*?\])/)
    if (m) {
      try { tracks = JSON.parse(m[1]) } catch {}
    }

    return json({
      httpStatus:    res.status,
      htmlLength:    html.length,
      hasConsent,
      hasCaptions,
      playStatus:    playMatch?.[1] ?? 'unknown',
      tracks:        tracks.map(t => ({ lang: t.languageCode, kind: t.kind ?? 'manual' })),
      htmlStart:     html.slice(0, 200),
    })
  } catch (err) {
    return json({ error: String(err) })
  }
}

function json(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
}
