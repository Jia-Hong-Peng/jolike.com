#!/usr/bin/env node
/**
 * scripts/fetch-channel-transcripts.mjs
 *
 * Fetches YouTube transcripts for channel video stubs and saves them via API.
 * Designed to run in GitHub Actions — GitHub's IPs are NOT blocked by YouTube,
 * unlike Cloudflare Worker datacenter IPs (Singapore) which YouTube silently blocks.
 *
 * Usage:
 *   node scripts/fetch-channel-transcripts.mjs [--channel UCxxxxxx] [--limit 200]
 *
 * Required env vars:
 *   API_BASE      e.g. https://jolike.com
 *   BATCH_SECRET  must match Cloudflare Pages env var BATCH_SECRET
 *
 * Optional env vars:
 *   DELAY_MS      delay between videos in ms (default: 1200)
 */

import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    channel: { type: 'string' },
    limit:   { type: 'string', default: '500' },
  },
  strict: false,
})

const API_BASE    = process.env.API_BASE?.replace(/\/$/, '') || 'https://jolike.com'
const SECRET      = process.env.BATCH_SECRET || process.env.CHANNEL_SYNC_SECRET
const DELAY_MS    = parseInt(process.env.DELAY_MS || '1200', 10)
const LIMIT       = parseInt(args.limit, 10)

if (!SECRET) {
  console.error('❌ BATCH_SECRET env var is required')
  process.exit(1)
}

// ── YouTube helpers ────────────────────────────────────────────────────────────

const ANDROID_UA = 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
// InnerTube API key for Android client (public, rotated infrequently)
const INNERTUBE_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM394'

/**
 * Fetch transcript via YouTube InnerTube API (Android client).
 * This endpoint is less likely to be IP-blocked than the watch page.
 * Falls back to watch page if InnerTube returns no captions.
 */
async function fetchTranscriptForVideo(videoId) {
  // Strategy 1: InnerTube API (Android client) — typically bypasses datacenter IP blocks
  const innertube = await fetchViaInnerTube(videoId)
  if (innertube && !innertube.error) return innertube
  if (innertube?.error === 'RATE_LIMITED') return innertube

  // Strategy 2: Direct timedtext URL (works for manual captions, no watch page needed)
  const direct = await fetchViaDirectTimedtext(videoId)
  if (direct && !direct.error) return direct

  // Strategy 3: Watch page (original approach, may still work for some IPs)
  return fetchViaWatchPage(videoId)
}

async function fetchViaInnerTube(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': ANDROID_UA,
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '19.09.37',
        },
        body: JSON.stringify({
          videoId,
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '19.09.37',
              androidSdkVersion: 30,
              userAgent: ANDROID_UA,
              hl: 'en',
              gl: 'US',
            },
          },
        }),
        signal: AbortSignal.timeout(8000),
      }
    )
    if (res.status === 429) {
      process.stdout.write(`[innertube=429] `)
      return { error: 'RATE_LIMITED' }
    }
    if (!res.ok) {
      process.stdout.write(`[innertube=${res.status}] `)
      return { error: 'HTTP_ERROR' }
    }

    const data = await res.json()
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    if (tracks.length === 0) {
      // Distinguish: video has no captions vs page didn't return player data
      const status = data?.playabilityStatus?.status
      if (status && status !== 'OK') {
        process.stdout.write(`[innertube status=${status}] `)
        return { error: 'NO_CAPTIONS' }
      }
      // Got OK but no tracks — might be geo-restricted or login-required
      process.stdout.write(`[innertube ok no_tracks] `)
      return { error: 'NO_CAPTIONS' }
    }

    const captionUrl = findEnglishCaptionUrl(tracks)
    if (!captionUrl) {
      const langs = tracks.map(t => t.languageCode).join(',')
      process.stdout.write(`[innertube langs=${langs} no_en] `)
      return { error: 'NO_ENGLISH' }
    }

    // Extract title and duration from InnerTube response
    const title = data?.videoDetails?.title || ''
    const durationMs = parseInt(data?.videoDetails?.lengthSeconds || '0', 10)

    const timedtext = await fetchTimedtext(captionUrl)
    if (!timedtext || timedtext.error) return timedtext ?? { error: 'TIMEDTEXT_ERROR' }

    return { transcript: timedtext, title, duration_seconds: durationMs }
  } catch (err) {
    process.stdout.write(`[innertube_err: ${err.message?.substring(0, 30)}] `)
    return null
  }
}

