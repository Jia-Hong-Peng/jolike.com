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
 *   intermediate — tier 3+ (B2 academic/professional; fallback to tier 2 if sparse)
 *   advanced     — tier 4+ (C1+ rare/specialized only; fallback to tier 3 → 2 if sparse)
 *
 * Academic word priority (research-backed):
 *   AWL Sublist 1-10: Academic Word List (Coxhead 2000) — B2 minimum, scored by sublist rank
 *   NAWL (sublist 11): New Academic Word List (Browne et al. 2013) — modern academic vocab
 *   Coverage: BNC/COCA K1-K3 + AWL = 95% of IELTS text (SAGE Open 2022)
 *             NGSL + TSL = 98.5% of TOEIC (Browne & Culligan 2021)
 */

import nlp from 'compromise'
import awlWords from '@/data/coca5000.json'       // business vocab fallback (kept for B2 tier)
import awlNawlData from '@/data/awl_nawl.json'    // AWL 1-10 + NAWL(11) + TSL(12), 2336 entries
import ngslDefs from '@/data/ngsl_defs.json'      // NGSL+TSL easy English definitions, 4054 words
import opalPhrasesData from '@/data/opal_phrases.json' // Oxford OPAL academic phrases, 572 entries
import cedict from '@/data/cedict.json'
import cefrVocab from '@/data/cefr_vocab.json'    // CEFR A1-C2 (8818 words, Open Language Profiles)

// Primary: CEFR-J + Octanove vocabulary profile (Open Language Profiles project)
// { word: tier } where 1=A1/A2, 2=B1, 3=B2, 4=C1/C2
const cefrMap = cefrVocab

// Academic word map: word → sublist number
//   1-10 = AWL sublist (1 = most frequent/important academic, 10 = least)
//   11   = NAWL (New Academic Word List — modern academic corpus, 288M words)
//   12   = TSL  (TOEIC Service List — business/commercial English)
// Research: AWL Sublist 1 gives ~2% IELTS reading coverage per sublist
//           NGSL + TSL = 98.5% TOEIC coverage (Browne & Culligan 2021)
const awlNawlMap = awlNawlData   // { word: sublist_num }

// NGSL + TSL easy English definitions: { word: "simple definition" }
// Source: NGSL 1.2 (2809 words) + TSL 1.2 (1245 TOEIC-only words)
const ngslDefMap = ngslDefs

// OPAL academic phrases: Set of Oxford Phrasal Academic Lexicon entries
// 572 academic collocations: "as a result", "in terms of", "based on", etc.
const opalPhraseSet = new Set(opalPhrasesData)

// Legacy business vocab fallback (kept for coverage of TOEIC/business terms)
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
  // Archaic / Shakespearean forms — irregular and not worth teaching
  'hath','doth','doeth','hast','wast','art','shalt','wilt','thy','thee','thou',
  // Apostrophe-free contractions (YouTube auto-captions omit apostrophes,
  // so "wasn't" → "wasnt". POS tagging fails on these, causing them to score
  // as tier-4 "unknown specialized" words — a false positive we must block.)
  'wasnt','wasnt','werent','isnt','arent','doesnt','didnt','dont','wont','cant',
  'couldnt','wouldnt','shouldnt','mustnt','neednt','oughtnt',
  'havent','hasnt','hadnt',
  'youre','theyre','hes','shes','thats','whats','whos','weve','theyve',
  'ive','hed','shed','theyd','youd','hell','shell','theyll','youll',
])


