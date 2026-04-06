<template>
  <div class="min-h-screen bg-black text-white pb-16">
    <!-- Header -->
    <div class="sticky top-0 z-20 bg-black/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <button
        class="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center
               rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        @click="goHome"
      >
        ←
      </button>
      <h1 class="text-lg font-bold flex-1">單字排行榜</h1>
      <span class="text-gray-500 text-sm">全站統計</span>
    </div>

    <!-- Site stats -->
    <div v-if="siteStats" class="mx-4 mt-4 bg-gray-900 rounded-2xl px-5 py-3 flex gap-6">
      <div class="text-center flex-1">
        <p class="text-white text-xl font-bold">{{ siteStats.with_transcript.toLocaleString() }}</p>
        <p class="text-gray-500 text-xs mt-0.5">有字幕影片</p>
      </div>
      <div class="w-px bg-gray-800"></div>
      <div class="text-center flex-1">
        <p class="text-white text-xl font-bold">{{ siteStats.total.toLocaleString() }}</p>
        <p class="text-gray-500 text-xs mt-0.5">全站影片</p>
      </div>
      <div class="w-px bg-gray-800"></div>
      <div class="text-center flex-1">
        <p class="text-white text-xl font-bold">{{ siteStats.indexed.toLocaleString() }}</p>
        <p class="text-gray-500 text-xs mt-0.5">已建詞彙索引</p>
      </div>
    </div>

    <!-- Difficulty filter (only show levels that have data) -->
    <div v-if="visibleDifficultyLevels.length > 0" class="px-4 pt-5 pb-1">
      <p class="text-gray-600 text-xs mb-2">程度篩選</p>
      <div class="flex gap-2">
        <button
          v-for="lv in visibleDifficultyLevels"
          :key="lv.key"
          class="text-sm px-4 py-2 rounded-xl font-medium transition-colors min-h-[40px] flex-1"
          :class="selectedDifficulty === lv.key
            ? lv.activeClass
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
          @click="selectDifficulty(lv.key)"
        >
          {{ lv.label }}
        </button>
      </div>
    </div>

    <!-- List picker (only shown when some lists have data) -->
    <div v-if="levelFilteredLists.length > 0" class="px-4 pt-3 pb-3">
      <p class="text-gray-600 text-xs mb-2">詞彙表</p>
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="list in levelFilteredLists"
          :key="list.id"
          class="text-xs px-3 py-2 rounded-xl font-medium transition-colors min-h-[36px]"
          :class="selectedList === list.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
          @click="selectList(list.id)"
        >
          {{ list.emoji }} {{ list.label }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="px-4 pt-4 space-y-2">
      <div v-for="i in 10" :key="i" class="h-12 bg-gray-900 rounded-xl animate-pulse"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center py-20 gap-4 px-8 text-center">
      <p class="text-red-400">{{ error }}</p>
      <button class="bg-gray-700 text-white px-6 py-3 rounded-2xl min-h-[44px]" @click="load">重試</button>
    </div>

    <!-- Empty (no lists for this difficulty have data yet) -->
    <div v-else-if="levelFilteredLists.length === 0" class="flex flex-col items-center py-24 gap-3 px-8 text-center">
      <p class="text-4xl">📊</p>
      <p class="text-white text-base font-semibold">此程度還沒有統計資料</p>
      <p class="text-gray-500 text-sm">影片入庫並掃描詞彙索引後，這裡會顯示排行</p>
    </div>

    <!-- Empty words -->
    <div v-else-if="words.length === 0 && !loading" class="flex flex-col items-center py-24 gap-3 px-8 text-center">
      <p class="text-4xl">📊</p>
      <p class="text-white text-base font-semibold">還沒有統計資料</p>
      <p class="text-gray-500 text-sm">影片入庫並掃描詞彙索引後，這裡會顯示排行</p>
    </div>

    <!-- Leaderboard -->
    <div v-else class="px-4 pt-2">
      <p class="text-gray-600 text-xs mb-3">
        「出現在幾部影片裡」排行 · {{ currentListMeta?.label }} · Top {{ words.length }}
      </p>

      <div class="space-y-1.5">
        <div
          v-for="(item, idx) in words"
          :key="item.word"
          class="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 cursor-pointer
                 hover:bg-gray-800 transition-colors active:scale-95"
          @click="openWord(item.word)"
        >
          <!-- Rank -->
          <span
            class="text-xs font-mono w-7 text-right flex-shrink-0"
            :class="idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-600'"
          >
            {{ idx + 1 }}
          </span>

          <!-- Bar (visual weight) -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2">
              <span class="text-white font-semibold text-sm">{{ item.word }}</span>
              <span class="text-gray-500 text-xs">{{ lookupMeaning(item.word) }}</span>
            </div>
            <div class="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="barColor(idx)"
                :style="{ width: barWidth(item.video_count) + '%' }"
              ></div>
            </div>
          </div>

          <!-- Count -->
          <span class="text-gray-400 text-xs flex-shrink-0">{{ item.video_count }} 部</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getVocabStats } from '@/services/api.js'
