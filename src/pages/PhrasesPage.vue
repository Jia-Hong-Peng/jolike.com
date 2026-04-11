<template>
  <div class="min-h-screen bg-black text-white flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
      <button @click="goBack" class="text-gray-400 min-h-[44px] min-w-[44px] flex items-center">
        ← 返回
      </button>
      <h1 class="font-bold text-base">高頻短語 Top 100</h1>
      <div class="w-16"></div>
    </header>

    <!-- Intro banner -->
    <div class="px-4 py-3 bg-gray-900 border-b border-gray-800 text-sm text-gray-400">
      從真實 YouTube 影片中統計出最常出現的英文短語。跟著唸就對了。
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="space-y-3 w-full max-w-lg px-4">
        <div v-for="i in 8" :key="i"
          class="h-16 bg-gray-800 rounded-xl animate-pulse"></div>
      </div>
    </div>

    <!-- Empty (no data indexed yet) -->
    <div v-else-if="!loading && phrases.length === 0"
      class="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p class="text-4xl">🔍</p>
      <p class="text-white font-semibold">短語資料收集中</p>
      <p class="text-gray-500 text-sm">需要先執行 index-phrases.mjs 建立索引</p>
    </div>

    <!-- Phrase list -->
    <main v-else class="flex-1 overflow-y-auto">
      <ul class="divide-y divide-gray-800/50">
        <li v-for="(item, idx) in phrases" :key="item.phrase"
          class="px-4 py-4 active:bg-gray-900 transition-colors">
          <!-- Rank + phrase -->
          <div class="flex items-start gap-3">
            <span class="text-gray-600 text-sm font-mono w-7 pt-0.5 flex-shrink-0">
              {{ offset + idx + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <!-- Phrase text -->
              <p class="text-white font-semibold text-base leading-snug">
                {{ item.phrase }}
              </p>

              <!-- Frequency badge -->
              <p class="text-gray-500 text-xs mt-0.5">
                出現在 <span class="text-blue-400">{{ item.video_count }}</span> 支影片
              </p>

              <!-- Example sentence -->
              <p v-if="item.example_text"
                class="text-gray-400 text-sm mt-2 leading-relaxed italic">
                "{{ highlightPhrase(item.example_text, item.phrase) }}"
              </p>

              <!-- Action buttons -->
              <div v-if="item.example_video_id" class="flex gap-2 mt-3">
                <!-- Play in YouTube -->
                <a :href="youtubeUrl(item)" target="_blank" rel="noopener"
                  class="flex items-center gap-1.5 bg-red-600/20 text-red-400 border border-red-600/30
                         px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px]">
                  ▶ 播放片段
                </a>
                <!-- Practice (shadowing) -->
                <button
                  @click="openShadow(item)"
                  class="flex items-center gap-1.5 bg-blue-600/20 text-blue-400 border border-blue-600/30
                         px-3 py-1.5 rounded-lg text-xs font-medium min-h-[36px]">
                  🎤 跟著唸
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>

      <!-- Load more -->
      <div v-if="hasMore" class="px-4 py-6 flex justify-center">
        <button
          @click="loadMore"
          :disabled="loadingMore"
          class="bg-gray-800 text-gray-300 px-8 py-3 rounded-xl font-medium min-h-[44px]
                 disabled:opacity-50">
          {{ loadingMore ? '載入中…' : '載入更多' }}
        </button>
      </div>
      <div class="h-8"></div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getPhraseStats } from '@/services/api.js'

const phrases    = ref([])
const loading    = ref(true)
const loadingMore = ref(false)
const hasMore    = ref(false)
const offset     = ref(0)
const PAGE       = 100

async function load(reset = true) {
  if (reset) {
    loading.value = true
    phrases.value = []
    offset.value = 0
  } else {
    loadingMore.value = true
  }

  try {
    const { phrases: p, has_more } = await getPhraseStats({
      limit: PAGE,
      offset: offset.value,
      minVideos: 3,
    })
    if (reset) {
      phrases.value = p
    } else {
      phrases.value.push(...p)
    }
    hasMore.value = has_more
    offset.value += p.length
  } catch (e) {
    console.error('phrase-stats error:', e)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadMore() {
  await load(false)
}

function youtubeUrl(item) {
  const t = Math.max(0, Math.floor((item.example_start || 0) - 2))
  return `https://www.youtube.com/watch?v=${item.example_video_id}&t=${t}s`
}

function openShadow(item) {
  const t = Math.max(0, Math.floor((item.example_start || 0) - 2))
  window.location.href = `/shadow/?v=${item.example_video_id}&t=${t}`
}

function highlightPhrase(text, _phrase) {
  // Return the example text with the phrase noted (plain text; keep simple)
  return text.length > 120 ? text.slice(0, 120) + '…' : text
}

function goBack() {
  window.history.length > 1 ? window.history.back() : (window.location.href = '/')
}

onMounted(load)
</script>