// ── Morphological stem generation ─────────────────────────────────────────────
// Returns candidate base forms for an inflected word (ordered: most likely first)
function morphStems(w) {
  const stems = []
  if (w.endsWith('ing') && w.length > 5) {
    stems.push(w.slice(0, -3))           // cooling    → cool
    stems.push(w.slice(0, -3) + 'e')    // using      → use, chaperoning → chaperone
    stems.push(w.slice(0, -4))           // running    → run (double consonant)
  }
  if (w.endsWith('er') && w.length > 4) {
    const base = w.slice(0, -2)
    stems.push(base)                     // cheaper    → cheap
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      stems.push(base.slice(0, -1))      // bigger     → big (double consonant)
    }
  }
  if (w.endsWith('est') && w.length > 5) {
    const base = w.slice(0, -3)
    stems.push(base)                     // cheapest   → cheap
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      stems.push(base.slice(0, -1))      // biggest    → big (double consonant)
    }
  }
  if (w.endsWith('ened') && w.length > 6) stems.push(w.slice(0, -4))  // softened → soft, darkened → dark
  if (w.endsWith('ed') && w.length > 4) {
    const base2 = w.slice(0, -2)
    stems.push(base2)                    // started    → start, softened → soften
    stems.push(base2 + 'e')             // moved      → move  (base2 = 'mov' + 'e')
    // Double consonant only: stopped → stopp → stop (only when last two of base are same)
    if (base2.length >= 3 && base2[base2.length - 1] === base2[base2.length - 2]) {
      stems.push(base2.slice(0, -1))    // stopped    → stop
    }
  }
  if (w.endsWith('eth') && w.length > 5) stems.push(w.slice(0, -3))  // raineth → rain (archaic 3rd-person singular)
  if (w.endsWith('ly') && w.length > 4) stems.push(w.slice(0, -2))   // quickly → quick
  if (w.endsWith('tion') && w.length > 6) stems.push(w.slice(0, -3)) // reduction → reduc
  if (w.endsWith('ness') && w.length > 6) stems.push(w.slice(0, -4)) // darkness → dark
  if (w.endsWith('ment') && w.length > 6) stems.push(w.slice(0, -4)) // movement → move
  if (w.endsWith('ity') && w.length > 6) stems.push(w.slice(0, -3))  // ability → abil
  if (w.endsWith('ical') && w.length > 6) stems.push(w.slice(0, -4)) // historical → histor
  if (w.endsWith('s') && w.length > 4 && !w.endsWith('ss')) {
    stems.push(w.slice(0, -1))           // cars → car
    stems.push(w.slice(0, -2))           // houses → hous (rough)
  }
  return stems
}

// ── Canonical (lemma) form ─────────────────────────────────────────────────────
// Returns the base/dictionary form of a word for display and lookup.
// e.g. chaperoning → chaperone, biggest → big, running → run
//
// Strategy: among the word itself and all its morphological stems, pick the
// SHORTEST one that appears in a vocabulary list. cefr_vocab includes inflected
// forms (e.g. "running" is listed alongside "run"), so "already in vocab" does
// not mean "base form" — we must prefer the shorter vocab entry.
function canonicalForm(word) {
  const w = word.toLowerCase()

  // Collect all candidates: original + morphological stems
  const candidates = [w, ...morphStems(w)]

  // Pick the shortest candidate that is attested in any vocabulary list
  let best = null
  for (const c of candidates) {
    if (c.length < 2) continue
    const inVocab = cefrMap[c] !== undefined || awlSet.has(c)
    if (inVocab && (best === null || c.length < best.length)) best = c
  }
  if (best !== null) return best

  // Heuristic for unknown -ed words (soften not in vocab, but soften is the clear base)
  if (w.endsWith('ed') && w.length > 4) {
    const plain = w.slice(0, -2)         // softened → soften, started → start
    if (plain.length >= 3) {
      // Double consonant: stopped → stopp → stop
      if (plain[plain.length - 1] === plain[plain.length - 2]) return plain.slice(0, -1)
      return plain
    }
  }

  // Heuristic for unknown -ing words (base form not in any vocab list)
  // chaperoning → chaperone, running → run
  if (w.endsWith('ing') && w.length > 4) {
    const plain = w.slice(0, -3)
    if (plain.length >= 2) {
      // Double consonant: running → runn → run
      if (plain.length >= 3 && plain[plain.length - 1] === plain[plain.length - 2]) {
        return plain.slice(0, -1)
      }
      // +e form: chaperoning → chaperone
      return plain + 'e'
    }
  }

  return w  // unknown word with no matching stem — keep as-is
}

// ── Academic word lookup ───────────────────────────────────────────────────────
// Returns AWL sublist (1-10) or 11 for NAWL, or 0 if not academic
function awlSublist(word) {
  const w = word.toLowerCase()
  if (awlNawlMap[w] !== undefined) return awlNawlMap[w]
  for (const stem of morphStems(w)) {
    if (awlNawlMap[stem] !== undefined) return awlNawlMap[stem]
  }
  return 0
}

