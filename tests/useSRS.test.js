import { describe, it, expect, beforeEach, vi } from 'vitest'
import { scheduleReview, getDue, markReview } from '../src/composables/useSRS.js'

const MOCK_CARD = {
  keyword: 'run',
  meaning_zh: '跑步',
  video_id: 'abc123',
  type: 'word',
  sentence: 'You should run every day.',
  clip_start: 12.3,
  clip_end: 15.8,
}

const MS_PER_DAY = 86400 * 1000

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('scheduleReview', () => {
  it('T1 — stores entry with interval=1 and nextReview ~1 day from now', () => {
    const before = Date.now()
    scheduleReview(MOCK_CARD)
    const raw = localStorage.getItem('jolike_srs_run')
    expect(raw).not.toBeNull()
    const entry = JSON.parse(raw)
    expect(entry.interval).toBe(1)
    expect(entry.reviews).toBe(0)
    expect(entry.nextReview).toBeGreaterThanOrEqual(before + MS_PER_DAY - 1000)
    expect(entry.nextReview).toBeLessThanOrEqual(before + MS_PER_DAY + 1000)
  })

  it('T2 — normalizes wordKey to lowercase', () => {
    scheduleReview({ ...MOCK_CARD, keyword: 'RUNNING' })
    expect(localStorage.getItem('jolike_srs_running')).not.toBeNull()
    expect(localStorage.getItem('jolike_srs_RUNNING')).toBeNull()
  })

  it('T3 — stores meaning_zh', () => {
    scheduleReview(MOCK_CARD)
    const entry = JSON.parse(localStorage.getItem('jolike_srs_run'))
    expect(entry.meaning_zh).toBe('跑步')
  })

  it('T4 — stores full card fields: clip_start, clip_end, sentence, type, videoId', () => {
    scheduleReview(MOCK_CARD)
    const entry = JSON.parse(localStorage.getItem('jolike_srs_run'))
    expect(entry.clip_start).toBe(12.3)
    expect(entry.clip_end).toBe(15.8)
    expect(entry.sentence).toBe('You should run every day.')
    expect(entry.type).toBe('word')
    expect(entry.videoId).toBe('abc123')
  })

  it('T12 — fails silently when localStorage throws DOMException', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => scheduleReview(MOCK_CARD)).not.toThrow()
  })
})

describe('getDue', () => {
  it('T5 — returns word when nextReview <= now', () => {
    scheduleReview(MOCK_CARD)
    // Override nextReview to be in the past
    const entry = JSON.parse(localStorage.getItem('jolike_srs_run'))
    entry.nextReview = Date.now() - 1
    localStorage.setItem('jolike_srs_run', JSON.stringify(entry))

    const due = getDue()
    expect(due.length).toBe(1)
    expect(due[0].word).toBe('run')
  })

  it('T6 — excludes word when nextReview > now (just scheduled)', () => {
    scheduleReview(MOCK_CARD)  // nextReview = now + 1 day
    expect(getDue().length).toBe(0)
  })

  it('T7 — returns empty array when nothing scheduled', () => {
    const due = getDue()
    expect(Array.isArray(due)).toBe(true)
    expect(due.length).toBe(0)
  })
})

describe('markReview', () => {
  beforeEach(() => {
    scheduleReview(MOCK_CARD)
    // Make card due immediately
    const entry = JSON.parse(localStorage.getItem('jolike_srs_run'))
    entry.nextReview = Date.now() - 1
    localStorage.setItem('jolike_srs_run', JSON.stringify(entry))
  })

  it('T8 — known: multiplies interval by ~2.5 (ceil)', () => {
    markReview('run', 'known')
    const entry = JSON.parse(localStorage.getItem('jolike_srs_run'))
    expect(entry.interval).toBeGreaterThan(1)
    expect(entry.interval).toBeLessThanOrEqual(3)  // ceil(1 * 2.5) = 3
    expect(entry.reviews).toBe(1)
  })

  it('T9 — known: caps interval at MAX_INTERVAL_DAYS=90', () => {
    const entry = JSON.parse(localStorage.getItem('jolike_srs_run'))
    entry.interval = 40
    localStorage.setItem('jolike_srs_run', JSON.stringify(entry))

    markReview('run', 'known')
    const updated = JSON.parse(localStorage.getItem('jolike_srs_run'))
    expect(updated.interval).toBe(90)  // ceil(40 * 2.5) = 100, capped at 90
  })

  it('T10 — known: nextReview advances by new interval days', () => {
    const before = Date.now()
    const entry = JSON.parse(localStorage.getItem('jolike_srs_run'))
    entry.interval = 40
    localStorage.setItem('jolike_srs_run', JSON.stringify(entry))

    markReview('run', 'known')
    const updated = JSON.parse(localStorage.getItem('jolike_srs_run'))
    // interval capped at 90, nextReview = now + 90 days
    expect(updated.nextReview).toBeGreaterThanOrEqual(before + 89 * MS_PER_DAY)
  })

  it('T11 — unsure: resets interval to 1, increments reviews', () => {
    const entry = JSON.parse(localStorage.getItem('jolike_srs_run'))
    entry.interval = 7
    entry.reviews = 3
    localStorage.setItem('jolike_srs_run', JSON.stringify(entry))

    const before = Date.now()
    markReview('run', 'unsure')
    const updated = JSON.parse(localStorage.getItem('jolike_srs_run'))
    expect(updated.interval).toBe(1)
    expect(updated.reviews).toBe(4)
    expect(updated.nextReview).toBeGreaterThanOrEqual(before + MS_PER_DAY - 1000)
    expect(updated.nextReview).toBeLessThanOrEqual(before + MS_PER_DAY + 1000)
  })
})
