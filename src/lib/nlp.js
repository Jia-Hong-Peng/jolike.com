/**
 * NLP analysis — runs entirely in the browser.
 *
 * Word selection: combined scoring (video frequency × COCA boost × cedict boost)
 * with POS-based filtering + level-specific stop lists.
 *
 * Levels:
 *   beginner     — skip only pure function words; show high-frequency content words
 *   intermediate — also skip common everyday verbs/adjectives learners already know
 *   advanced     — min 6 chars, skip broad common vocabulary, surface rarer/academic words
 */

import nlp from 'compromise'
import coca5000 from '@/data/coca5000.json'
import cedict from '@/data/cedict.json'

const cocaSet = new Set(coca5000.map(w => w.toLowerCase()))

const MAX_WORDS    = 10
const MAX_PHRASES  = 5
const MAX_PATTERNS = 3
const CLIP_MIN_S   = 3

// ── Stop word tiers ────────────────────────────────────────────────────────────

// Always excluded regardless of level (function words + auxiliaries POS tagging misses)
const STOPS_ALWAYS = new Set([
  // Auxiliaries / modals compromise sometimes misclassifies
  'have','been','were','will','would','could','should','might','must','shall',
  'being','having',
  // Ultra-common verbs not worth teaching to any learner
  'said','says','going','gonna','gotta','wanna','kinda',
  // Discourse markers
  'yeah','okay','well','like',
])

// Excluded at intermediate and above
const STOPS_INTERMEDIATE = new Set([
  'make','take','come','know','think','look','want','need','work','give',
  'back','life','time','year','thing','things','people','world','place',
  'really','actually','already','always','never','ever','often','maybe',
  'probably','perhaps','still','even','also','only','quite','rather',
  'much','many','good','great','right','same','long','high','large','small',
  'different','without','because','though','however','while','through',
  'between','after','before','again','every','each','both','another','such',
])

// Excluded at advanced only (broad common vocab a B2+ learner already knows)
const STOPS_ADVANCED = new Set([
  'include','increase','become','produce','provide','consider','continue',
  'develop','receive','create','change','start','start','move','show',
  'allow','help','keep','tell','hold','turn','open','seem','feel','hear',
  'carry','point','ask','play','lead','call','lose','build','walk','reach',
  'speak','spend','stand','grow','bring','write','happen','follow','stop',
  'area','part','home','hand','case','week','company','number','system',
  'program','question','business','government','state','example','problem',
  'fact','kind','idea','power','city','country','school','information',
])

function getStopSet(level) {
  if (level === 'advanced') {
    return new Set([...STOPS_ALWAYS, ...STOPS_INTERMEDIATE, ...STOPS_ADVANCED])
  }
  if (level === 'intermediate') {
    return new Set([...STOPS_ALWAYS, ...STOPS_INTERMEDIATE])
  }
  // beginner: only always-stops
  return new Set([...STOPS_ALWAYS])
}

function minLength(level) {
  if (level === 'advanced') return 6
  if (level === 'intermediate') return 5
  return 4
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function learningScore(word, freq) {
  let score = freq
  if (cocaSet.has(word)) score *= 1.5
  if (cedict[word])      score *= 1.2
  return score
}

function lookupMeaning(keyword) {
  const key = keyword.toLowerCase()
  const meaning = cedict[key] || cedict[key.replace(/-/g, ' ')] || ''
  return meaning.slice(0, 10) || '—'
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
export function extractLearningItems(transcript, videoId, level = 'intermediate') {
  const stops  = getStopSet(level)
  const minLen = minLength(level)

  // Step 1: Count content words via POS filtering
  const wordFreq     = new Map()
  const wordFirstSeg = new Map()

  for (const segment of transcript) {
    if (!segment.text) continue
    const doc = nlp(segment.text)

    const tokens = [
      ...doc.nouns().not('#Pronoun').out('array'),
      ...doc.adjectives().out('array'),
      ...doc.verbs().not('#Auxiliary').out('array'),
    ]

    for (const token of tokens) {
      // Skip multi-word tokens here — they belong in phrase extraction
      if (token.trim().includes(' ')) continue
      const w = token.replace(/[^a-zA-Z]/g, '').toLowerCase()
      if (w.length < minLen) continue
      if (stops.has(w)) continue
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1)
      if (!wordFirstSeg.has(w)) wordFirstSeg.set(w, segment)
    }
  }

  const rankedWords = [...wordFreq.entries()]
    .sort((a, b) => learningScore(b[0], b[1]) - learningScore(a[0], a[1]))

  const seenKeywords = new Set()
  const words = []

  for (const [word, freq] of rankedWords) {
    if (words.length >= MAX_WORDS) break
    if (seenKeywords.has(word)) continue
    seenKeywords.add(word)
    const seg = wordFirstSeg.get(word)
    words.push({
      type: 'word',
      keyword: word,
      meaning_zh: lookupMeaning(word),
      frequency: freq,
      sentence: seg.text,
      ...getClip(seg),
    })
  }

  // Step 2: Phrases — phrasal verbs + compound nouns (no determiners)
  //
  // Phrasal verbs:  verb + particle (give up, look into, come up with…)
  //   → Most uniquely English, hardest for Chinese speakers
  // Compound nouns: adj+noun or noun+noun WITHOUT a leading determiner
  //   → "solar energy", "electric output", NOT "the turbines"

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

    // 1. Phrasal verbs via regex: "[verb] [particle]"
    const phrasalMatches = segment.text.matchAll(
      new RegExp(`\\b([a-zA-Z]{3,})\\s+(${PARTICLES})\\b`, 'gi')
    )
    for (const m of phrasalMatches) {
      addPhrase(m[0], segment)
    }

    // 2. Compound nouns without determiners
    const nounPhrases = nlp(segment.text).nouns().out('array')
    for (const np of nounPhrases) {
      const clean = np.replace(/[^a-zA-Z ]/g, '').trim()
      if (DETERMINERS.test(clean)) continue   // reject "the X", "a X", "my X" …
      if (clean.split(' ').length < 2) continue
      addPhrase(clean, segment)
    }
  }

  const rankedPhrases = [...phraseFreq.entries()]
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
      sentence: seg.text,
      ...getClip(seg),
    })
  }

  // Step 3: Sentence patterns
  const patterns     = []
  const seenPatterns = new Set()

  for (const segment of transcript) {
    if (!segment.text || patterns.length >= MAX_PATTERNS) continue
    for (const sentence of nlp(segment.text).sentences().out('array')) {
      if (patterns.length >= MAX_PATTERNS) break
      const s = sentence.trim()
      const wc = s.split(' ').length
      if (wc < 4 || wc > 14 || seenPatterns.has(s)) continue
      const hasModal       = /\b(should|would|could|might|must|need to|have to|going to|want to)\b/i.test(s)
      const hasConditional = /\b(if|unless|when|whenever|while)\b/i.test(s)
      if (!hasModal && !hasConditional) continue
      seenPatterns.add(s)
      patterns.push({
        type: 'pattern',
        keyword: s,
        meaning_zh: hasModal ? '情態句型' : '條件句型',
        frequency: 1,
        sentence: segment.text,
        ...getClip(segment),
      })
    }
  }

  // Step 4: Merge, sort, assign IDs
  return [...words, ...phrases, ...patterns]
    .sort((a, b) => learningScore(b.keyword, b.frequency) - learningScore(a.keyword, a.frequency))
    .map((item, index) => ({
      id: `${videoId}_${level}_${index}`,
      video_id: videoId,
      sort_order: index,
      ...item,
    }))
}
