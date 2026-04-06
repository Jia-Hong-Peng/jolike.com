#!/usr/bin/env node
/**
 * scripts/batch-vocab-index.mjs
 *
 * Server-side batch vocabulary indexing for all videos with transcripts.
 * Replicates browser-side vocabScan.js + vocabLists.js logic in Node.js.
 *
 * Usage:
 *   API_BASE=https://jolike.com node scripts/batch-vocab-index.mjs [--limit N] [--channel UCxxxxx]
 *
 * Optional env vars:
 *   DELAY_MS   delay between videos in ms (default: 300)
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir   = join(__dirname, '../src/data')

// ── Parse args ────────────────────────────────────────────────────────────────

const args  = process.argv.slice(2)
const limitIdx   = args.indexOf('--limit')
const channelIdx = args.indexOf('--channel')
const LIMIT          = limitIdx   >= 0 ? parseInt(args[limitIdx + 1],   10) : 9999
const CHANNEL_FILTER = channelIdx >= 0 ? (args[channelIdx + 1] || '')       : ''
const API_BASE = (process.env.API_BASE || 'https://jolike.com').replace(/\/$/, '')
const DELAY_MS = parseInt(process.env.DELAY_MS || '300', 10)

// ── Load vocab data ────────────────────────────────────────────────────────────

const ngslDefs   = JSON.parse(readFileSync(join(dataDir, 'ngsl_defs.json'),   'utf8'))
const coca5000   = JSON.parse(readFileSync(join(dataDir, 'coca5000.json'),     'utf8'))
const cefrVocab  = JSON.parse(readFileSync(join(dataDir, 'cefr_vocab.json'),  'utf8'))
const oxford5000 = JSON.parse(readFileSync(join(dataDir, 'oxford5000.json'),  'utf8'))
const tslData    = JSON.parse(readFileSync(join(dataDir, 'tsl.json'),         'utf8'))
const bslData    = JSON.parse(readFileSync(join(dataDir, 'bsl.json'),         'utf8'))
const awlNawl    = JSON.parse(readFileSync(join(dataDir, 'awl_nawl.json'),    'utf8'))
const opalData   = JSON.parse(readFileSync(join(dataDir, 'opal_phrases.json'),'utf8'))

// Pre-build all word lists — matches vocabLists.js loadWordList() exactly
const WORD_LISTS = {
  ngsl:     Object.keys(ngslDefs),
  coca:     Object.keys(coca5000),
  cefr_a:   Object.entries(cefrVocab).filter(([, t]) => t === 1).map(([w]) => w),
  cefr_b1:  Object.entries(cefrVocab).filter(([, t]) => t === 2).map(([w]) => w),
  cefr_c1:  Object.entries(oxford5000).filter(([, v]) => v.level === 'C1').map(([w]) => w),
  toeic:    Object.keys(tslData),
  bsl:      Object.keys(bslData),
  ielts:    Object.entries(awlNawl).filter(([, v]) => v <= 7).map(([w]) => w),
  toefl:    Object.entries(awlNawl).filter(([, v]) => v <= 5).map(([w]) => w),
  academic: Object.entries(awlNawl).filter(([, v]) => v <= 10).map(([w]) => w),
  advanced: Object.entries(awlNawl).filter(([, v]) => v >= 11).map(([w]) => w),
  opal:     Array.isArray(opalData) ? opalData : Object.keys(opalData),
}

// Pre-build lookup sets for canonicalForm
const cefrMap = cefrVocab           // { word: tier }
const awlSet  = new Set(Object.keys(coca5000).map(w => w.toLowerCase()))

// ── Morphological helpers (ported from lookup.js) ─────────────────────────────

function morphStems(w) {
  const stems = []
  if (w.endsWith('ing') && w.length > 5) {
    stems.push(w.slice(0, -3))
    stems.push(w.slice(0, -3) + 'e')
    stems.push(w.slice(0, -4))
  }
  if (w.endsWith('er') && w.length > 4) {
    const base = w.slice(0, -2)
    stems.push(base)
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2])
      stems.push(base.slice(0, -1))
  }
  if (w.endsWith('est') && w.length > 5) {
    const base = w.slice(0, -3)
    stems.push(base)
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2])
      stems.push(base.slice(0, -1))
  }
  if (w.endsWith('ened') && w.length > 6) stems.push(w.slice(0, -4))
  if (w.endsWith('ed') && w.length > 4) {
    const base2 = w.slice(0, -2)
    stems.push(base2)
    stems.push(base2 + 'e')
    if (base2.length >= 3 && base2[base2.length - 1] === base2[base2.length - 2])
      stems.push(base2.slice(0, -1))
  }
  if (w.endsWith('eth') && w.length > 5) stems.push(w.slice(0, -3))
  if (w.endsWith('ly') && w.length > 4)  stems.push(w.slice(0, -2))
  if (w.endsWith('tion') && w.length > 6) stems.push(w.slice(0, -3))
  if (w.endsWith('ness') && w.length > 6) stems.push(w.slice(0, -4))
  if (w.endsWith('ment') && w.length > 6) stems.push(w.slice(0, -4))
  if (w.endsWith('ity') && w.length > 6)  stems.push(w.slice(0, -3))
  if (w.endsWith('ical') && w.length > 6) stems.push(w.slice(0, -4))
  if (w.endsWith('s') && w.length > 4 && !w.endsWith('ss')) {
    stems.push(w.slice(0, -1))
    stems.push(w.slice(0, -2))
  }
  return stems
}

function canonicalForm(word) {
  const w = word.toLowerCase()
  if (cefrMap[w] !== undefined || awlSet.has(w)) return w
  const candidates = morphStems(w)
  let best = null
  for (const c of candidates) {
    if (c.length < 2) continue
    if ((cefrMap[c] !== undefined || awlSet.has(c)) && (best === null || c.length < best.length))
      best = c
  }
  if (best !== null) return best
  if (w.endsWith('ed') && w.length > 4) {
    const plain = w.slice(0, -2)
    if (plain.length >= 3) {
      if (plain[plain.length - 1] === plain[plain.length - 2]) return plain.slice(0, -1)
      return plain
    }
  }
  if (w.endsWith('ing') && w.length > 4) {
    const plain = w.slice(0, -3)
    if (plain.length >= 2) {
      if (plain.length >= 3 && plain[plain.length - 1] === plain[plain.length - 2])
        return plain.slice(0, -1)
      return plain + 'e'
    }
  }
  return w
}

// ── vocabScan (ported from vocabScan.js) ──────────────────────────────────────

function buildTranscriptForms(transcript) {
  const allText = transcript.map(s => s.text).join(' ')
  const tokens  = allText.toLowerCase().match(/[a-z]+/g) || []
  const forms   = new Set()
  for (const token of tokens) {
    if (token.length < 2) continue
    forms.add(token)
    forms.add(canonicalForm(token))
    for (const stem of morphStems(token)) forms.add(stem)
  }
  return forms
}

function scanTranscriptVocab(transcript) {
  const transcriptForms = buildTranscriptForms(transcript)
  const vocab = {}
  for (const [listId, wordList] of Object.entries(WORD_LISTS)) {
    const matched = wordList.filter(w => {
      const lw = w.toLowerCase()
      return transcriptForms.has(lw) || transcriptForms.has(canonicalForm(lw))
    })
    if (matched.length > 0) vocab[listId] = matched
  }
  return vocab
}

// ── API helpers ───────────────────────────────────────────────────────────────

const HEADERS = { 'Accept': 'application/json', 'Content-Type': 'application/json' }

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  return res.status
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ──────────────────────────────────────────────────────────────────────

async function getVideosWithTranscript(channelId) {
  const PAGE_SIZE = 200
  const results   = []
  let offset      = 0
  while (true) {
    const data = await apiGet(`/api/channels/${channelId}?limit=${PAGE_SIZE}&offset=${offset}`)
    const videos = data.videos ?? []
    for (const v of videos) {
      if (v.hasTranscript) results.push(v)
    }
    if (videos.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return results
}

async function main() {
  console.log(`API: ${API_BASE}`)
  console.log(`Loading vocab lists... ${Object.entries(WORD_LISTS).map(([k, v]) => `${k}:${v.length}`).join(', ')}`)

  const { channels } = await apiGet('/api/channels')
  const targets = CHANNEL_FILTER
    ? channels.filter(c => c.id === CHANNEL_FILTER || c.handle === CHANNEL_FILTER)
    : channels

  if (targets.length === 0) {
    console.error('No channels found')
    process.exit(1)
  }

  let totalIndexed = 0
  let totalSkipped = 0
  let totalErrors  = 0
  let processed    = 0

  for (const channel of targets) {
    console.log(`\n📺 ${channel.name} (${channel.id})`)
    const videos = await getVideosWithTranscript(channel.id)
    console.log(`   ${videos.length} videos with transcripts`)
    if (videos.length === 0) continue

    let channelOk = 0, channelErr = 0

    for (const v of videos) {
      if (processed >= LIMIT) break

      process.stdout.write(`   [${++processed}] ${v.id} | ${(v.title || '').slice(0, 45)} ... `)

      let transcript
      try {
        const data = await apiGet(`/api/video/${v.id}`)
        transcript = data.transcript
      } catch (e) {
        process.stdout.write(`fetch err: ${e.message}\n`)
        channelErr++
        totalErrors++
        await sleep(DELAY_MS)
        continue
      }

      if (!transcript || transcript.length === 0) {
        process.stdout.write('no transcript\n')
        totalSkipped++
        await sleep(DELAY_MS)
        continue
      }

      const vocab = scanTranscriptVocab(transcript)
      const listCount = Object.keys(vocab).length
      const wordCount = Object.values(vocab).reduce((s, w) => s + w.length, 0)

      const status = await apiPost('/api/video-vocab', { video_id: v.id, vocab })
      if (status === 200 || status === 201) {
        process.stdout.write(`ok (${listCount} lists, ${wordCount} words)\n`)
        channelOk++
        totalIndexed++
      } else {
        process.stdout.write(`save failed (${status})\n`)
        channelErr++
        totalErrors++
      }

      await sleep(DELAY_MS)
    }

    console.log(`   ✓ channel done: ${channelOk} indexed, ${channelErr} errors`)
    if (processed >= LIMIT) break
  }

  console.log(`\n✅ Done: ${totalIndexed} indexed, ${totalSkipped} skipped, ${totalErrors} errors`)
}

main().catch(err => { console.error(err); process.exit(1) })
