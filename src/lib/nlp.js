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
import opalPhrasesData from '@/data/opal_phrases.json' // Oxford OPAL academic phrases, 572 entries

// Pure lookup functions shared with lookup.js (no compromise.js dependency)
// lookup.js imports the data directly; nlp.js re-uses the same implementations.
export { morphStems, canonicalForm, awlSublist, wordDifficultyTier, lookupMeaning } from '@/lib/lookup.js'
export { lookupNgslDef } from '@/lib/ngsl.js'
import { canonicalForm, awlSublist, wordDifficultyTier, lookupMeaning, getVocabCategories, isKnownVocab } from '@/lib/lookup.js'

// OPAL academic phrases: Set of Oxford Phrasal Academic Lexicon entries
// 572 academic collocations: "as a result", "in terms of", "based on", etc.
const opalPhraseSet = new Set(opalPhrasesData)

// No hard cap on words/phrases — extract everything that passes the quality filter.
// The level + tier threshold + knownWords filter determine what appears.
// Sorted by learningScore so highest-value vocab-list words always come first.
const CLIP_MIN_S  = 3
const MIN_WORDS_BEFORE_FALLBACK = 8  // if fewer words pass tier, drop tier by 1

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

// Tier range per level:
//   advanced:     tier 4     (C1+ rare/specialized only)
//   intermediate: tier 3-4   (B2+ academic/professional)
//   beginner:     tier 1-2   (A1/A2/B1 only — exclude B2+ academic to avoid overload)
function tierRangeForLevel(level) {
  if (level === 'advanced')     return { min: 4, max: 4 }
  if (level === 'intermediate') return { min: 3, max: 4 }
  return { min: 1, max: 2 }
}

