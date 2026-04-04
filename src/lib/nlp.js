/**
 * NLP analysis — runs entirely in the browser.
 *
 * Word difficulty is determined by tier classification:
 *   Tier 1 (A1/A2): basic vocabulary any intermediate+ learner knows
 *                   → penalized ×0.08, filtered at intermediate/advanced
 *   Tier 2 (B1):    everyday vocabulary, learnable at intermediate level
 *                   → neutral ×0.7, filtered at advanced
 *   Tier 3 (B2):    Academic/professional vocabulary (AWL + business)
 *                   → boosted ×1.6, shown at all levels
 *   Tier 4 (C1+):   Specialized/rare — unknown to most learners
 *                   → highly boosted ×2.5, always shown
 *
 * Levels:
 *   beginner     — tier 1+ (all content words, min 3 chars)
 *   intermediate — tier 2+ (filter out A1/A2 basics)
 *   advanced     — tier 3+ (academic & specialized only; fallback to tier 2 if sparse)
 */

import nlp from 'compromise'
import awlWords from '@/data/coca5000.json'   // AWL + business vocab = B2 tier fallback
import cedict from '@/data/cedict.json'
import cefrVocab from '@/data/cefr_vocab.json'  // CEFR A1-C2 (8818 words, Open Language Profiles)

// Primary: CEFR-J + Octanove vocabulary profile (Open Language Profiles project)
// { word: tier } where 1=A1/A2, 2=B1, 3=B2, 4=C1/C2
const cefrMap = cefrVocab

// Fallback: AWL (Academic Word List + business vocab) — maps to B2 tier
const awlSet = new Set(awlWords.map(w => w.toLowerCase()))

const MAX_WORDS   = 8   // quality over quantity — fewer high-value cards beats many mediocre ones
const MAX_PHRASES = 5
const CLIP_MIN_S  = 3
const MIN_WORDS_BEFORE_FALLBACK = 5  // if fewer words pass tier, drop tier by 1

// ── Always-excluded function words (POS tagging misses) ───────────────────────
const STOPS_ALWAYS = new Set([
  'have','been','were','will','would','could','should','might','must','shall',
  'being','having','said','says','going','gonna','gotta','wanna','kinda',
  'yeah','okay','well','like','just','also','even','still','really','already',
  'actually','very','quite','rather','much','many','most','some','more','less',
  'here','there','then','when','where','how','why','what','which',
])


// ── Difficulty tier lookup (CEFR-based with morphological stem fallback) ──────
// Returns 1=A1/A2, 2=B1, 3=B2, 4=C1/C2
function wordDifficultyTier(word) {
  const w = word.toLowerCase()

  // Direct lookup in CEFR vocabulary
  if (cefrMap[w] !== undefined) return cefrMap[w]

  // Morphological stem fallback — handles inflected forms not in the CEFR list
  const stems = new Set()
  if (w.endsWith('ing') && w.length > 5) {
    stems.add(w.slice(0, -3))          // cooling  → cool
    stems.add(w.slice(0, -3) + 'e')   // using    → use
    stems.add(w.slice(0, -4))          // running  → run (double consonant)
  }
  if (w.endsWith('er') && w.length > 4) stems.add(w.slice(0, -2))   // cheaper → cheap
  if (w.endsWith('est') && w.length > 5) stems.add(w.slice(0, -3))  // cheapest → cheap
  if (w.endsWith('ed') && w.length > 4) {
    stems.add(w.slice(0, -2))          // started → start
    stems.add(w.slice(0, -1))          // moved   → move
    stems.add(w.slice(0, -3))          // stopped → stop (double)
  }
  if (w.endsWith('ly') && w.length > 4) stems.add(w.slice(0, -2))   // quickly → quick
  if (w.endsWith('tion') && w.length > 6) stems.add(w.slice(0, -3)) // reduction → reduc
  if (w.endsWith('ness') && w.length > 6) stems.add(w.slice(0, -4)) // darkness → dark
  if (w.endsWith('ment') && w.length > 6) stems.add(w.slice(0, -4)) // movement → move
  if (w.endsWith('ity') && w.length > 6) stems.add(w.slice(0, -3))  // ability → abil
  if (w.endsWith('ical') && w.length > 6) stems.add(w.slice(0, -4)) // historical → histor
  if (w.endsWith('s') && w.length > 4 && !w.endsWith('ss')) {
    stems.add(w.slice(0, -1))          // cars → car
    stems.add(w.slice(0, -2))          // houses → hous (rough)
  }

  let bestTier = null
  for (const stem of stems) {
    const t = cefrMap[stem]
    if (t !== undefined && (bestTier === null || t < bestTier)) bestTier = t
  }
  if (bestTier !== null) return bestTier

  // Final fallback: AWL = B2 tier, unknown = C1+ (tier 4)
  if (awlSet.has(w)) return 3
  for (const stem of stems) {
    if (awlSet.has(stem)) return 3
  }
  return 4 // C1+ specialized / unknown
}