// ── Difficulty tier lookup (CEFR-based with morphological stem fallback) ──────
// Returns 1=A1/A2, 2=B1, 3=B2, 4=C1/C2
//
// Academic word override (research-backed):
//   AWL (sublist 1-10) and NAWL words are academically significant for IELTS/TOEFL.
//   Research shows AWL covers ~10% of academic texts (Coxhead 2000).
//   These words receive a minimum tier of 3 (B2) so they always surface
//   at intermediate level, even if CEFR frequency marks them as B1.
function wordDifficultyTier(word) {
  const w = word.toLowerCase()

  // Direct lookup in CEFR vocabulary
  let tier = cefrMap[w]

  // Morphological stem fallback — find lowest (easiest) tier among all stems
  if (tier === undefined) {
    for (const stem of morphStems(w)) {
      const t = cefrMap[stem]
      if (t !== undefined && (tier === undefined || t < tier)) tier = t
    }
  }

  // Academic word override: AWL/NAWL/TSL words are at least B2 (tier 3)
  // This ensures important IELTS/TOEFL/TOEIC vocabulary is never hidden at intermediate level.
  // Note: tier 4 (C1+) is preserved — we only bump UP, never down.
  const sublist = awlSublist(w)
  if (sublist > 0) {
    if (tier !== undefined) return Math.max(tier, 3)
    return 3
  }

  if (tier !== undefined) return tier

  // Business/general high-freq fallback (legacy coca5000 list)
  if (awlSet.has(w)) return 3
  for (const stem of morphStems(w)) {
    if (awlSet.has(stem)) return 3
  }
  return 4 // C1+ specialized / unknown
}

// Minimum tier required for this level
function minTierForLevel(level) {
  if (level === 'advanced')     return 4  // C1+ only (rare/specialized); fallback to 3 if sparse
  if (level === 'intermediate') return 3  // B2+ (academic/professional vocab)
  return 1                               // beginner: any tier
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

  // Priority bonus by source list (research-backed):
  //   AWL Sublist 1 → +4.0pts (highest IELTS coverage, ~2% per sublist)
  //   AWL Sublist 10 → +0.4pts
  //   NAWL (11) → +0.5pts (modern academic: methodology, trajectory)
  //   TSL (12) → +1.0pts (TOEIC business: quarterly, negotiate, invoice)
  const sub = awlSublist(word)
  const awlBoost = sub >= 1 && sub <= 10
    ? (11 - sub) * 0.4   // AWL: S1=4.0, S5=2.4, S10=0.4
    : sub === 11
      ? 0.5              // NAWL: modern academic vocab
      : sub === 12
        ? 1.0            // TSL: TOEIC commercial/business vocab
        : 0

  // Tier is the primary signal (scale 10–40). Frequency + POS + cedict + academic lists are secondary.
  return tier * 10 + Math.log1p(freq) * posMult * cedictBoost + awlBoost
}

export function lookupMeaning(keyword) {
  const key = keyword.toLowerCase()
  return cedict[key] || cedict[key.replace(/-/g, ' ')] || ''
}

// NGSL/TSL easy English definition — used as fallback when Free Dictionary API
// definition is unavailable. Returns empty string if not in NGSL/TSL.
export function lookupNgslDef(keyword) {
  const key = keyword.toLowerCase()
  return ngslDefMap[key] || ngslDefMap[key.replace(/-/g, ' ')] || ''
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
    // Normalize to canonical (lemma) form so card shows "chaperone" not "chaperoning"
    const canonical = canonicalForm(word)
    if (seenKeywords.has(canonical)) continue  // deduplicate variants (run/running → both "run")
    seenKeywords.add(canonical)
    const seg = pickBestSeg(word, wordAllSegs.get(word))
    const wordTier = wordDifficultyTier(word)
    const wordAwlSub = awlSublist(canonical !== word ? canonical : word)
    words.push({
      type: 'word',
      keyword: word,                               // inflected form as heard in the video
      lemma: canonical !== word ? canonical : undefined,  // base/dictionary form (shown as supplementary)
      meaning_zh: lookupMeaning(canonical),        // cedict/MyMemory lookup using base form
      frequency: freq,
      difficulty_tier: wordTier,
      awl_sublist: wordAwlSub > 0 ? wordAwlSub : undefined,  // 1-10=AWL sublist, 11=NAWL, undefined=none
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

  // OPAL (Oxford Phrasal Academic Lexicon) boost: +3pts for recognized academic collocations
  // "as a result", "in terms of", "based on" etc. are high-value for IELTS/TOEFL writing.
  function phraseScore(phrase, freq) {
    return learningScore(phrase, freq) + (opalPhraseSet.has(phrase) ? 3.0 : 0)
  }

  const rankedPhrases = [...phraseFreq.entries()]
    // Only keep phrases where at least one word is B1+ (tier ≥ 2) — filters noise
    .filter(([phrase]) => phrase.split(' ').some(w => wordDifficultyTier(w) >= 2))
    .sort((a, b) => phraseScore(b[0], b[1]) - phraseScore(a[0], a[1]))

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
      // ID uses lemma (canonical form) so "run" and "running" share the same SRS entry
      id: `${videoId}_${(item.lemma || item.keyword).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
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