import { VOCAB_LISTS } from '@/lib/vocabLists.js'
import { lookupMeaning } from '@/lib/lookup.js'

// ── Difficulty config ────────────────────────────────────────────────────────

const DIFFICULTY_LEVELS = [
  { key: 'all',          label: '全部',   activeClass: 'bg-gray-600 text-white' },
  { key: 'beginner',     label: '初階',   activeClass: 'bg-lime-700 text-white' },
  { key: 'intermediate', label: '中階',   activeClass: 'bg-blue-600 text-white' },
  { key: 'advanced',     label: '進階',   activeClass: 'bg-purple-600 text-white' },
]

// Mapping: list ID → difficulty key
const LIST_DIFFICULTY = {
  cefr_a:   'beginner',
  ngsl:     'intermediate',
  cefr_b1:  'intermediate',
  toeic:    'intermediate',
  bsl:      'intermediate',
  ielts:    'intermediate',
  coca:     'intermediate',
  cefr_c1:  'advanced',
  toefl:    'advanced',
  academic: 'advanced',
  advanced: 'advanced',
  opal:     'advanced',
}

// ── State ────────────────────────────────────────────────────────────────────

const loading        = ref(true)
const error          = ref(null)
const words          = ref([])
const siteStats      = ref(null)
const availableLists = ref(null)   // null = not yet loaded; [] = no data
const selectedList   = ref('ngsl')

// Read user's level from localStorage (same key used by homepage)
const userLevel = (() => {
  try { return localStorage.getItem('jolike_level') || 'intermediate' } catch { return 'intermediate' }
})()
const selectedDifficulty = ref(userLevel)

// ── Computed ─────────────────────────────────────────────────────────────────

const currentListMeta = computed(() => VOCAB_LISTS.find(l => l.id === selectedList.value))

// Lists that have data in video_vocab
const visibleLists = computed(() => {
  if (!availableLists.value) return VOCAB_LISTS
  if (availableLists.value.length === 0) return []
  return VOCAB_LISTS.filter(l => availableLists.value.includes(l.id))
})

// Lists filtered by selected difficulty AND having data
const levelFilteredLists = computed(() => {
  const base = visibleLists.value
  if (selectedDifficulty.value === 'all') return base
  return base.filter(l => LIST_DIFFICULTY[l.id] === selectedDifficulty.value)
})

// Difficulty levels that have at least one list with data
const visibleDifficultyLevels = computed(() => {
  if (!availableLists.value) return DIFFICULTY_LEVELS
  const available = availableLists.value
  if (available.length === 0) return []
  return DIFFICULTY_LEVELS.filter(lv => {
    if (lv.key === 'all') return true
    return available.some(id => LIST_DIFFICULTY[id] === lv.key)
  })
})

const maxCount = computed(() => words.value[0]?.video_count ?? 1)

// ── Helpers ──────────────────────────────────────────────────────────────────

function barWidth(count) {
  return Math.round((count / maxCount.value) * 100)
}

function barColor(idx) {
  if (idx === 0) return 'bg-yellow-500'
  if (idx === 1) return 'bg-gray-400'
  if (idx === 2) return 'bg-amber-700'
  if (idx < 10)  return 'bg-blue-600'
  return 'bg-gray-700'
}

// Pick the best default list for a given difficulty + available lists
function bestListForDifficulty(difficulty, available) {
  const candidates = VOCAB_LISTS
    .filter(l => available.includes(l.id))
    .filter(l => difficulty === 'all' || LIST_DIFFICULTY[l.id] === difficulty)
  return candidates[0]?.id ?? available[0]
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value = null
  try {
    const { words: w, stats, available_lists } = await getVocabStats(selectedList.value, 100)
    if (stats) siteStats.value = stats
    if (available_lists) {
      availableLists.value = available_lists

      // If current selection has no data or doesn't fit current difficulty, auto-switch
      const inDifficulty = selectedDifficulty.value === 'all'
        || LIST_DIFFICULTY[selectedList.value] === selectedDifficulty.value
      const hasData = available_lists.includes(selectedList.value)

      if (!hasData || !inDifficulty) {
        const best = bestListForDifficulty(selectedDifficulty.value, available_lists)
        if (best && best !== selectedList.value) {
          selectedList.value = best
          const retry = await getVocabStats(best, 100)
          words.value = retry.words ?? []
          return
        }
      }
    }
    words.value = w
  } catch {
    error.value = '載入失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}

function selectDifficulty(key) {
  selectedDifficulty.value = key
  // Switch to first available list in this difficulty
  if (availableLists.value) {
    const best = bestListForDifficulty(key, availableLists.value)
    if (best) {
      selectedList.value = best
      load()
      return
    }
  }
  // No lists available for this difficulty — just update UI, no API call
  words.value = []
}

function selectList(id) {
  selectedList.value = id
  load()
}

function openWord(word) {
  window.location.href = `/vocab-study/?list=${selectedList.value}&word=${encodeURIComponent(word)}`
}

function goHome() {
  window.location.href = '/'
}

onMounted(load)
</script>