// Minimum tier required for this level
function minTierForLevel(level) {
  if (level === 'advanced') return 3     // B2+ (AWL + specialized)
  if (level === 'intermediate') return 3  // B2+ (academic/professional)
  return 1                               // Any tier
}

function minLength(level) {
  if (level === 'advanced') return 5
  if (level === 'intermediate') return 4
  return 3
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function learningScore(word, freq, posMult = 1.0) {
  const tier = wordDifficultyTier(word)
  const cedictBoost = cedict[word] ? 1.2 : 1.0
  // Tier is the primary signal (scale 0–40). Frequency + POS + cedict are secondary.
  return tier * 10 + Math.log1p(freq) * posMult * cedictBoost
}

export function lookupMeaning(keyword) {
  const key = keyword.toLowerCase()
  return cedict[key] || cedict[key.replace(/-/g, ' ')] || ''
}

function getClip(segment) {
  const clip_start = Math.max(0, segment.start - 0.5)
  const segEnd     = segment.start + Math.max(segment.dur, CLIP_MIN_S)
  const clip_end   = segEnd + 1.5
  return { clip_start: +clip_start.toFixed(2), clip_end: +clip_end.toFixed(2) }
}

// ── Main ───────────────────────────────────────────────────────────────────────

/**
 * @param {Array<{text,start,dur}>} transcript
 * @param {string} videoId
 * @param {'beginner'|'intermediate'|'advanced'} level
 */
export function extractLearningItems(transcript, videoId, level = 'intermediate', knownWords = new Set()) {
  const minLen  = minLength(level)
  let   minTier = minTierForLevel(level)

  // ── Step 1: Extract and score words ──────────────────────────────────────────
  const wordFreq    = new Map()
  const wordAllSegs = new Map()  // word → all segments where it appears

  // Pre-compute POS sets across all segments (verbs/adjectives get 1.5× boost)
  const verbSet = new Set()
  const adjSet  = new Set()

  for (const segment of transcript) {
    if (!segment.text) continue
    const doc = nlp(segment.text)
    doc.verbs().not('#Auxiliary').out('array')
      .forEach(v => verbSet.add(v.replace(/[^a-zA-Z]/g, '').toLowerCase()))
    doc.adjectives().out('array')
      .forEach(a => adjSet.add(a.replace(/[^a-zA-Z]/g, '').toLowerCase()))
    const tokens = [
      ...doc.nouns().not('#Pronoun').not('#ProperNoun').out('array'),
      ...doc.adjectives().out('array'),
      ...doc.verbs().not('#Auxiliary').out('array'),
    ]
    for (const token of tokens) {
      if (token.trim().includes(' ')) continue  // multi-word → phrase extraction
      const w = token.replace(/[^a-zA-Z]/g, '').toLowerCase()
      if (w.length < minLen) continue
      if (STOPS_ALWAYS.has(w)) continue
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1)
      if (!wordAllSegs.has(w)) wordAllSegs.set(w, [])
      wordAllSegs.get(w).push(segment)
    }
  }

  function posMultiplier(word) {
    return (verbSet.has(word) || adjSet.has(word)) ? 1.5 : 1.0
  }

  // Pick the best segment for a word: prefer complete sentences (≥5 words)
  // where the word appears in the middle, choosing the shortest qualifying segment.
  function pickBestSeg(word, segs) {
    const complete = segs.filter(s => s.text.split(' ').length >= 5)
    const pool = complete.length > 0 ? complete : segs
    // Prefer segments where word is not the very first or last token
    const notEdge = pool.filter(s => {
      const words = s.text.toLowerCase().split(/\s+/)
      const idx = words.findIndex(t => t.replace(/[^a-z]/g, '') === word)
      return idx > 0 && idx < words.length - 1
    })
    const candidates = notEdge.length > 0 ? notEdge : pool
    // Shortest among candidates = clearest context
    return candidates.reduce((best, s) => s.text.length < best.text.length ? s : best)
  }

  // Tier-filtered ranking — knownWords filter happens here so fallback accounts for it
  function rankWords(tierThreshold) {
    return [...wordFreq.entries()]
      .filter(([w]) => wordDifficultyTier(w) >= tierThreshold)
      .filter(([w]) => !knownWords.has(w))
      .sort((a, b) => learningScore(b[0], b[1], posMultiplier(b[0]))
                    - learningScore(a[0], a[1], posMultiplier(a[0])))
  }

  // Adaptive tier fallback: if too sparse, lower threshold by 1
  let rankedWords = rankWords(minTier)
  if (rankedWords.length < MIN_WORDS_BEFORE_FALLBACK && minTier > 1) {
    minTier -= 1
    rankedWords = rankWords(minTier)
  }

  const seenKeywords = new Set()
  const words = []
  for (const [word, freq] of rankedWords) {
    if (words.length >= MAX_WORDS) break
    if (seenKeywords.has(word)) continue
    seenKeywords.add(word)
    const seg = pickBestSeg(word, wordAllSegs.get(word))
    words.push({
      type: 'word',
      keyword: word,
      meaning_zh: lookupMeaning(word),
      frequency: freq,
      difficulty_tier: wordDifficultyTier(word),
      sentence: seg.text,
      ...getClip(seg),
    })
  }

  // ── Step 2: Phrases — phrasal verbs + compound nouns ─────────────────────────
  const PARTICLES = 'up|out|off|in|on|down|back|away|over|through|into|around|along|ahead|apart|together|forward'
  const DETERMINERS = /^(the|a|an|this|that|these|those|my|your|his|her|its|our|their|some|any|each|every)\s/i

  const phraseFreq     = new Map()
  const phraseFirstSeg = new Map()

  function addPhrase(phrase, segment) {
    const key = phrase.toLowerCase().trim()
    if (!key || key.split(' ').length < 2) return
    phraseFreq.set(key, (phraseFreq.get(key) || 0) + 1)
    if (!phraseFirstSeg.has(key)) phraseFirstSeg.set(key, segment)
  }

  for (const segment of transcript) {
    if (!segment.text) continue

    // Phrasal verbs via regex
    const phrasalMatches = segment.text.matchAll(
      new RegExp(`\\b([a-zA-Z]{3,})\\s+(${PARTICLES})\\b`, 'gi')
    )
    for (const m of phrasalMatches) addPhrase(m[0], segment)

    // Compound nouns — no determiners, no proper noun phrases (person/place names)
    const nounPhrases = nlp(segment.text).nouns().out('array')
    for (const np of nounPhrases) {
      const clean = np.replace(/[^a-zA-Z ]/g, '').trim()
      if (DETERMINERS.test(clean)) continue
      if (clean.split(' ').length < 2) continue
      // Skip proper noun phrases: all words are title-case (e.g. "Hayes Campbell", "New York")
      if (clean.split(' ').every(w => w.length > 0 && /^[A-Z]/.test(w))) continue
      addPhrase(clean, segment)
    }
  }

  const rankedPhrases = [...phraseFreq.entries()]
    // Only keep phrases where at least one word is B1+ (tier ≥ 2) — filters noise
    .filter(([phrase]) => phrase.split(' ').some(w => wordDifficultyTier(w) >= 2))
    .sort((a, b) => learningScore(b[0], b[1]) - learningScore(a[0], a[1]))

  const phrases = []
  for (const [phrase, freq] of rankedPhrases) {
    if (phrases.length >= MAX_PHRASES) break
    if (seenKeywords.has(phrase)) continue
    seenKeywords.add(phrase)
    const seg = phraseFirstSeg.get(phrase)
    phrases.push({
      type: 'phrase',
      keyword: phrase,
      meaning_zh: lookupMeaning(phrase),
      frequency: freq,
      difficulty_tier: Math.max(1, ...phrase.split(' ').map(w => wordDifficultyTier(w))),
      sentence: seg.text,
      ...getClip(seg),
    })
  }

  // ── Step 3: Merge, sort, assign IDs ──────────────────────────────────────────
  return [...words, ...phrases]
    .sort((a, b) =>
      learningScore(b.keyword, b.frequency, posMultiplier(b.keyword)) -
      learningScore(a.keyword, a.frequency, posMultiplier(a.keyword)))
    .map((item, index) => ({
      id: `${videoId}_${item.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
      video_id: videoId,
      sort_order: index,
      level,
      ...item,
    }))
}

/**
 * Extract learnable words from a single subtitle segment (shadowing mode).
 * Returns SRS-ready card objects for any B1+ (tier ≥ 2) content words found.
 *
 * @param {{ text: string, start: number, dur: number }} segment
 * @param {string} videoId
 * @returns {Array<Object>}
 */
export function extractWordsFromSegment(segment, videoId) {
  if (!segment?.text) return []

  const doc = nlp(segment.text)
  const tokens = [
    ...doc.nouns().not('#Pronoun').not('#ProperNoun').out('array'),
    ...doc.adjectives().out('array'),
    ...doc.verbs().not('#Auxiliary').out('array'),
  ]

  const seen = new Set()
  const cards = []

  for (const token of tokens) {
    if (token.trim().includes(' ')) continue
    const w = token.replace(/[^a-zA-Z]/g, '').toLowerCase()
    if (!w || w.length < 3 || seen.has(w)) continue
    if (STOPS_ALWAYS.has(w)) continue
    seen.add(w)

    const tier = wordDifficultyTier(w)
    if (tier < 2) continue  // skip A1/A2 basics

    const clip_start = Math.max(0, segment.start - 0.5)
    const clip_end   = segment.start + Math.max(segment.dur, CLIP_MIN_S) + 1.5

    cards.push({
      id:              `${videoId}_${w}`,
      video_id:        videoId,
      type:            'word',
      keyword:         w,
      meaning_zh:      lookupMeaning(w),
      frequency:       1,
      difficulty_tier: tier,
      sentence:        segment.text,
      clip_start:      +clip_start.toFixed(2),
      clip_end:        +clip_end.toFixed(2),
      sort_order:      0,
      level:           'intermediate',
    })
  }

  // Sort: hardest first (most worth learning)
  return cards.sort((a, b) => b.difficulty_tier - a.difficulty_tier)
}