async function fetchViaDirectTimedtext(videoId) {
  // Try direct timedtext URL — works for manual captions, often skips IP check
  const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ANDROID_UA },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const body = await res.text()
    if (!body || body.trim().length < 10) return null
    const transcript = parseCaptions(body)
    if (transcript.length === 0) return null
    process.stdout.write(`[direct_tt ok] `)
    return { transcript, title: '', duration_seconds: 0 }
  } catch {
    return null
  }
}

async function fetchViaWatchPage(videoId) {
  const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'SOCS=CAI; CONSENT=YES+cb; PREF=hl=en&gl=US',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (res.status === 429) {
      process.stdout.write(`[watchpage=429] `)
      return { error: 'RATE_LIMITED' }
    }
    if (!res.ok) {
      process.stdout.write(`[watchpage=${res.status}] `)
      return { error: 'HTTP_ERROR' }
    }
    const html = await res.text()
    const tracks = extractCaptionTracks(html)
    if (!tracks || tracks.length === 0) {
      process.stdout.write(`[watchpage html=${html.length}b no_tracks] `)
      return { error: 'NO_CAPTIONS' }
    }
    const captionUrl = findEnglishCaptionUrl(tracks)
    if (!captionUrl) {
      const langs = tracks.map(t => t.languageCode).join(',')
      process.stdout.write(`[watchpage langs=${langs} no_en] `)
      return { error: 'NO_ENGLISH' }
    }
    const timedtext = await fetchTimedtext(captionUrl)
    if (!timedtext || timedtext.error) return timedtext ?? { error: 'TIMEDTEXT_ERROR' }
    const title = extractTitle(html)
    const duration = extractDuration(html)
    process.stdout.write(`[watchpage ok] `)
    return { transcript: timedtext, title, duration_seconds: duration }
  } catch (err) {
    process.stdout.write(`[watchpage_err: ${err.message?.substring(0, 30)}] `)
    return { error: 'FETCH_ERROR' }
  }
}

async function fetchTimedtext(captionUrl) {
  try {
    const res = await fetch(captionUrl, {
      headers: { 'User-Agent': ANDROID_UA },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      process.stdout.write(`[timedtext=${res.status}] `)
      return { error: 'TIMEDTEXT_ERROR' }
    }
    const body = await res.text()
    if (!body) return { error: 'EMPTY_TIMEDTEXT' }
    const transcript = parseCaptions(body)
    if (transcript.length === 0) return { error: 'EMPTY_PARSE' }
    return transcript
  } catch (err) {
    process.stdout.write(`[timedtext_err: ${err.message?.substring(0, 30)}] `)
    return { error: 'TIMEDTEXT_FETCH_ERROR' }
  }
}

function extractCaptionTracks(html) {
  const key = '"captionTracks":'
  const start = html.indexOf(key)
  if (start === -1) return null

  const bracketStart = html.indexOf('[', start + key.length)
  if (bracketStart === -1) return null

  let depth = 0, inString = false, escape = false, end = -1
  for (let i = bracketStart; i < html.length; i++) {
    const ch = html[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '[') depth++
    else if (ch === ']') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) return null
  try { return JSON.parse(html.slice(bracketStart, end + 1)) } catch { return null }
}

function findEnglishCaptionUrl(tracks) {
  const priority = [
    t => t.languageCode === 'en' && t.kind !== 'asr',
    t => t.languageCode === 'en',
    t => t.languageCode === 'en-US',
    t => typeof t.languageCode === 'string' && t.languageCode.startsWith('en'),
  ]
  for (const pred of priority) {
    const track = tracks.find(pred)
    if (!track?.baseUrl) continue
    try {
      const u = new URL(track.baseUrl.startsWith('http') ? track.baseUrl : `https://www.youtube.com${track.baseUrl}`)
      u.searchParams.delete('tlang')
      if (!u.searchParams.has('fmt')) u.searchParams.set('fmt', 'json3')
      return u.toString()
    } catch { return track.baseUrl }
  }
  return null
}

function parseCaptions(body) {
  const trimmed = body.trimStart()
  if (trimmed.startsWith('{')) return parseJson3(body)
  return parseXml(body)
}

function parseJson3(body) {
  try {
    const data = JSON.parse(body)
    const segments = []
    for (const ev of data?.events ?? []) {
      if (!ev.segs) continue
      const start = (ev.tStartMs ?? 0) / 1000
      const dur   = (ev.dDurationMs ?? 2000) / 1000
      const text  = ev.segs.map(s => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim()
      if (text && text !== '\n') segments.push({ text, start, dur })
    }
    return segments
  } catch { return [] }
}

function parseXml(xml) {
  const segments = []
  const textRegex = /<text[^>]+start="([0-9.]+)"[^>]*(?:dur="([0-9.]+)")?[^>]*>([\s\S]*?)<\/text>/g
  let match
  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1])
    const dur   = parseFloat(match[2] || '2')
    const text  = match[3].replace(/<[^>]+>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()
    if (text) segments.push({ text, start, dur })
  }
  return segments
}

