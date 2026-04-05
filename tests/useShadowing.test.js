/**
 * useShadowing.js — unit tests
 *
 * Covers the MediaRecorder lifecycle and the reset() race condition fix.
 * All browser APIs (MediaRecorder, getUserMedia, URL) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useShadowing } from '../src/composables/useShadowing.js'

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeStream() {
  return { getTracks: () => [{ stop: vi.fn() }] }
}

function makeRecorder(stream) {
  const rec = {
    state: 'inactive',
    mimeType: 'audio/webm',
    ondataavailable: null,
    onstop: null,
    start() { this.state = 'recording' },
    stop() {
      this.state = 'inactive'
      if (this.onstop) this.onstop()
    },
  }
  return rec
}

function setupBrowserMocks({ deniedMic = false, noMediaDevices = false } = {}) {
  const stream = makeStream()
  let recorderInstance = null

  if (noMediaDevices) {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    })
  } else {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: deniedMic
          ? vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
          : vi.fn().mockResolvedValue(stream),
      },
      configurable: true,
    })
  }

  global.MediaRecorder = vi.fn().mockImplementation((s) => {
    recorderInstance = makeRecorder(s)
    return recorderInstance
  })
  global.MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(false)

  global.URL = {
    createObjectURL: vi.fn().mockReturnValue('blob:fake'),
    revokeObjectURL: vi.fn(),
  }

  return { stream, getRecorder: () => recorderInstance }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useShadowing — NOT_SUPPORTED error', () => {
  it('T-SHADOW-NS — sets error when mediaDevices unavailable', async () => {
    setupBrowserMocks({ noMediaDevices: true })
    const { startRecording, state, errorCode } = useShadowing()
    await startRecording()
    expect(state.value).toBe('error')
    expect(errorCode.value).toBe('NOT_SUPPORTED')
  })
})

describe('useShadowing — MIC_DENIED error', () => {
  it('T-SHADOW-MIC — sets error when getUserMedia is denied', async () => {
    setupBrowserMocks({ deniedMic: true })
    const { startRecording, state, errorCode } = useShadowing()
    await startRecording()
    expect(state.value).toBe('error')
    expect(errorCode.value).toBe('MIC_DENIED')
  })
})

describe('useShadowing — reset() race condition regression', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('T-SHADOW-RESET — reset() during recording does not crash when onstop fires after stream=null', async () => {
    const { getRecorder } = setupBrowserMocks()
    const { startRecording, reset, state } = useShadowing()

    // Start recording
    await startRecording()
    expect(state.value).toBe('recording')

    // Simulate reset() being called while still recording:
    // This used to crash because recorder.stop() fires onstop async,
    // but reset() had already nulled stream — causing stream.getTracks() TypeError.
    expect(() => reset()).not.toThrow()

    // After reset, state should be idle (not 'playing' or 'error')
    expect(state.value).toBe('idle')

    // The recorder's onstop fires (synchronously in our mock via reset → recorder.stop())
    // cancelled=true means playback should NOT start — state stays idle
    expect(state.value).toBe('idle')

    vi.useRealTimers()
  })
})

describe('useShadowing — happy path', () => {
  it('T-SHADOW-STOP — stopRecording transitions to playing then idle', async () => {
    const { getRecorder } = setupBrowserMocks()
    const { startRecording, stopRecording, state } = useShadowing()

    // Mock Audio playback
    const audioEndCb = { onended: null }
    global.Audio = vi.fn().mockImplementation(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      onended: null,
      onerror: null,
      set onended(cb) { audioEndCb.onended = cb },
    }))

    await startRecording()
    expect(state.value).toBe('recording')

    stopRecording()
    // After stop, onstop fires synchronously (our mock), blob is created, playback starts
    expect(state.value).toBe('playing')

    // Simulate audio end
    if (audioEndCb.onended) audioEndCb.onended()
    expect(state.value).toBe('idle')
  })
})
