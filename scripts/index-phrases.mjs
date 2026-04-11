#!/usr/bin/env node
/**
 * scripts/index-phrases.mjs
 *
 * Reads all video transcripts via the API, extracts 3-6 word n-gram phrases,
 * counts frequency across distinct videos, and pushes top phrases to D1 via
 * the /api/admin/index-phrases endpoint.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node scripts/index-phrases.mjs [--limit N] [--min-videos M] [--top T]
 *
 * Options:
 *   --limit N       Max videos to process (default: all)
 *   --min-videos M  Min distinct videos a phrase must appear in (default: 5)
 *   --top T         How many top phrases to store (default: 500)
 *   --dry-run       Print results without pushing to API
 */

const API_BASE     = (process.env.API_BASE || 'https://jolike.com').replace(/\/$/, '')
const BATCH_SECRET = process.env.BATCH_SECRET || ''
const CONCURRENCY  = 4    // parallel transcript fetches
const PAGE_SIZE    = 100  // videos per page
const PUSH_BATCH   = 200  // phrases per API call
const DELAY_MS     = 200

const args = process.argv.slice(2)
const getArg = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def }
const MAX_VIDEOS  = parseInt(getArg('--limit', 'Infinity'))
const MIN_VIDEOS  = parseInt(getArg('--min-videos', '5'))
const TOP_PHRASES = parseInt(getArg('--top', '500'))
const DRY_RUN     = args.includes('--dry-run')

if (!BATCH_SECRET && !DRY_RUN) { console.error('BATCH_SECRET required'); process.exit(1) }

// ── Stopwords ─────────────────────────────────────────────────────────────────
const STOP = new Set([
  'a','an','the','in','on','at','to','for','of','and','or','but','so','if','as',
  'by','with','from','up','out','into','through','over','under','after','before',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','shall','should','may','might','can','could','must',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their','this','that','these','those',
  'not','no','yes','ok','well','just','also','too','even','only','still',
  'then','now','here','there','when','where','how','what','which','who','why',
  'all','both','each','every','some','any','other','more','most','less','few',
  'very','really','so','much','many','lot','bit','quite','rather','pretty',
  'already','yet','always','never','often','usually','again','once','twice',
  'about','around','along','toward','between','without','during','within',
  'off','back','away','instead','especially','particularly','simply','exactly',
  'suddenly','finally','quickly','slowly','clearly','easily','directly',
  'immediately','recently','actually','basically','totally','literally',
  'definitely','obviously','apparently','honestly','seriously','absolutely',
])

function isStop(w) { return STOP.has(w) }

