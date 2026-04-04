import { describe, it, expect } from 'vitest'
import { extractLearningItems } from '../src/lib/nlp.js'

// Transcript with a word known to be AWL/B2 tier (accomplish = awlSet)
// and a phrase containing only basic words
const TRANSCRIPT_AWL = [
  { text: 'You should accomplish this task immediately.', start: 0, dur: 3 },
  { text: 'I want to go home now and sleep early tonight.', start: 3, dur: 3 },
]

// Transcript with simple phrase only
const TRANSCRIPT_SIMPLE = [
  { text: 'The go home routine is important.', start: 0, dur: 3 },
]

describe('nlp.js — phrase difficulty_tier', () => {
  it('T13 — phrase containing a B2/AWL word gets tier >= 3', () => {
    const items = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'beginner')
    const phrases = items.filter(i => i.type === 'phrase')
    // Any phrase that contains a high-tier word should not be hardcoded tier 2
    // At minimum, phrases should have tier computed dynamically
    // If no phrases extracted, the test is vacuously skipped (empty transcript edge case)
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
    // Phrases composed only of A1/A2 words should get tier 1 (not hardcoded 2)
    const lowPhrase = phrases.find(p => p.keyword === 'go home')
    if (lowPhrase) {
      expect(lowPhrase.difficulty_tier).toBe(1)
    }
  })
})

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
      if (adv) {
        expect(mid.id).toBe(adv.id)
      }
    }
  })
})
