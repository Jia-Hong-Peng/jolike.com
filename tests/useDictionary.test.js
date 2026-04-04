import { describe, it, expect, beforeEach, vi } from 'vitest'
import { lookupDefinition } from '../src/composables/useDictionary.js'

const PREFIX = 'jolike_dict_'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// ── Cache read/write ──────────────────────────────────────────────────────────
describe('useDictionary — localStorage cache', () => {
  it('T-DIC-1 — returns cached result without fetch', async () => {
    const cached = { phonetic: '/rʌn/', partOfSpeech: 'verb', definition: 'to move fast', example: '' }
    localStorage.setItem(PREFIX + 'run', JSON.stringify(cached))

    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await lookupDefinition('run')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result).toEqual(cached)
  })

  it('T-DIC-2 — cache is case-insensitive (normalizes to lowercase)', async () => {
    const cached = { phonetic: '/rʌn/', partOfSpeech: 'verb', definition: 'to move fast', example: '' }
    localStorage.setItem(PREFIX + 'run', JSON.stringify(cached))

    vi.spyOn(global, 'fetch')
    const result = await lookupDefinition('RUN')
    expect(result).toEqual(cached)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('T-DIC-3 — caches null on 404 to avoid repeated fetches', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 404 })
    const result = await lookupDefinition('xyzzy')
    expect(result).toBeNull()
    const stored = localStorage.getItem(PREFIX + 'xyzzy')
    expect(stored).toBe('null')  // explicit null cached
  })

  it('T-DIC-4 — caches valid result to localStorage', async () => {
    const mockEntry = [{
      phonetics: [{ text: '/wɜːrd/' }],
      phonetic: '/wɜːrd/',
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [{ definition: 'a unit of language', example: 'the word "run"' }],
      }],
    }]
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockEntry,
    })

    const result = await lookupDefinition('word')
    expect(result).not.toBeNull()
    expect(result.phonetic).toBe('/wɜːrd/')
    expect(result.partOfSpeech).toBe('noun')
    expect(result.definition).toBe('a unit of language')
    expect(result.example).toBe('the word "run"')

    // Verify it was cached
    const stored = JSON.parse(localStorage.getItem(PREFIX + 'word'))
    expect(stored).toEqual(result)
  })
})

// ── Phrase/edge case skip ─────────────────────────────────────────────────────
describe('useDictionary — phrase skip', () => {
  it('T-DIC-5 — returns null for multi-word phrases without fetching', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await lookupDefinition('give up')
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('T-DIC-6 — returns null for empty string without fetching', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await lookupDefinition('')
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── Network failure ───────────────────────────────────────────────────────────
describe('useDictionary — network failure', () => {
  it('T-DIC-7 — returns null when fetch throws (network error)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))
    const result = await lookupDefinition('fail')
    expect(result).toBeNull()
  })

  it('T-DIC-8 — does NOT cache on network error (allows retry)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Timeout'))
    await lookupDefinition('retry')
    // Should NOT have cached anything — next call will try again
    expect(localStorage.getItem(PREFIX + 'retry')).toBeNull()
  })
})
