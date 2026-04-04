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
 * Schedule a card for review starting tomorrow.
 * Called when user marks a card 'unsure' during learning.
 * @param {Object} card — full learning card object from nlp.js
 */
export function scheduleReview(card) {
  const key = wordKey(card.keyword)
  const existing = readEntry(key)
  writeEntry(key, {
    word: card.keyword,
    meaning_zh: card.meaning_zh ?? '',
    videoId: card.video_id,
    type: card.type,
    sentence: card.sentence ?? '',
    clip_start: card.clip_start ?? 0,
    clip_end: card.clip_end ?? 0,
    interval: 1,
    nextReview: Date.now() + MS_PER_DAY,
    reviews: existing ? (existing.reviews ?? 0) : 0,
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
}
