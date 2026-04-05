/**
 * useShadowing — MediaRecorder-based shadowing (record → playback).
 * Runs entirely in the browser; audio is never uploaded.
 *
 * iOS Safari 16+ supports MediaRecorder.
 * Recording must be triggered by a user gesture (button click).
 */

import { ref } from 'vue'

export function useShadowing() {
  const state = ref('idle')  // 'idle' | 'recording' | 'playing' | 'error'
  const errorCode = ref(null)  // 'MIC_DENIED' | 'NOT_SUPPORTED'

  let recorder = null
  let stream = null
  let audioUrl = null
  let stopTimeout = null
  let cancelled = false  // set by reset() so onstop knows to abort

  const MAX_RECORD_MS = 10_000  // 10s cap

  /**
   * Start shadowing flow:
   * 1. Request mic permission
   * 2. Start recording
   * 3. Auto-stop after MAX_RECORD_MS (or caller calls stopRecording())
   */
  async function startRecording() {
    if (state.value !== 'idle') return
    cancelled = false

    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      errorCode.value = 'NOT_SUPPORTED'
      state.value = 'error'
      return
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      errorCode.value = 'MIC_DENIED'
      state.value = 'error'
      return
    }

    const chunks = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : ''

    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      // Guard: reset() may have already cleaned up stream and set cancelled
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
        stream = null
      }
      if (cancelled) return  // reset() was called — discard recording, stay idle

      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      audioUrl = URL.createObjectURL(blob)
      playback()
    }

    recorder.start()
    state.value = 'recording'

    // Auto-stop after 10s
    stopTimeout = setTimeout(() => {
      stopRecording()
    }, MAX_RECORD_MS)
  }

  function stopRecording() {
    clearTimeout(stopTimeout)
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
  }

  function playback() {
    if (!audioUrl) {
      state.value = 'idle'
      return
    }
    state.value = 'playing'
    const audio = new Audio(audioUrl)
    audio.play()
    audio.onended = () => {
      state.value = 'idle'
    }
    audio.onerror = () => {
      state.value = 'idle'
    }
  }

  function reset() {
    cancelled = true
    clearTimeout(stopTimeout)
    if (recorder && recorder.state === 'recording') {
      recorder.stop()  // triggers onstop async, but cancelled=true makes it bail early
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      stream = null
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      audioUrl = null
    }
    state.value = 'idle'
    errorCode.value = null
  }

  return {
    state,
    errorCode,
    startRecording,
    stopRecording,
    reset,
  }
}
