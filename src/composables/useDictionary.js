/**
 * useDictionary — Free Dictionary API lookup with localStorage cache.
 *
 * API: https://api.dictionaryapi.dev/api/v2/entries/en/{word}
 * Free, no API key required. Returns phonetics, definition, example.
 *
 * Cache key: jolike_dict_{word}
 */

const PREFIX = 'jolike_dict_'

function fromCache(word) {
  try {
    const raw = localStorage.getItem(PREFIX + word.toLowerCase())
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function toCache(word, data) {
  try {
    localStorage.setItem(PREFIX + word.toLowerCase(), JSON.stringify(data))
  } catch { /* storage full — skip */ }
}

/**
 * Look up a single word's phonetic, definition, and part of speech.
 * Only for single words (not phrases or sentences).
 *
 * @param {string} word
 * @returns {Promise<{ phonetic: string, partOfSpeech: string, definition: string, example: string } | null>}
 */
export async function lookupDefinition(word) {
  const clean = word.toLowerCase().trim()
  if (!clean || clean.includes(' ')) return null  // skip phrases

  const cached = fromCache(clean)
  if (cached !== null) return cached

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) {
      toCache(clean, null)  // cache miss to avoid re-fetching
      return null
    }

    const data = await res.json()
    const entry = data?.[0]
    if (!entry) { toCache(clean, null); return null }

    // Best phonetic: prefer one with text
    const phonetic = entry.phonetics?.find(p => p.text)?.text
      || entry.phonetic
      || ''

    // First meaning with a definition
    const meaning = entry.meanings?.[0]
    const defObj  = meaning?.definitions?.[0]

    const result = {
      phonetic,
      partOfSpeech: meaning?.partOfSpeech || '',
      definition:   defObj?.definition || '',
      example:      defObj?.example || '',
    }

    toCache(clean, result)
    return result
  } catch {
    return null
  }
}
