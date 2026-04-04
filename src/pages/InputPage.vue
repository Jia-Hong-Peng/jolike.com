<template>
  <div class="min-h-screen bg-black flex flex-col items-center justify-center px-6">
    <!-- Logo / Header -->
    <div class="mb-10 text-center">
      <h1 class="text-3xl font-bold text-white tracking-tight">JoLike English</h1>
      <p class="text-gray-400 mt-2 text-sm">貼上 YouTube 連結，開始學英文</p>
    </div>

    <!-- Input form -->
    <div class="w-full max-w-sm">
      <div class="relative">
        <input
          v-model="url"
          type="url"
          inputmode="url"
          placeholder="https://youtu.be/..."
          class="w-full bg-gray-900 text-white rounded-2xl px-5 py-4 text-base
                 border border-gray-700 focus:border-blue-500 focus:outline-none
                 placeholder-gray-500 transition-colors"
          :class="{ 'border-red-500': errorCode === 'INVALID_URL' }"
          @input="onInput"
          @keydown.enter="submit"
        />
      </div>

      <!-- Inline error -->
      <p
        v-if="errorCode"
        class="mt-2 text-sm text-red-400 px-1"
      >
        {{ errorMessage }}
      </p>

      <!-- Mode buttons -->
      <div class="mt-4 flex gap-3">
        <button
          class="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                 disabled:cursor-not-allowed text-white font-semibold rounded-2xl
                 py-4 text-sm transition-colors flex items-center justify-center gap-1.5
                 min-h-[56px]"
          :disabled="loading || !url.trim()"
          @click="submitWithMode('feed')"
        >
          <span v-if="loading && activeMode === 'feed'" class="animate-spin text-lg">⟳</span>
          <span v-else>📝</span>
          <span>詞彙學習</span>
        </button>
        <button
          class="flex-1 bg-teal-700 hover:bg-teal-600 disabled:bg-gray-700
                 disabled:cursor-not-allowed text-white font-semibold rounded-2xl
                 py-4 text-sm transition-colors flex items-center justify-center gap-1.5
                 min-h-[56px]"
          :disabled="loading || !url.trim()"
          @click="submitWithMode('shadow')"
        >
          <span v-if="loading && activeMode === 'shadow'" class="animate-spin text-lg">⟳</span>
          <span v-else>🎤</span>
          <span>跟讀模式</span>
        </button>
      </div>

      <!-- Retry hint for non-URL errors -->
      <button
        v-if="errorCode && errorCode !== 'INVALID_URL'"
        class="mt-3 w-full text-gray-400 text-sm underline"
        @click="retry"
      >
        重試
      </button>
    </div>

    <!-- Recent videos -->
    <div v-if="recentVideos.length > 0" class="w-full max-w-sm mt-10">
      <p class="text-gray-500 text-xs uppercase tracking-wider mb-3 px-1">最近學習</p>
      <ul class="space-y-2">
        <li
          v-for="v in recentVideos"
          :key="v.id"
          class="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-800 transition-colors"
          @click="() => (window.location.href = `/feed/?v=${v.id}`)"
        >
          <img
            :src="`https://img.youtube.com/vi/${v.id}/default.jpg`"
            :alt="v.title || v.id"
            class="w-14 h-10 object-cover rounded-lg flex-shrink-0 bg-gray-800"
            loading="lazy"
          />
          <div class="min-w-0 flex-1">
            <p class="text-white text-sm font-medium truncate">{{ v.title || v.id }}</p>
            <p class="text-gray-500 text-xs mt-0.5">{{ v.dateLabel }}</p>
          </div>
          <span class="text-gray-600 text-sm flex-shrink-0">▶</span>
        </li>
      </ul>
    </div>

    <!-- Bottom links -->
    <div class="mt-8 flex flex-col items-center gap-3">
      <a
        href="/library/"
        class="text-gray-400 text-sm hover:text-white transition-colors font-medium"
      >
        🎬 瀏覽影片庫
      </a>
      <a
        href="/progress/"
        class="text-gray-600 text-sm hover:text-gray-400 transition-colors"
      >
        查看詞彙進度 →
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { analyzeVideo, getErrorMessage } from '@/services/api.js'

const url = ref('')
const loading = ref(false)
const errorCode = ref(null)
const activeMode = ref('')  // 'feed' | 'shadow'

const errorMessage = computed(() => {
  return errorCode.value ? getErrorMessage(errorCode.value) : ''
})

function onInput() {
  if (errorCode.value && errorCode.value !== 'INVALID_URL') {
    errorCode.value = null
  }
}

function isYouTubeUrl(val) {
  return /youtube\.com\/watch|youtu\.be\//.test(val)
}

async function submitWithMode(mode) {
  if (loading.value) return
  const trimmedUrl = url.value.trim()
  if (!trimmedUrl) return

  if (!isYouTubeUrl(trimmedUrl)) {
    errorCode.value = 'INVALID_URL'
    return
  }

  const dest = mode === 'shadow' ? '/shadow/' : '/feed/'

  const cachedId = getCachedVideoId(trimmedUrl)
  if (cachedId) {
    saveRecentVideo(cachedId, null)
    window.location.href = `${dest}?v=${cachedId}`
    return
  }

  loading.value = true
  activeMode.value = mode
  errorCode.value = null

  try {
    const data = await analyzeVideo(trimmedUrl)
    saveRecentVideo(data.video.id, data.video.title)
    window.location.href = `${dest}?v=${data.video.id}`
  } catch (err) {
    errorCode.value = err.error || 'ANALYSIS_FAILED'
    loading.value = false
    activeMode.value = ''
  }
}

function retry() {
  errorCode.value = null
  submitWithMode('feed')
}

function getCachedVideoId(youtubeUrl) {
  try {
    const match = youtubeUrl.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    if (!match) return null
    const videoId = match[1]
    const raw = localStorage.getItem(`jolike_session_${videoId}`)
    if (!raw) return null
    const session = JSON.parse(raw)
    return session.videoId === videoId ? videoId : null
  } catch {
    return null
  }
}

// ── Recent videos ─────────────────────────────────────────────────────────────
const RECENT_KEY = 'jolike_recent_videos'

function saveRecentVideo(id, title) {
  try {
    const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    const filtered = existing.filter(v => v.id !== id)
    const updated = [{ id, title, ts: Date.now() }, ...filtered].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch { /* storage full */ }
}

function formatDateLabel(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86400_000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return new Date(ts).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

const recentVideos = computed(() => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return raw.map(v => ({ ...v, dateLabel: formatDateLabel(v.ts) }))
  } catch {
    return []
  }
})
</script>