function extractTitle(html) {
  const m = html.match(/"title"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/)
    || html.match(/<title>([^<]+)<\/title>/)
  return m ? m[1].replace(' - YouTube', '').trim() : ''
}

function extractDuration(html) {
  const m = html.match(/"approxDurationMs"\s*:\s*"(\d+)"/)
  return m ? Math.ceil(parseInt(m[1], 10) / 1000) : 0
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function getChannels() {
  const res = await fetch(`${API_BASE}/api/channels`)
  if (!res.ok) throw new Error(`Failed to get channels: ${res.status}`)
  const data = await res.json()
  return data.channels ?? []
}

async function getStubs(channelId, limit = 500) {
  const stubs = []
  let offset = 0
  while (true) {
    const res = await fetch(`${API_BASE}/api/channels/${channelId}?limit=${limit}&offset=${offset}`)
    if (!res.ok) break
    const data = await res.json()
    const batch = (data.videos ?? []).filter(v => !v.hasTranscript)
    stubs.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }
  return stubs
}

async function saveTranscript(videoId, title, duration_seconds, transcript) {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`,
    },
    body: JSON.stringify({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      duration_seconds,
      transcript,
    }),
  })
  return res.ok
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`API: ${API_BASE}`)

  const channels = await getChannels()
  const targets = args.channel
    ? channels.filter(c => c.id === args.channel || c.handle === args.channel)
    : channels

  if (targets.length === 0) {
    console.error('No channels found' + (args.channel ? ` matching "${args.channel}"` : ''))
    process.exit(1)
  }

  for (const channel of targets) {
    console.log(`\n📺 ${channel.name} (${channel.id})`)
    const stubs = await getStubs(channel.id, LIMIT)
    console.log(`   ${stubs.length} stubs to process`)

    let success = 0, noCaptions = 0, rateLimited = 0, errors = 0
    let consecutiveRateLimits = 0

    for (const v of stubs) {
      const idx = success + noCaptions + rateLimited + errors + 1
      process.stdout.write(`   [${idx}/${stubs.length}] ${v.title?.substring(0,60) || v.id} ... `)

      const result = await fetchTranscriptForVideo(v.id)

      if (!result || result.error) {
        const errCode = result?.error || 'UNKNOWN'
        if (errCode === 'RATE_LIMITED') {
          process.stdout.write('rate_limited\n')
          rateLimited++
          consecutiveRateLimits++
          // After 5 consecutive rate limits, stop processing this channel
          if (consecutiveRateLimits >= 5) {
            console.log(`   ⚠ 5 consecutive rate limits — stopping channel early`)
            break
          }
        } else if (errCode === 'NO_CAPTIONS' || errCode === 'NO_ENGLISH') {
          process.stdout.write(`${errCode.toLowerCase()}\n`)
          noCaptions++
          consecutiveRateLimits = 0
        } else {
          process.stdout.write(`error: ${errCode}\n`)
          errors++
          consecutiveRateLimits = 0
        }
      } else {
        consecutiveRateLimits = 0
        const saved = await saveTranscript(v.id, result.title || v.title, result.duration_seconds, result.transcript)
        if (saved) {
          process.stdout.write(`ok (${result.transcript.length} segments)\n`)
          success++
        } else {
          process.stdout.write('save failed\n')
          errors++
        }
      }

      await sleep(DELAY_MS + Math.random() * 800)
    }

    console.log(`   ✓ done: ${success} saved, ${noCaptions} no captions, ${rateLimited} rate_limited, ${errors} errors`)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
