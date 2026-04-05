/**
 * useTTS — Text-To-Speech composable.
 * Wraps speechSynthesis with en-US voice selection.
 * Picks the best available voice: Google/neural > non-local > first en-US.
 * Runs entirely in the browser; no external service.
 */

import { ref } from 'vue'

export function useTTS() {
  const hasTTS = ref(typeof window !== 'undefined' && 'speechSynthesis' in window)

  function speak(word) {
    if (!hasTTS.value) return
    const u = new SpeechSynthesisUtterance(word)
    u.lang = 'en-US'
    u.rate = 1.0
    // Pick the best available en-US voice (Google/neural > non-local > first)
    const voices = window.speechSynthesis.getVoices()
    const enUS = voices.filter(v => v.lang === 'en-US' || v.lang === 'en_US')
    const best = enUS.find(v => /google|neural|enhanced/i.test(v.name))
      || enUS.find(v => !v.localService)
      || enUS[0]
    if (best) u.voice = best
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  return { hasTTS, speak }
}
