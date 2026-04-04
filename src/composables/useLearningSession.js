/**
 * useLearningSession — per-session card state manager.
 * Persists known/unsure marks to localStorage.
 * Key: jolike_session_{videoId}
 */

import { ref, computed, watch } from 'vue'

export function useLearningSession(videoId, cards) {
  const currentIndex = ref(0)

  // Load or init session from localStorage
  function loadSession() {
    try {
      const raw = localStorage.getItem(`jolike_session_${videoId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.videoId === videoId) return parsed
      }
    } catch {
      // ignore corrupt data
    }
    return {
      videoId,
      startedAt: Date.now(),
      cards: {},
      completedAt: null,
    }
  }

  const session = ref(loadSession())

  function saveSession() {
    try {
      localStorage.setItem(`jolike_session_${videoId}`, JSON.stringify(session.value))
    } catch {
      // Storage full — fail silently
    }
  }

  /**
   * Mark a card with a status.
   * @param {string} cardId
   * @param {'known'|'unsure'} status
   */
  function markCard(cardId, status) {
    if (!cardId) return
    session.value.cards[cardId] = status
    saveSession()
  }

  /**
   * Advance to the next card.
   */
  function next() {
    if (currentIndex.value < cards.value.length - 1) {
      currentIndex.value++
    } else {
      // Mark session complete
      session.value.completedAt = Date.now()
      saveSession()
      // Trigger isComplete
      currentIndex.value = cards.value.length
    }
  }

  /**
   * True when all cards have been viewed (currentIndex past last card).
   */
  const isComplete = computed(() => {
    return cards.value.length > 0 && currentIndex.value >= cards.value.length
  })

  /**
   * Get the stored status for a card.
   * @param {string} cardId
   * @returns {'known'|'unsure'|null}
   */
  function cardStatus(cardId) {
    return session.value.cards[cardId] ?? null
  }

  /**
   * Jump directly to a specific card index.
   * @param {number} index
   */
  function jumpTo(index) {
    if (index >= 0 && index < cards.value.length) {
      currentIndex.value = index
    }
  }

  return {
    currentIndex,
    markCard,
    next,
    jumpTo,
    isComplete,
    cardStatus,
    session,
  }
}
