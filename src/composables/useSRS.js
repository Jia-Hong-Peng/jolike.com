/**
 * useSRS — Spaced Repetition System for vocabulary review.
 *
 * Algorithm: SM-2 simplified
 *   known  → interval × 2.5, capped at MAX_INTERVAL_DAYS
 *   unsure → interval reset to 1 day
 *
 * Storage key: jolike_srs_{wordKey}  (wordKey = keyword.toLowerCase())
 * Storage format: { word, meaning_zh, videoId, type, sentence, clip_start, clip_end,
 *                   interval, nextReview, reviews }
 */

const MAX_INTERVAL_DAYS = 90
const MS_PER_DAY = 86400 * 1000
const PREFIX = 'jolike_srs_'

function wordKey(keyword) {
  return keyword.toLowerCase()
}

function readEntry(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeEntry(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch {
    // Storage full — fail silently (DOMException: QuotaExceededError)
  }
}

/**
 * Returns a Set of words the user has mastered (reviews >= 3).
 * Used by nlp.js to skip already-mastered words during extraction.
 * @returns {Set<string>}
 */
export function getKnownWords() {
  const known = new Set()
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(key) || '{}')
      if ((entry.reviews ?? 0) >= 3) known.add(entry.word)
    } catch { /* skip corrupt entry */ }
  }
  return known
}

/**
 * Schedule a card for review starting tomorrow.
 * Called whenever a user advances past a learning card (mark known or skip).
 * Only creates a new entry — never overwrites existing SRS progress.
 * @param {Object} card — full learning card object from nlp.js
 */
export function scheduleReview(card) {
  const key = wordKey(card.keyword)
  const existing = readEntry(key)
  if (existing) return  // never reset interval or reviews for in-progress words
  writeEntry(key, {
    word: card.keyword,
    meaning_zh: card.meaning_zh ?? '',
    videoId: card.video_id,
    type: card.type,
    difficulty_tier: card.difficulty_tier ?? 4,
    sentence: card.sentence ?? '',
    clip_start: card.clip_start ?? 0,
    clip_end: card.clip_end ?? 0,
    interval: 1,
    nextReview: Date.now() + MS_PER_DAY,
    reviews: 0,
  })
}

/**
 * Returns all entries due for review (nextReview <= now).
 * @returns {Array<Object>}
 */
export function getDue() {
  const now = Date.now()
  const due = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(k))
      if (entry && entry.nextReview <= now) {
        due.push(entry)
      }
    } catch {
      // skip corrupt entries
    }
  }
  return due
}

/**
 * Returns the current daily review streak (consecutive days with ≥1 review).
 * Uses jolike_srs_streak_* keys.
 * @returns {{ streak: number, lastDate: string|null }}
 */
export function getStreak() {
  try {
    const raw = localStorage.getItem('jolike_streak')
    if (!raw) return { streak: 0, lastDate: null }
    const data = JSON.parse(raw)
    return { streak: data.streak ?? 0, lastDate: data.lastDate ?? null }
  } catch {
    return { streak: 0, lastDate: null }
  }
}

function recordStreakToday() {
  try {
    const today = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
    const existing = localStorage.getItem('jolike_streak')
    const prev = existing ? JSON.parse(existing) : { streak: 0, lastDate: null }
    if (prev.lastDate === today) return  // already counted today
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
    const streak = prev.lastDate === yesterday ? prev.streak + 1 : 1
    localStorage.setItem('jolike_streak', JSON.stringify({ streak, lastDate: today }))
  } catch {
    // fail silently
  }
}

/**
 * Record the outcome of a review and schedule the next one.
 * @param {string} keyword
 * @param {'known'|'unsure'} outcome
 */
export function markReview(keyword, outcome) {
  const key = wordKey(keyword)
  const entry = readEntry(key)
  if (!entry) return

  const reviews = (entry.reviews ?? 0) + 1

  if (outcome === 'known') {
    const nextInterval = Math.min(
      Math.ceil(entry.interval * 2.5),
      MAX_INTERVAL_DAYS,
    )
    writeEntry(key, {
      ...entry,
      interval: nextInterval,
      nextReview: Date.now() + nextInterval * MS_PER_DAY,
      reviews,
    })
  } else {
    writeEntry(key, {
      ...entry,
      interval: 1,
      nextReview: Date.now() + MS_PER_DAY,
      reviews,
    })
  }
  recordStreakToday()
}