function minLength(level) {
  if (level === 'advanced') return 5
  if (level === 'intermediate') return 4
  return 3
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Score a candidate word for learning priority.
 *
 * PRIMARY signal: membership in our curated vocab lists.
 *   Words in AWL/NAWL/TSL/CEFR/COCA are what we actually teach.
 *   Unknown domain jargon (tier 4 with no list membership) is a last resort.
 *
 * SECONDARY signal: tier (difficulty), frequency, POS, cedict.
 *
 * Scale reference:
 *   AWL S1 word  → 25 + 6 + freq ≈ 31+   ← highest priority
 *   NAWL word    → 18 + 6 + freq ≈ 24+
 *   TSL TOEIC    → 15 + 6 + freq ≈ 21+
 *   CEFR B2 only → 10 + 6 + freq ≈ 16+
 *   Unknown rare → 0  + 8 + freq ≈ 8+    ← last resort
 */
function learningScore(word, freq, posMult = 1.0) {
  const sub  = awlSublist(word)
  const tier = wordDifficultyTier(word)
  const cedictBoost = lookupMeaning(word) ? 1.2 : 1.0

  // Primary: vocab list membership bonus
  let listBonus = 0
  if (sub >= 1 && sub <= 3)       listBonus = 25  // AWL S1-3: IELTS/TOEFL core
  else if (sub >= 4 && sub <= 7)  listBonus = 20  // AWL S4-7: important academic
  else if (sub >= 8 && sub <= 10) listBonus = 15  // AWL S8-10: academic
  else if (sub === 11)            listBonus = 18  // NAWL: modern academic corpus
  else if (sub === 12)            listBonus = 15  // TSL: TOEIC business vocab
  else if (isKnownVocab(word))    listBonus = 10  // in CEFR/COCA — curated but not AWL
  // 0 = not in any list (domain jargon, proper nouns, unknown)

  // Secondary: difficulty tier (2 pts each) + frequency + POS + cedict
  return listBonus + tier * 2 + Math.log1p(freq) * posMult * cedictBoost
}

/** Strip inline sound-effect labels like [music] or [applause] embedded in speech. */
function cleanText(text) {
  return text.replace(/\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim()
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
  const minLen = minLength(level)
  const { min: initialMin, max: maxTier } = tierRangeForLevel(level)
  let minTier = initialMin

  // ── Step 1: Extract and score words ──────────────────────────────────────────
  const wordFreq    = new Map()
  const wordAllSegs = new Map()  // word → all segments where it appears

  // Pre-compute POS sets across all segments (verbs/adjectives get 1.5× boost)
  const verbSet = new Set()
  const adjSet  = new Set()

  for (const segment of transcript) {
    if (!segment.text) continue
    // Skip sound-effect labels like [groaning], [emotional music], [applause]
    if (/^\s*\[.*\]\s*$/.test(segment.text)) continue
    const text = cleanText(segment.text)
    if (!text) continue
    const doc = nlp(text)
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

  // Tier-filtered ranking with range [minTier, maxTier].
  // Both bounds are strict: beginner sees tier 1-2 only, advanced tier 4 only.
  // listBonus in learningScore() handles ordering within the passing set.
  function rankWords(minT, maxT) {
    return [...wordFreq.entries()]
      .filter(([w]) => { const t = wordDifficultyTier(w); return t >= minT && t <= maxT })
      .filter(([w]) => !knownWords.has(w))
      .sort((a, b) => learningScore(b[0], b[1], posMultiplier(b[0]))
                    - learningScore(a[0], a[1], posMultiplier(a[0])))
  }

  // Adaptive fallback: cascade min down (or max up for beginner) until enough words
  let rankedWords = rankWords(minTier, maxTier)
  while (rankedWords.length < MIN_WORDS_BEFORE_FALLBACK) {
    if (minTier > 1) {
      minTier -= 1
    } else {
      break  // already at widest range
    }
    rankedWords = rankWords(minTier, maxTier)
  }

  const seenKeywords = new Set()
  const words = []
  for (const [word, freq] of rankedWords) {
    // Normalize to canonical (lemma) form so card shows "chaperone" not "chaperoning"
    const canonical = canonicalForm(word)
    if (seenKeywords.has(canonical)) continue  // deduplicate variants (run/running → both "run")
    seenKeywords.add(canonical)
    const seg = pickBestSeg(word, wordAllSegs.get(word))
    const wordTier = wordDifficultyTier(word)
    const wordAwlSub = awlSublist(canonical !== word ? canonical : word)
    const wordCategories = getVocabCategories(canonical !== word ? canonical : word)
    words.push({
      type: 'word',
      keyword: word,                               // inflected form as heard in the video
      lemma: canonical !== word ? canonical : undefined,  // base/dictionary form (shown as supplementary)
      meaning_zh: lookupMeaning(canonical),        // cedict/MyMemory lookup using base form
      frequency: freq,
      difficulty_tier: wordTier,
      awl_sublist: wordAwlSub > 0 ? wordAwlSub : undefined,  // 1-10=AWL sublist, 11=NAWL, undefined=none
      categories: wordCategories,
      sentence: cleanText(seg.text),
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
    if (/^\s*\[.*\]\s*$/.test(segment.text)) continue
    const phraseText = cleanText(segment.text)
    if (!phraseText) continue

    // Phrasal verbs via regex
    const phrasalMatches = phraseText.matchAll(
      new RegExp(`\\b([a-zA-Z]{3,})\\s+(${PARTICLES})\\b`, 'gi')
    )
    for (const m of phrasalMatches) addPhrase(m[0], segment)

    // Compound nouns — no determiners, no proper noun phrases (person/place names)
    const nounPhrases = nlp(phraseText).nouns().out('array')
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
    if (seenKeywords.has(phrase)) continue
    seenKeywords.add(phrase)
    const seg = phraseFirstSeg.get(phrase)
    phrases.push({
      type: 'phrase',
      keyword: phrase,
      meaning_zh: lookupMeaning(phrase),
      frequency: freq,
      difficulty_tier: Math.max(1, ...phrase.split(' ').map(w => wordDifficultyTier(w))),
      sentence: cleanText(seg.text),
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
      sentence:        cleanText(segment.text),
      clip_start:      +clip_start.toFixed(2),
      clip_end:        +clip_end.toFixed(2),
      sort_order:      0,
      level:           'intermediate',
    })
  }

  // Sort: hardest first (most worth learning)
  return cards.sort((a, b) => b.difficulty_tier - a.difficulty_tier)
}
