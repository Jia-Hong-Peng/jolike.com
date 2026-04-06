/**
 * vocabScan.js — scan a full video transcript against all vocabulary lists.
 *
 * Runs client-side (no Worker CPU limit).
 * Uses canonicalForm + morphStems from lookup.js for morphological matching:
 *   "constrained" → stems include "constrain" → matches AWL/IELTS list.
 */

import { canonicalForm, morphStems } from '@/lib/lookup.js'
import { VOCAB_LISTS, loadWordList } from '@/lib/vocabLists.js'

/**
 * Build a Set of all word forms found in the transcript.
 * Includes raw tokens AND their canonical/stemmed forms for fuzzy matching.
 * @param {Array<{text: string}>} transcript
 * @returns {Set<string>}
 */
function buildTranscriptForms(transcript) {
  const allText = transcript.map(s => s.text).join(' ')
  const tokens = allText.toLowerCase().match(/[a-z]+/g) || []

  const forms = new Set()
  for (const token of tokens) {
    if (token.length < 2) continue
    forms.add(token)
    forms.add(canonicalForm(token))
    for (const stem of morphStems(token)) {
      forms.add(stem)
    }
  }
  return forms
}

/**
 * Scan the full transcript against all vocabulary lists.
 * Returns a vocab index: { list_id: [matched_canonical_word, ...] }
 *
 * @param {Array<{text: string}>} transcript
 * @returns {Promise<Record<string, string[]>>}
 */
export async function scanTranscriptVocab(transcript) {
  const transcriptForms = buildTranscriptForms(transcript)
  const vocab = {}

  await Promise.all(
    VOCAB_LISTS.map(async (list) => {
      const listWords = await loadWordList(list.id)
      const matched = listWords.filter(w => {
        const lw = w.toLowerCase()
        return (
          transcriptForms.has(lw) ||
          transcriptForms.has(canonicalForm(lw))
        )
      })
      if (matched.length > 0) vocab[list.id] = matched
    })
  )

  return vocab
}
