import { describe, it, expect, beforeEach } from 'vitest'
import { VOCAB_LISTS, getListMeta, getSrsStatus, loadWordList, generateVocabCards } from '../src/lib/vocabLists.js'

const SRS_PREFIX = 'jolike_srs_'

function setSrsEntry(word, interval) {
  localStorage.setItem(SRS_PREFIX + word.toLowerCase(), JSON.stringify({ interval }))
}

beforeEach(() => {
  localStorage.clear()
})

// ── getListMeta ─────────────────────────────────────────────────────────────
describe('vocabLists.js — getListMeta', () => {
  it('T-GLM-1 — returns correct meta for known list ID', () => {
    const meta = getListMeta('toeic')
    expect(meta).not.toBeNull()
    expect(meta.id).toBe('toeic')
    expect(meta.label).toBeTruthy()
    expect(meta.emoji).toBeTruthy()
  })

  it('T-GLM-2 — returns null for unknown list ID', () => {
    expect(getListMeta('nonexistent_list')).toBeNull()
  })

  it('T-GLM-3 — VOCAB_LISTS covers all expected list IDs', () => {
    const ids = VOCAB_LISTS.map(l => l.id)
    expect(ids).toContain('ngsl')
    expect(ids).toContain('toeic')
    expect(ids).toContain('academic')
    expect(ids).toContain('opal')
  })
})

// ── getSrsStatus ─────────────────────────────────────────────────────────────
describe('vocabLists.js — getSrsStatus', () => {
  it('T-SRS-1 — returns "new" when no localStorage entry exists', () => {
    expect(getSrsStatus('analyze')).toBe('new')
  })

  it('T-SRS-2 — returns "learning" for interval <= 7', () => {
    setSrsEntry('achieve', 3)
    expect(getSrsStatus('achieve')).toBe('learning')
  })

  it('T-SRS-3 — returns "familiar" for interval 8-30', () => {
    setSrsEntry('accomplish', 14)
    expect(getSrsStatus('accomplish')).toBe('familiar')
  })

  it('T-SRS-4 — returns "mastered" for interval > 30', () => {
    setSrsEntry('elaborate', 45)
    expect(getSrsStatus('elaborate')).toBe('mastered')
  })

  it('T-SRS-5 — key lookup is case-insensitive (word stored lowercase)', () => {
    setSrsEntry('Analyze', 60)
    expect(getSrsStatus('analyze')).toBe('mastered')
    expect(getSrsStatus('ANALYZE')).toBe('mastered')
  })

  it('T-SRS-6 — boundary: interval exactly 7 is "learning", 8 is "familiar"', () => {
    setSrsEntry('boundary', 7)
    expect(getSrsStatus('boundary')).toBe('learning')
    setSrsEntry('boundary', 8)
    expect(getSrsStatus('boundary')).toBe('familiar')
  })

  it('T-SRS-7 — boundary: interval exactly 30 is "familiar", 31 is "mastered"', () => {
    setSrsEntry('boundary2', 30)
    expect(getSrsStatus('boundary2')).toBe('familiar')
    setSrsEntry('boundary2', 31)
    expect(getSrsStatus('boundary2')).toBe('mastered')
  })
})

// ── generateVocabCards ────────────────────────────────────────────────────────
describe('vocabLists.js — generateVocabCards', () => {
  it('T-GVC-1 — generates card with expected shape', () => {
    const cards = generateVocabCards(['analyze'], 'academic')
    expect(cards.length).toBe(1)
    const card = cards[0]
    expect(card.id).toBe('vocab_academic_analyze')
    expect(card.type).toBe('word')
    expect(card.keyword).toBe('analyze')
    expect(card._srsStatus).toBe('new')
    expect(typeof card.difficulty_tier).toBe('number')
  })

  it('T-GVC-2 — new words sort before mastered words', () => {
    setSrsEntry('achieve', 60)  // mastered
    const cards = generateVocabCards(['achieve', 'analyze'], 'academic')
    const analyzeCard = cards.find(c => c.keyword === 'analyze')
    const achieveCard = cards.find(c => c.keyword === 'achieve')
    const analyzeIdx = cards.indexOf(analyzeCard)
    const achieveIdx = cards.indexOf(achieveCard)
    expect(analyzeIdx).toBeLessThan(achieveIdx)
  })

  it('T-GVC-3 — status order: new < learning < familiar < mastered', () => {
    setSrsEntry('word_mastered', 60)
    setSrsEntry('word_familiar', 14)
    setSrsEntry('word_learning', 3)
    const cards = generateVocabCards(
      ['word_mastered', 'word_familiar', 'word_learning', 'word_new'],
      'test'
    )
    const statuses = cards.map(c => c._srsStatus)
    expect(statuses[0]).toBe('new')
    expect(statuses[1]).toBe('learning')
    expect(statuses[2]).toBe('familiar')
    expect(statuses[3]).toBe('mastered')
  })

  it('T-GVC-4 — returns empty array for empty word list', () => {
    expect(generateVocabCards([], 'ngsl')).toEqual([])
  })
})

// ── loadWordList ──────────────────────────────────────────────────────────────
describe('vocabLists.js — loadWordList', () => {
  it('T-LWL-1 — ngsl returns non-empty string array', async () => {
    const words = await loadWordList('ngsl')
    expect(Array.isArray(words)).toBe(true)
    expect(words.length).toBeGreaterThan(100)
    expect(typeof words[0]).toBe('string')
  })

  it('T-LWL-2 — toeic returns non-empty string array', async () => {
    const words = await loadWordList('toeic')
    expect(Array.isArray(words)).toBe(true)
    expect(words.length).toBeGreaterThan(100)
  })

  it('T-LWL-3 — academic (AWL) is sorted by sublist rank', async () => {
    const words = await loadWordList('academic')
    expect(Array.isArray(words)).toBe(true)
    expect(words.length).toBeGreaterThan(50)
    // First entries should be AWL sublist 1 words
    const { awlSublist } = await import('../src/lib/lookup.js')
    const firstSublist = awlSublist(words[0])
    expect(firstSublist).toBe(1)
  })

  it('T-LWL-4 — opal returns academic phrase strings', async () => {
    const words = await loadWordList('opal')
    expect(Array.isArray(words)).toBe(true)
    expect(words.length).toBeGreaterThan(10)
  })

  it('T-LWL-5 — unknown list ID returns empty array', async () => {
    const words = await loadWordList('nonexistent')
    expect(words).toEqual([])
  })

  it('T-LWL-6 — cefr_a returns non-empty list containing basic A1/A2 words', async () => {
    const words = await loadWordList('cefr_a')
    expect(Array.isArray(words)).toBe(true)
    expect(words.length).toBeGreaterThan(10)
    // cefr_a pulls tier=1 entries from cefr_vocab.json; should include common basics
    const wordSet = new Set(words)
    // These are well-known A1/A2 words that should be in the list
    const basics = ['book', 'house', 'water', 'time', 'school'].filter(w => wordSet.has(w))
    expect(basics.length).toBeGreaterThan(0)
  })
})
