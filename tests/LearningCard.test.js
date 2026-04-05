/**
 * LearningCard.vue — unit tests
 *
 * Covers:
 *  - loadCardData race condition: fast card switch discards stale translation
 *  - translateText timeout: AbortSignal is passed (5s)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LearningCard from '../src/components/LearningCard.vue'

// ── Minimal card fixtures ─────────────────────────────────────────────────────

function makeCard(overrides = {}) {
  return {
    id:              'vid_economy',
    video_id:        'vid',
    type:            'word',
    keyword:         'economy',
    lemma:           'economy',
    meaning_zh:      '',  // empty → triggers Phase 2 translation
    difficulty_tier: 3,
    sentence:        'The economy grew rapidly.',
    clip_start:      1.0,
    clip_end:        5.0,
    sort_order:      0,
    level:           'intermediate',
    frequency:       2,
    ...overrides,
  }
}

// ── Global mock setup ─────────────────────────────────────────────────────────

// Mock lookupDefinition to be controllable
vi.mock('../src/composables/useDictionary.js', () => ({
  lookupDefinition: vi.fn().mockResolvedValue(null),
}))

// Mock useTTS (no browser speechSynthesis)
vi.mock('../src/composables/useTTS.js', () => ({
  useTTS: () => ({ hasTTS: { value: false }, speak: vi.fn() }),
}))

// Mock VideoClip + HighlightedSentence to avoid YT IFrame API
vi.mock('../src/components/VideoClip.vue', () => ({
  default: { template: '<div />', props: ['videoId', 'start', 'end', 'loop', 'playbackRate'], emits: ['ended'] },
}))
vi.mock('../src/components/HighlightedSentence.vue', () => ({
  default: { template: '<span />', props: ['sentence', 'keyword', 'cloze'] },
}))

// Mock ngsl.js (lazy-loaded fallback)
vi.mock('../src/lib/ngsl.js', () => ({
  lookupNgslDef: vi.fn().mockReturnValue(''),
}))

beforeEach(() => {
  global.localStorage = {
    _store: {},
    getItem(k)    { return this._store[k] ?? null },
    setItem(k, v) { this._store[k] = v },
    removeItem(k) { delete this._store[k] },
    clear()       { this._store = {} },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── T-LC-TOEIC: showToeicBadge display logic ─────────────────────────────────

describe('LearningCard — showToeicBadge', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ responseData: { translatedText: '' }, responseStatus: 200 }),
    })
  })

  it('T-LC-TOEIC-1 — shows 多益 badge when card.categories includes "toeic"', async () => {
    const card = makeCard({ categories: ['toeic'], awl_sublist: undefined })
    const wrapper = mount(LearningCard, { props: { card } })
    await flushPromises()
    expect(wrapper.text()).toContain('多益')
  })

  it('T-LC-TOEIC-2 — hides 多益 badge when categories does not include "toeic"', async () => {
    const card = makeCard({ categories: ['academic'], awl_sublist: undefined })
    const wrapper = mount(LearningCard, { props: { card } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('多益')
  })

  it('T-LC-TOEIC-3 — hides 多益 badge when awl_sublist >= 12 (already shown via AWL badge)', async () => {
    const card = makeCard({ categories: ['toeic'], awl_sublist: 12 })
    const wrapper = mount(LearningCard, { props: { card } })
    await flushPromises()
    // showToeicBadge returns false when awl_sublist >= 12
    // The AWL badge shows 商業英文 instead — no duplicate 多益 badge
    const badgeSpans = wrapper.findAll('span')
    const toeicBadge = badgeSpans.find(s => s.text() === '多益')
    expect(toeicBadge).toBeUndefined()
  })

  it('T-LC-TOEIC-4 — no 多益 badge when categories is undefined', async () => {
    const card = makeCard({ categories: undefined, awl_sublist: undefined })
    const wrapper = mount(LearningCard, { props: { card } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('多益')
  })
})

// ── T-LC-1: generation guard prevents stale data on fast card switch ──────────

describe('LearningCard — loadCardData race condition', () => {
  it('T-LC-1 — changing card.id while translating does not set stale data', async () => {
    const { lookupDefinition } = await import('../src/composables/useDictionary.js')

    // First card takes a long time to resolve
    let resolveFirst
    lookupDefinition.mockImplementationOnce(
      () => new Promise(res => { resolveFirst = () => res({ definition: 'STALE_DEF', phonetic: '', partOfSpeech: '', example: '' }) })
    )
    // Second card resolves immediately
    lookupDefinition.mockResolvedValueOnce(null)

    // Stub fetch (translation) to resolve immediately with empty
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ responseData: { translatedText: '' }, responseStatus: 200 }),
    })

    const cardA = makeCard({ id: 'vid_economy', keyword: 'economy' })
    const cardB = makeCard({ id: 'vid_growth',  keyword: 'growth'  })

    const wrapper = mount(LearningCard, { props: { card: cardA } })

    // Card changes immediately before first load completes
    await wrapper.setProps({ card: cardB })

    // Now resolve the stale first-card lookup
    resolveFirst?.()
    await flushPromises()

    // dictData should be null (from card B's null lookup), not 'STALE_DEF' from card A
    // We test via the rendered output: STALE_DEF should not appear
    expect(wrapper.html()).not.toContain('STALE_DEF')
  })
})

// ── T-LC-2: translateText passes AbortSignal to fetch ─────────��───────────────

describe('LearningCard — translateText timeout', () => {
  it('T-LC-2 — fetch is called with AbortSignal (5s timeout)', async () => {
    const { lookupDefinition } = await import('../src/composables/useDictionary.js')
    lookupDefinition.mockResolvedValue(null)

    // Spy on fetch to capture options
    let capturedOptions = null
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      capturedOptions = options
      return Promise.resolve({
        json: () => Promise.resolve({ responseData: { translatedText: 'test' }, responseStatus: 200 }),
      })
    })

    const card = makeCard({ meaning_zh: '', sentence: 'The economy grew.' })
    mount(LearningCard, { props: { card } })
    await flushPromises()

    // fetch should have been called (for sentence translation or keyword)
    expect(global.fetch).toHaveBeenCalled()
    // The options should include a signal (AbortSignal.timeout)
    expect(capturedOptions).toBeDefined()
    expect(capturedOptions.signal).toBeDefined()
    expect(typeof capturedOptions.signal.aborted).toBe('boolean')  // it is an AbortSignal
  })
})
