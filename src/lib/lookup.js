/**
 * lookup.js — lightweight vocabulary lookup helpers.
 *
 * Contains the pure data-lookup functions that do NOT depend on compromise.js.
 * ShadowingPage (and any page that only needs dictionary lookups) imports from
 * here to avoid loading the 838KB NLP bundle.
 *
 * Data imported here:
 *   cedict.json      — Chinese meanings (~9KB)
 *   cefr_vocab.json  — CEFR A1-C2 tiers (~110KB)
 *   awl_nawl.json    — AWL/NAWL/TSL sublists (~32KB)
 *   coca5000.json    — business vocab fallback (~9KB)
 *
 * nlp.js imports these functions from here so the two files share a single
 * implementation with no duplication.
 *
 * Note: lookupNgslDef lives in ngsl.js (lazy-loaded separately, ~246KB).
 */

import awlWords      from '@/data/coca5000.json'
import awlNawlData   from '@/data/awl_nawl.json'
import cedict        from '@/data/cedict.json'
import cefrVocab     from '@/data/cefr_vocab.json'
import toeicVocab    from '@/data/toeic_vocab.json'

// Primary: CEFR-J + Octanove vocabulary profile
const cefrMap    = cefrVocab
const awlNawlMap = awlNawlData
const awlSet     = new Set(awlWords.map(w => w.toLowerCase()))
const toeicSet   = new Set(Object.keys(toeicVocab).map(w => w.toLowerCase()))
// IELTS: CEFR B2 (tier 3) upper-intermediate vocabulary
const ieltsSet   = new Set(Object.entries(cefrVocab).filter(([, t]) => t === 3).map(([w]) => w))

// ── Morphological stem generation ─────────────────────────────────────────────
export function morphStems(w) {
  const stems = []
  if (w.endsWith('ing') && w.length > 5) {
    stems.push(w.slice(0, -3))
    stems.push(w.slice(0, -3) + 'e')
    stems.push(w.slice(0, -4))
  }
  if (w.endsWith('er') && w.length > 4) {
    const base = w.slice(0, -2)
    stems.push(base)
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      stems.push(base.slice(0, -1))
    }
  }
  if (w.endsWith('est') && w.length > 5) {
    const base = w.slice(0, -3)
    stems.push(base)
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      stems.push(base.slice(0, -1))
    }
  }
  if (w.endsWith('ened') && w.length > 6) stems.push(w.slice(0, -4))
  if (w.endsWith('ed') && w.length > 4) {
    const base2 = w.slice(0, -2)
    stems.push(base2)
    stems.push(base2 + 'e')
    if (base2.length >= 3 && base2[base2.length - 1] === base2[base2.length - 2]) {
      stems.push(base2.slice(0, -1))
    }
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

// ── Canonical (lemma) form ─────────────────────────────────────────────────────
export function canonicalForm(word) {
  const w = word.toLowerCase()
  const candidates = [w, ...morphStems(w)]

  let best = null
  for (const c of candidates) {
    if (c.length < 2) continue
    const inVocab = cefrMap[c] !== undefined || awlSet.has(c)
    if (inVocab && (best === null || c.length < best.length)) best = c
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
      if (plain.length >= 3 && plain[plain.length - 1] === plain[plain.length - 2]) {
        return plain.slice(0, -1)
      }
      return plain + 'e'
    }
  }
  return w
}

// ── Academic word lookup ───────────────────────────────────────────────────────
export function awlSublist(word) {
  const w = word.toLowerCase()
  if (awlNawlMap[w] !== undefined) return awlNawlMap[w]
  for (const stem of morphStems(w)) {
    if (awlNawlMap[stem] !== undefined) return awlNawlMap[stem]
  }
  return 0
}

// ── Vocabulary category tags ──────────────────────────────────────────────────
// Returns array of category strings for a word.
// Categories: 'academic' (AWL 1-10), 'advanced_academic' (AWL 11-12), 'toeic', 'ielts' (CEFR B2)
export function getVocabCategories(word) {
  const w = word.toLowerCase()
  const cats = []

  // AWL sublist check (includes morph stems)
  const sub = awlSublist(w)
  if (sub >= 1 && sub <= 10)   cats.push('academic')
  else if (sub >= 11)           cats.push('advanced_academic')

  // TOEIC business vocabulary check
  const inToeic = toeicSet.has(w)
    || morphStems(w).some(s => toeicSet.has(s))
  if (inToeic) cats.push('toeic')

  // IELTS: CEFR B2 upper-intermediate vocabulary (band 6-7 target range)
  const inIelts = ieltsSet.has(w)
    || morphStems(w).some(s => ieltsSet.has(s))
  if (inIelts) cats.push('ielts')

  return cats
}

// ── Difficulty tier (CEFR-based) ──────────────────────────────────────────────
export function wordDifficultyTier(word) {
  const w = word.toLowerCase()
  let tier = cefrMap[w]

  if (tier === undefined) {
    for (const stem of morphStems(w)) {
      const t = cefrMap[stem]
      if (t !== undefined && (tier === undefined || t < tier)) tier = t
    }
  }

  const sublist = awlSublist(w)
  if (sublist > 0) {
    if (tier !== undefined) return Math.max(tier, 3)
    return 3
  }
  if (tier !== undefined) return tier

  if (awlSet.has(w)) return 3
  for (const stem of morphStems(w)) {
    if (awlSet.has(stem)) return 3
  }
  return 4
}

/**
 * Returns true if the word (or any morphological stem) is found in any of
 * our curated vocabulary data sets: cefr_vocab, awl_nawl, or coca5000.
 * Words NOT passing this check are "unknown domain jargon" — still shown
 * as a last resort, but deprioritized in scoring.
 * @param {string} word
 * @returns {boolean}
 */
export function isKnownVocab(word) {
  const w = word.toLowerCase()
  if (cefrMap[w] !== undefined || awlNawlMap[w] !== undefined || awlSet.has(w)) return true
  for (const stem of morphStems(w)) {
    if (cefrMap[stem] !== undefined || awlNawlMap[stem] !== undefined || awlSet.has(stem)) return true
  }
  return false
}

// ── Chinese meaning lookup ─────────────────────────────────────────────────────
export function lookupMeaning(keyword) {
  const key = keyword.toLowerCase()
  return cedict[key]
    || cedict[key.replace(/-/g, ' ')]
    || cedict[canonicalForm(key)]
    || ''
}

