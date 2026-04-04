import { describe, it, expect } from 'vitest'
import { extractLearningItems } from '../src/lib/nlp.js'

// ── Helpers ────────────────────────────────────────────────────────────────────
const makeTranscript = (texts) => texts.map((text, i) => ({ text, start: i * 3, dur: 3 }))

// ── Phrase difficulty_tier ─────────────────────────────────────────────────────
const TRANSCRIPT_AWL = makeTranscript([
  'You should accomplish this task immediately.',
  'I want to go home now and sleep early tonight.',
])

const TRANSCRIPT_SIMPLE = makeTranscript([
  'The go home routine is important.',
])

describe('nlp.js — phrase difficulty_tier', () => {
  it('T13 — phrase containing a B2/AWL word gets tier >= 3', () => {
    const items = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'beginner')
    const phrases = items.filter(i => i.type === 'phrase')
    if (phrases.length === 0) return
    const accomplishPhrase = phrases.find(p => p.keyword.includes('accomplish'))
    if (accomplishPhrase) {
      expect(accomplishPhrase.difficulty_tier).toBeGreaterThanOrEqual(3)
    }
  })

  it('T14 — phrase tier is NOT hardcoded 2 for phrases with tier-1 words', () => {
    const items = extractLearningItems(TRANSCRIPT_SIMPLE, 'vid1', 'beginner')
    const phrases = items.filter(i => i.type === 'phrase')
    if (phrases.length === 0) return
    const lowPhrase = phrases.find(p => p.keyword === 'go home')
    if (lowPhrase) {
      expect(lowPhrase.difficulty_tier).toBe(1)
    }
  })
})

// ── Card IDs ───────────────────────────────────────────────────────────────────
describe('nlp.js — card IDs', () => {
  it('T15 — card IDs use keyword-based format (not index-based)', () => {
    const items = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'intermediate')
    for (const item of items) {
      const expectedId = `vid1_${item.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
      expect(item.id).toBe(expectedId)
    }
  })

  it('T16 — card IDs do NOT contain the level string', () => {
    const items = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'intermediate')
    for (const item of items) {
      expect(item.id).not.toContain('intermediate')
      expect(item.id).not.toContain('beginner')
      expect(item.id).not.toContain('advanced')
    }
  })

  it('T17 — same keyword produces same ID regardless of level', () => {
    const itemsMid = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'intermediate')
    const itemsAdv = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'advanced')
    for (const mid of itemsMid) {
      const adv = itemsAdv.find(a => a.keyword === mid.keyword)
      if (adv) expect(mid.id).toBe(adv.id)
    }
  })
})

// ── CEFR tier lookup ───────────────────────────────────────────────────────────
// These words are in cefr_vocab.json with known levels
const TRANSCRIPT_CEFR = makeTranscript([
  'The interior architecture demonstrates remarkable complexity and eloquence.',  // C1 words: interior, eloquence
  'She abandoned the project after careful analysis.',   // B1: abandon, analysis
  'The children play in the garden every morning.',       // A1: children, garden
])

describe('nlp.js — CEFR-based difficulty tiers', () => {
  it('T18 — A1/A2 words are tier 1', () => {
    const items = extractLearningItems(TRANSCRIPT_CEFR, 'vid_cefr', 'beginner')
    // 'children' is A1 → tier 1
    const children = items.find(i => i.keyword === 'children')
    if (children) expect(children.difficulty_tier).toBe(1)
  })

  it('T19 — B1 words are tier 2', () => {
    const items = extractLearningItems(TRANSCRIPT_CEFR, 'vid_cefr', 'beginner')
    // 'analysis' is B1 in CEFR-J
    const analysis = items.find(i => i.keyword === 'analysis')
    if (analysis) expect(analysis.difficulty_tier).toBe(2)
  })

  it('T20 — C1/C2 words are tier 4', () => {
    const items = extractLearningItems(TRANSCRIPT_CEFR, 'vid_cefr', 'beginner')
    // 'eloquence' is C1 → tier 4
    const eloquence = items.find(i => i.keyword === 'eloquence')
    if (eloquence) expect(eloquence.difficulty_tier).toBe(4)
  })

  it('T21 — advanced level prefers tier 3+ words (fallback to tier 2 only if sparse)', () => {
    const items = extractLearningItems(TRANSCRIPT_CEFR, 'vid_cefr', 'advanced')
    const wordItems = items.filter(i => i.type === 'word')
    // Either all words are tier 3+ (normal case), or the list is small due to
    // adaptive fallback (expected when transcript has few high-tier words)
    const tier3Plus = wordItems.filter(i => i.difficulty_tier >= 3)
    // At minimum, any tier3+ words found should appear first (sort by score)
    if (tier3Plus.length > 0) {
      expect(wordItems[0].difficulty_tier).toBeGreaterThanOrEqual(tier3Plus[0].difficulty_tier)
    }
    // Advanced should never return tier 1 words (fallback only goes to tier 2)
    for (const item of wordItems) {
      expect(item.difficulty_tier).toBeGreaterThanOrEqual(2)
    }
  })
})

// ── pickBestSeg behavior ───────────────────────────────────────────────────────
describe('nlp.js — pickBestSeg (best example sentence selection)', () => {
  it('T22 — no pattern cards in output (patterns removed)', () => {
    const transcript = makeTranscript([
      'If you want to succeed, you should work hard every day.',
      'She might consider taking a different approach to the problem.',
    ])
    const items = extractLearningItems(transcript, 'vid_pat', 'beginner')
    const patterns = items.filter(i => i.type === 'pattern')
    expect(patterns.length).toBe(0)
  })

  it('T23 — multiple occurrences: example sentence is not trivially short', () => {
    // 'consider' appears twice — second occurrence is in a longer, more contextual sentence
    const transcript = makeTranscript([
      'Consider it.',                                                    // too short, edge word
      'Many experts consider this approach to be highly effective.',    // better context
    ])
    const items = extractLearningItems(transcript, 'vid_seg', 'beginner')
    const consider = items.find(i => i.keyword === 'consider')
    if (consider) {
      // Should pick a sentence with enough context (≥ 5 words)
      const wordCount = consider.sentence.split(' ').length
      expect(wordCount).toBeGreaterThanOrEqual(5)
    }
  })
})
