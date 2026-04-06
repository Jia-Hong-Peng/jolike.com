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

    <!-- List picker -->
    <div class="px-4 pt-5 pb-3">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="list in VOCAB_LISTS"
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

    <!-- Empty -->
    <div v-else-if="words.length === 0" class="flex flex-col items-center py-24 gap-3 px-8 text-center">
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

const loading      = ref(true)
const error        = ref(null)
const words        = ref([])
const siteStats    = ref(null)
const selectedList = ref('coca')

const currentListMeta = computed(() => VOCAB_LISTS.find(l => l.id === selectedList.value))

const maxCount = computed(() => words.value[0]?.video_count ?? 1)

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

async function load() {
  loading.value = true
  error.value = null
  try {
    const { words: w, stats } = await getVocabStats(selectedList.value, 100)
    words.value = w
    if (stats) siteStats.value = stats
  } catch {
    error.value = '載入失敗，請稍後再試'
  } finally {
    loading.value = false
  }
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
