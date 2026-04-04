import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useLearningSession } from '../src/composables/useLearningSession.js'

const makeCards = (n) => ref(
  Array.from({ length: n }, (_, i) => ({ id: `card_${i}`, keyword: `word${i}` }))
)

beforeEach(() => {
  localStorage.clear()
})

// ── markCard ──────────────────────────────────────────────────────────────────
describe('useLearningSession — markCard', () => {
  it('T-LS-1 — stores known status in session', () => {
    const cards = makeCards(3)
    const { markCard, cardStatus } = useLearningSession('vid1', cards)
    markCard('card_0', 'known')
    expect(cardStatus('card_0')).toBe('known')
  })

  it('T-LS-2 — stores unsure status in session', () => {
    const cards = makeCards(3)
    const { markCard, cardStatus } = useLearningSession('vid1', cards)
    markCard('card_0', 'unsure')
    expect(cardStatus('card_0')).toBe('unsure')
  })

  it('T-LS-3 — persists to localStorage', () => {
    const cards = makeCards(3)
    const { markCard } = useLearningSession('vid1', cards)
    markCard('card_0', 'known')
    const raw = localStorage.getItem('jolike_session_vid1')
    expect(raw).not.toBeNull()
    const stored = JSON.parse(raw)
    expect(stored.cards['card_0']).toBe('known')
  })

  it('T-LS-4 — cardStatus returns null for unmarked card', () => {
    const cards = makeCards(3)
    const { cardStatus } = useLearningSession('vid1', cards)
    expect(cardStatus('card_99')).toBeNull()
  })

  it('T-LS-5 — ignores markCard with falsy cardId', () => {
    const cards = makeCards(2)
    const { markCard, cardStatus } = useLearningSession('vid1', cards)
    expect(() => markCard(null, 'known')).not.toThrow()
    expect(() => markCard('', 'known')).not.toThrow()
    expect(cardStatus(null)).toBeNull()
  })
})

// ── next() + isComplete ───────────────────────────────────────────────────────
describe('useLearningSession — next + isComplete', () => {
  it('T-LS-6 — next() advances currentIndex', () => {
    const cards = makeCards(3)
    const { currentIndex, next } = useLearningSession('vid1', cards)
    expect(currentIndex.value).toBe(0)
    next()
    expect(currentIndex.value).toBe(1)
  })

  it('T-LS-7 — isComplete is false while cards remain', () => {
    const cards = makeCards(3)
    const { next, isComplete } = useLearningSession('vid1', cards)
    expect(isComplete.value).toBe(false)
    next()
    expect(isComplete.value).toBe(false)
  })

  it('T-LS-8 — isComplete becomes true after all cards viewed', () => {
    const cards = makeCards(2)
    const { next, isComplete } = useLearningSession('vid1', cards)
    next()  // index 0 → 1
    next()  // index 1 → past end
    expect(isComplete.value).toBe(true)
  })

  it('T-LS-9 — next() at end writes completedAt to localStorage', () => {
    const cards = makeCards(1)
    const { next } = useLearningSession('vid1', cards)
    next()  // past end
    const stored = JSON.parse(localStorage.getItem('jolike_session_vid1'))
    expect(stored.completedAt).not.toBeNull()
    expect(typeof stored.completedAt).toBe('number')
  })

  it('T-LS-10 — isComplete is false for empty card list', () => {
    const cards = ref([])
    const { isComplete } = useLearningSession('vid1', cards)
    expect(isComplete.value).toBe(false)
  })
})

// ── jumpTo ────────────────────────────────────────────────────────────────────
describe('useLearningSession — jumpTo', () => {
  it('T-LS-11 — jumpTo valid index updates currentIndex', () => {
    const cards = makeCards(5)
    const { currentIndex, jumpTo } = useLearningSession('vid1', cards)
    jumpTo(3)
    expect(currentIndex.value).toBe(3)
  })

  it('T-LS-12 — jumpTo negative index is ignored', () => {
    const cards = makeCards(5)
    const { currentIndex, jumpTo } = useLearningSession('vid1', cards)
    jumpTo(-1)
    expect(currentIndex.value).toBe(0)
  })

  it('T-LS-13 — jumpTo out-of-bounds is ignored', () => {
    const cards = makeCards(5)
    const { currentIndex, jumpTo } = useLearningSession('vid1', cards)
    jumpTo(99)
    expect(currentIndex.value).toBe(0)
  })
})

// ── Session persistence ───────────────────────────────────────────────────────
describe('useLearningSession — localStorage persistence', () => {
  it('T-LS-14 — restores prior session marks on init', () => {
    // Pre-seed a session
    localStorage.setItem('jolike_session_vid2', JSON.stringify({
      videoId: 'vid2',
      startedAt: Date.now(),
      cards: { card_0: 'unsure', card_1: 'known' },
      completedAt: null,
    }))
    const cards = makeCards(3)
    const { cardStatus } = useLearningSession('vid2', cards)
    expect(cardStatus('card_0')).toBe('unsure')
    expect(cardStatus('card_1')).toBe('known')
  })

  it('T-LS-15 — ignores corrupt localStorage data', () => {
    localStorage.setItem('jolike_session_vid3', '!!!invalid json!!!}')
    const cards = makeCards(2)
    expect(() => useLearningSession('vid3', cards)).not.toThrow()
  })

  it('T-LS-16 — ignores session from different videoId', () => {
    // Session saved for vid_other should not leak into vid_self
    localStorage.setItem('jolike_session_vid_other', JSON.stringify({
      videoId: 'vid_other',
      startedAt: Date.now(),
      cards: { card_0: 'known' },
      completedAt: null,
    }))
    const cards = makeCards(2)
    const { cardStatus } = useLearningSession('vid_self', cards)
    expect(cardStatus('card_0')).toBeNull()
  })
})
