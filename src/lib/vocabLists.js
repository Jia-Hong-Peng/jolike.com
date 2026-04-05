/**
 * vocabLists.js — pre-built vocabulary list definitions and data loading.
 *
 * Lists are derived from existing data files:
 *   toeic_vocab.json  — TOEIC business vocabulary
 *   awl_nawl.json     — Academic Word List sublists 1-12
 *   cefr_vocab.json   — CEFR A1-C2 tiers
 *   ngsl_defs.json    — New General Service List
 *   coca5000.json     — COCA high-frequency words
 *   opal_phrases.json — Oxford Phrasal Academic Lexicon
 */

import { canonicalForm, awlSublist, wordDifficultyTier, lookupMeaning, getVocabCategories } from '@/lib/lookup.js'

const SRS_PREFIX = 'jolike_srs_'

export const VOCAB_LISTS = [
  // ── General / frequency ──────────────────────────────────────────────────
  {
    id: 'ngsl',
    label: 'NGSL 通用',
    emoji: '📖',
    desc: '通用英語核心詞彙 (New General Service List, 4054 詞)',
    color: 'green',
    badgeClass: 'bg-green-900/60 text-green-300 border border-green-700',
  },
  {
    id: 'coca',
    label: 'COCA 高頻',
    emoji: '📊',
    desc: '美式英語高頻詞彙 (COCA 5000)',
    color: 'orange',
    badgeClass: 'bg-orange-900/60 text-orange-300 border border-orange-700',
  },
  // ── CEFR levels ──────────────────────────────────────────────────────────
  {
    id: 'cefr_a',
    label: 'A1/A2 基礎',
    emoji: '🔰',
    desc: 'CEFR A1/A2 初學者基礎詞彙',
    color: 'lime',
    badgeClass: 'bg-lime-900/60 text-lime-300 border border-lime-700',
  },
  {
    id: 'cefr_b1',
    label: 'B1 中級',
    emoji: '📗',
    desc: 'CEFR B1 中級獨立使用者詞彙',
    color: 'cyan',
    badgeClass: 'bg-cyan-900/60 text-cyan-300 border border-cyan-700',
  },
  {
    id: 'cefr_c1',
    label: 'C1 高級',
    emoji: '💎',
    desc: 'CEFR C1 高級精通使用者詞彙',
    color: 'purple',
    badgeClass: 'bg-purple-900/60 text-purple-300 border border-purple-700',
  },
  // ── Exams ─────────────────────────────────────────────────────────────────
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
    desc: 'IELTS 學術核心詞彙 (CEFR B2)',
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
  // ── Academic ──────────────────────────────────────────────────────────────
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
  {
    id: 'opal',
    label: 'OPAL 片語',
    emoji: '🗣️',
    desc: '學術英語慣用片語 (Oxford Phrasal Academic Lexicon, 572 組)',
    color: 'rose',
    badgeClass: 'bg-rose-900/60 text-rose-300 border border-rose-700',
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
  // ── General / frequency ──────────────────────────────────────────────────
  if (listId === 'ngsl') {
    const { default: data } = await import('@/data/ngsl_defs.json')
    return Object.keys(data).sort()
  }
  if (listId === 'coca') {
    const { default: data } = await import('@/data/coca5000.json')
    return Object.keys(data).sort()
  }

  // ── CEFR levels ──────────────────────────────────────────────────────────
  if (listId === 'cefr_a' || listId === 'cefr_b1' || listId === 'cefr_c1') {
    const { default: data } = await import('@/data/cefr_vocab.json')
    const tier = listId === 'cefr_a' ? 1 : listId === 'cefr_b1' ? 2 : 4
    return Object.entries(data).filter(([, t]) => t === tier).map(([w]) => w).sort()
  }

  // ── Exams ─────────────────────────────────────────────────────────────────
  if (listId === 'toeic') {
    const { default: data } = await import('@/data/toeic_vocab.json')
    return Object.keys(data).sort()
  }

  if (listId === 'ielts' || listId === 'toefl' || listId === 'academic' || listId === 'advanced') {
    const { default: data } = await import('@/data/awl_nawl.json')
    const entries = Object.entries(data)
    if (listId === 'ielts')    return entries.filter(([, v]) => v <= 7).sort((a, b) => a[1] - b[1]).map(([w]) => w)
    if (listId === 'toefl')    return entries.filter(([, v]) => v <= 5).sort((a, b) => a[1] - b[1]).map(([w]) => w)
    if (listId === 'academic') return entries.filter(([, v]) => v <= 10).sort((a, b) => a[1] - b[1]).map(([w]) => w)
    if (listId === 'advanced') return entries.filter(([, v]) => v >= 11).sort((a, b) => a[1] - b[1]).map(([w]) => w)
  }

  // ── Academic phrases ──────────────────────────────────────────────────────
  if (listId === 'opal') {
    const { default: data } = await import('@/data/opal_phrases.json')
    return Array.isArray(data) ? [...data].sort() : Object.keys(data).sort()
  }

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
