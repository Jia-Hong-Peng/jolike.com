/**
 * pronunciation.js — ARPAbet → IPA conversion using CMU Pronouncing Dictionary.
 *
 * CMUdict format: { word: "AH0 B AE1 N D AH0 N" }
 * Stress digits: 0=unstressed, 1=primary (ˈ), 2=secondary (ˌ)
 * IPA stress marks appear before the stressed vowel.
 */

const ARPABET_TO_IPA = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ',  // AH0 → ə handled by stress logic
  AO: 'ɔ', AW: 'aʊ', AY: 'aɪ',
  EH: 'ɛ', ER: 'ɜr', EY: 'eɪ',
  IH: 'ɪ', IY: 'iː',
  OW: 'oʊ', OY: 'ɔɪ',
  UH: 'ʊ', UW: 'uː',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð',
  F: 'f', G: 'g', HH: 'h', JH: 'dʒ',
  K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ',
  P: 'p', R: 'r', S: 's', SH: 'ʃ',
  T: 't', TH: 'θ', V: 'v', W: 'w',
  Y: 'j', Z: 'z', ZH: 'ʒ',
}

/**
 * Convert an ARPAbet string (from CMUdict) to an IPA string.
 * @param {string} arpabet - e.g. "AH0 B AE1 N D AH0 N"
 * @returns {string} IPA with stress marks, e.g. "əbˈændən"
 */
export function arpabetToIpa(arpabet) {
  const tokens = arpabet.trim().split(/\s+/)
  let result = ''
  for (const token of tokens) {
    const stress = token.slice(-1)
    const hasStress = stress === '0' || stress === '1' || stress === '2'
    const phoneme = hasStress ? token.slice(0, -1) : token
    const stressNum = hasStress ? parseInt(stress) : -1

    const ipa = phoneme === 'AH' && stressNum === 0
      ? 'ə'
      : (ARPABET_TO_IPA[phoneme] ?? phoneme.toLowerCase())

    if (stressNum === 1) result += 'ˈ'
    else if (stressNum === 2) result += 'ˌ'
    result += ipa
  }
  return result
}

let _cmudict = null
let _loading = null

/**
 * Lazy-load CMUdict (14,124 entries, ~300KB parsed).
 * Cached after first load.
 * @returns {Promise<Record<string, string>>}
 */
async function getCmudict() {
  if (_cmudict) return _cmudict
  if (_loading) return _loading
  _loading = import('@/data/cmudict.json').then(m => {
    _cmudict = m.default
    _loading = null
    return _cmudict
  })
  return _loading
}

/**
 * Look up a word in CMUdict and return its IPA pronunciation, or null if not found.
 * @param {string} word
 * @returns {Promise<string|null>}
 */
export async function lookupIpa(word) {
  if (!word) return null
  const dict = await getCmudict()
  const key = word.toLowerCase()
  const entry = dict[key]
  if (!entry) return null
  return '/' + arpabetToIpa(entry) + '/'
}