// ── N-gram extraction ──────────────────────────────────────────────────────────
function extractPhrases(transcript) {
  const words = transcript
    .map(s => (s.text || '').toLowerCase().replace(/[^a-z\s']/g, ' '))
    .join(' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && /^[a-z]/.test(w))

  const phraseMap = new Map()  // phrase → { count, firstSeg }

  for (let i = 0; i < words.length; i++) {
    if (isStop(words[i])) continue  // skip if first word is stopword
    for (let len = 3; len <= 6; len++) {
      if (i + len > words.length) break
      const last = words[i + len - 1]
      if (isStop(last)) continue    // skip if last word is stopword
      // skip if too many stopwords in the middle (>50%)
      const slice = words.slice(i, i + len)
      const stopCount = slice.filter(isStop).length
      if (stopCount > Math.floor(len / 2)) continue

      const phrase = slice.join(' ')
      if (!phraseMap.has(phrase)) {
        phraseMap.set(phrase, { count: 0, segIdx: i })
      }
      phraseMap.get(phrase).count++
    }
  }

  return phraseMap
}

function findExampleSegment(transcript, phrase) {
  const target = phrase.toLowerCase()
  for (let i = 0; i < transcript.length; i++) {
    const text = (transcript[i].text || '').toLowerCase()
    if (text.includes(target.split(' ').slice(0, 2).join(' '))) {
      // Get 2-3 segments of context
      const ctx = transcript.slice(Math.max(0, i - 1), i + 3)
      return {
        start: transcript[i].start,
        text: ctx.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim(),
      }
    }
  }
  return null
}

// ── API helpers ────────────────────────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
  return res.json()
}

async function fetchVideoIds() {
  const ids = []
  let offset = 0
  while (true) {
    if (ids.length >= MAX_VIDEOS) break
    const data = await apiGet(`/api/vocab-stats?list=ngsl&limit=${PAGE_SIZE}&offset=${offset}`)
    const words = data.words || []
    // We need video IDs, not words. Use channels or a different approach.
    // Actually fetch video list from vocab-stats video_ids or fall back to a different endpoint.
    if (words.length === 0) break
    offset += PAGE_SIZE
    if (words.length < PAGE_SIZE) break
    await sleep(DELAY_MS)
  }
  return ids
}

async function fetchVideoList() {
  // Use the video-list approach: we need IDs of videos that have transcripts.
  // Since there's no public /api/videos endpoint, use video_vocab distinct video_ids
  // by querying word-examples for a very common word.
  const ids = new Set()
  // Piggyback on word-examples: "the" appears everywhere but is filtered — use "know"
  const commonWords = ['know','people','think','going','really','time','want','just','like','good']
  for (const word of commonWords) {
    try {
      const data = await apiGet(`/api/word-examples?word=${word}&list=ngsl&limit=5`)
      for (const ex of (data.examples || [])) {
        ids.add(ex.video_id)
      }
    } catch { /* skip */ }
  }
  return [...ids]
}

async function fetchTranscript(videoId) {
  const data = await apiGet(`/api/video/${videoId}`)
  return data?.video?.transcript || null
}

async function pushPhrases(phrases) {
  const res = await fetch(`${API_BASE}/api/admin/index-phrases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: BATCH_SECRET, phrases }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`API: ${API_BASE}`)
  console.log(`Config: min_videos=${MIN_VIDEOS}, top=${TOP_PHRASES}, dry=${DRY_RUN}`)

  // Step 1: get a list of video IDs with transcripts
  // We'll use word-examples to seed IDs, then crawl paginated video API
  // For each channel we can get video IDs from vocab-stats word hits
  console.log('\n[1/3] Discovering videos with transcripts...')

  // Seed from common words across multiple lists
  const videoIds = new Set()
  const seedWords = [
    'think','know','people','going','want','time','make','good','really',
    'just','like','get','one','look','way','come','right','say','see','work',
    'things','even','actually','great','yeah','feel','need','little','life',
    'back','give','never','first','lot','very','much','take','something','go',
  ]

  process.stdout.write('Discovering ')
  for (const word of seedWords) {
    try {
      const data = await apiGet(`/api/word-examples?word=${word}&list=ngsl&limit=5`)
      for (const ex of (data.examples || [])) videoIds.add(ex.video_id)
      process.stdout.write('.')
    } catch { process.stdout.write('x') }
    await sleep(100)
  }
  console.log(`\nFound ${videoIds.size} seed videos`)

  // Step 2: extract phrases from each video's transcript
  console.log('\n[2/3] Extracting phrases from transcripts...')

  // phrase → { videoSet, totalCount, example }
  const globalPhrases = new Map()
  let processed = 0
  let errors    = 0

  const idList = [...videoIds].slice(0, MAX_VIDEOS)

  // Process in batches of CONCURRENCY
  for (let i = 0; i < idList.length; i += CONCURRENCY) {
    const batch = idList.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (videoId) => {
      try {
        const transcript = await fetchTranscript(videoId)
        if (!Array.isArray(transcript) || transcript.length < 10) return

        const phraseMap = extractPhrases(transcript)

        for (const [phrase, { count }] of phraseMap) {
          if (!globalPhrases.has(phrase)) {
            const seg = findExampleSegment(transcript, phrase)
            globalPhrases.set(phrase, {
              videoSet: new Set(),
              totalCount: 0,
              example: seg ? { video_id: videoId, start: seg.start, text: seg.text } : null,
            })
          }
          const entry = globalPhrases.get(phrase)
          entry.videoSet.add(videoId)
          entry.totalCount += count
        }
        processed++
      } catch {
        errors++
      }
    }))
    process.stdout.write(`\r  Processed ${i + batch.length}/${idList.length} videos (${errors} errors)`)
    await sleep(DELAY_MS)
  }
  console.log()

  // Step 3: filter and rank
  console.log('\n[3/3] Ranking and storing top phrases...')

  const ranked = [...globalPhrases.entries()]
    .map(([phrase, { videoSet, totalCount, example }]) => ({
      phrase,
      video_count: videoSet.size,
      total_count: totalCount,
      example_video_id: example?.video_id || null,
      example_start: example?.start ?? null,
      example_text: example?.text || null,
    }))
    .filter(p => p.video_count >= MIN_VIDEOS)
    .sort((a, b) => b.video_count - a.video_count || b.total_count - a.total_count)
    .slice(0, TOP_PHRASES)

  console.log(`\nTop phrases found: ${ranked.length} (min ${MIN_VIDEOS} videos)`)
  console.log('Sample top 20:')
  ranked.slice(0, 20).forEach((p, i) => {
    console.log(`  ${i + 1}. "${p.phrase}" — ${p.video_count} videos`)
  })

  if (DRY_RUN) {
    console.log('\nDry run — not pushing to API.')
    return
  }

  // Push in batches
  let totalUpserted = 0
  for (let i = 0; i < ranked.length; i += PUSH_BATCH) {
    const batch = ranked.slice(i, i + PUSH_BATCH)
    try {
      const result = await pushPhrases(batch)
      totalUpserted += result.upserted || 0
      console.log(`  Pushed batch ${Math.floor(i / PUSH_BATCH) + 1}: ${result.upserted} upserted, ${result.errors} errors`)
    } catch (e) {
      console.error(`  Push failed: ${e.message}`)
    }
    await sleep(300)
  }

  console.log(`\n✓ Done: ${totalUpserted} phrases stored in D1`)
}

main().catch(e => { console.error(e); process.exit(1) })
