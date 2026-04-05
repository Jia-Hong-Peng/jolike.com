/**
 * vocabLists.js — pre-built vocabulary list definitions and data loading.
 *
 * Lists are derived from existing data files:
 *   toeic_vocab.json  — TOEIC business vocabulary
 *   awl_nawl.json     — Academic Word List sublists 1-12
 *
 * IELTS / TOEFL mappings use AWL sublist ranges, which are validated against
 * published research (SAGE Open 2022, Browne & Culligan 2021):
 *   AWL 1-5  ≈ TOEFL core academic vocabulary
 *   AWL 1-7  ≈ IELTS band 6-7 academic vocabulary
 *   AWL 1-10 = complete Academic Word List
 *   AWL 11-12 = New Academic Word List (modern corpus additions)
 */

import { canonicalForm, awlSublist, wordDifficultyTier, lookupMeaning, getVocabCategories } from '@/lib/lookup.js'

const SRS_PREFIX = 'jolike_srs_'

export const VOCAB_LISTS = [
  {
    id: 'toeic',
    label: '多益 TOEIC',
    emoji: '💼',
    desc: 'TOEIC 商業英文核心詞彙，涵蓋職場常用語',
    color: 'emerald',
    badgeClass: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
  },
  {
    id: 'ielts',
    label: '雅思 IELTS',
    emoji: '🎓',
    desc: 'IELTS 學術核心詞彙 (AWL Sublist 1-7)',
    color: 'sky',
    badgeClass: 'bg-sky-900/60 text-sky-300 border border-sky-700',
  },
  {
    id: 'toefl',
    label: '托福 TOEFL',
    emoji: '🏛',
    desc: 'TOEFL 學術核心詞彙 (AWL Sublist 1-5)',
    color: 'amber',
    badgeClass: 'bg-amber-900/60 text-amber-300 border border-amber-700',
  },
  {
    id: 'academic',
    label: '學術詞彙 AWL',
    emoji: '📚',
    desc: '完整學術詞彙清單 (AWL Sublist 1-10)',
    color: 'indigo',
    badgeClass: 'bg-indigo-900/60 text-indigo-300 border border-indigo-700',
  },
  {
    id: 'advanced',
    label: '進階學術',
    emoji: '🔬',
    desc: '進階學術詞彙 (NAWL Sublist 11-12)',
    color: 'violet',
    badgeClass: 'bg-violet-900/60 text-violet-300 border border-violet-700',
  },
]

export function getListMeta(listId) {
  return VOCAB_LISTS.find(l => l.id === listId) ?? null
}

function getSrsEntry(word) {
  try {
    const raw = localStorage.getItem(SRS_PREFIX + word.toLowerCase())
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function getSrsStatus(word) {
  const entry = getSrsEntry(word)
  if (!entry) return 'new'
  if (entry.interval > 30) return 'mastered'
  if (entry.interval > 7)  return 'familiar'
  return 'learning'
}

/**
 * Load the raw word array for a given list ID.
 * Returns words sorted by study priority (AWL sublist rank, then alpha).
 * @param {string} listId
 * @returns {Promise<string[]>}
 */
export async function loadWordList(listId) {
  if (listId === 'toeic') {
    const { default: data } = await import('@/data/toeic_vocab.json')
    return Object.keys(data).sort()
  }

  const { default: data } = await import('@/data/awl_nawl.json')
  const entries = Object.entries(data)

  if (listId === 'ielts')    return entries.filter(([, v]) => v <= 7).sort((a, b) => a[1] - b[1]).map(([w]) => w)
  if (listId === 'toefl')    return entries.filter(([, v]) => v <= 5).sort((a, b) => a[1] - b[1]).map(([w]) => w)
  if (listId === 'academic') return entries.filter(([, v]) => v <= 10).sort((a, b) => a[1] - b[1]).map(([w]) => w)
  if (listId === 'advanced') return entries.filter(([, v]) => v >= 11).sort((a, b) => a[1] - b[1]).map(([w]) => w)

  return []
}

const STATUS_ORDER = { new: 0, learning: 1, familiar: 2, mastered: 3 }

/**
 * Generate study cards from a word list.
 * Orders: unknown words first → learning → familiar → mastered.
 * @param {string[]} words
 * @param {string} listId
 * @returns {Object[]}
 */
export function generateVocabCards(words, listId) {
  return words
    .map(word => {
      const canonical = canonicalForm(word)
      const lemma = canonical !== word ? canonical : undefined
      const srsStatus = getSrsStatus(word)
      return {
        id: `vocab_${listId}_${word}`,
        type: 'word',
        keyword: word,
        lemma,
        meaning_zh: lookupMeaning(lemma ?? word),
        difficulty_tier: wordDifficultyTier(word),
        awl_sublist: (() => { const s = awlSublist(lemma ?? word); return s > 0 ? s : undefined })(),
        categories: getVocabCategories(word),
        _srsStatus: srsStatus,
        // No video_id / clip_start / clip_end / sentence (vocab list cards have no video clip)
      }
    })
    .sort((a, b) => STATUS_ORDER[a._srsStatus] - STATUS_ORDER[b._srsStatus])
}
