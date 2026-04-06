<template>
  <div class="min-h-screen bg-black flex flex-col items-center justify-center px-6">
    <!-- Due-review banner -->
    <div
      v-if="dueCount > 0"
      class="w-full max-w-sm mb-6 bg-yellow-900/60 border border-yellow-700 rounded-2xl px-4 py-3
             flex items-center gap-3 cursor-pointer hover:bg-yellow-900/80 transition-colors"
      @click="() => (window.location.href = '/review/')"
    >
      <span class="text-xl flex-shrink-0">🔔</span>
      <div class="flex-1 min-w-0">
        <p class="text-yellow-300 font-semibold text-sm">今日有 {{ dueCount }} 個單字待複習</p>
        <p class="text-yellow-500 text-xs mt-0.5">點此開始複習，鞏固記憶</p>
      </div>
      <span class="text-yellow-500 text-sm flex-shrink-0">→</span>
    </div>

    <!-- Logo / Header -->
    <div class="mb-10 text-center">
      <h1 class="text-3xl font-bold text-white tracking-tight">JoLike English</h1>
      <p class="text-gray-400 mt-2 text-sm">貼上 YouTube 連結，開始學英文</p>
      <!-- Streak badge (shown when streak ≥ 1) -->
      <div
        v-if="streak > 0"
        class="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-sm font-semibold"
        :class="streak >= 7 ? 'bg-orange-900/60 text-orange-300 border border-orange-800' : 'bg-gray-900 text-yellow-400'"
      >
        🔥 {{ streak }} 天連續學習
      </div>
    </div>

    <!-- Level selector -->
    <div class="w-full max-w-sm mb-5">
      <p class="text-gray-500 text-xs text-center mb-2">我的英文程度</p>
      <div class="flex gap-2 bg-gray-900 rounded-2xl p-1.5">
        <button
          v-for="lv in LEVELS"
          :key="lv.key"
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px]"
          :class="level === lv.key
            ? lv.activeClass
            : 'text-gray-500 hover:text-gray-300'"
          :title="lv.desc"
          @click="setLevel(lv.key)"
        >
          {{ lv.label }}
        </button>
      </div>
      <p class="text-gray-600 text-xs text-center mt-1.5">{{ currentLevelDesc }}</p>
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
          @keydown.enter="submitWithMode('feed')"
        />
      </div>

      <!-- Inline error / pending state -->
      <div v-if="errorCode === 'TRANSCRIPT_PENDING'" class="mt-2 px-1 flex items-center gap-2">
        <span class="animate-spin text-blue-400 text-sm">⟳</span>
        <span class="text-sm text-blue-400">字幕準備中，自動偵測完成後直接開啟…</span>
      </div>
      <p
        v-else-if="errorCode"
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
          :disabled="loading || !url.trim() || errorCode === 'NO_CAPTIONS'"
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
          :disabled="loading || !url.trim() || errorCode === 'NO_CAPTIONS'"
          @click="submitWithMode('shadow')"
        >
          <span v-if="loading && activeMode === 'shadow'" class="animate-spin text-lg">⟳</span>
          <span v-else>🎤</span>
          <span>跟讀模式</span>
        </button>
      </div>

      <!-- Retry hint: only for transient errors, not NO_CAPTIONS or TRANSCRIPT_PENDING -->
      <button
        v-if="errorCode && errorCode !== 'INVALID_URL' && errorCode !== 'NO_CAPTIONS' && errorCode !== 'TRANSCRIPT_PENDING'"
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
          class="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-800 transition-colors active:bg-gray-700"
          @click="openRecentVideo(v)"
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

    <!-- Mode picker for recent videos -->
    <teleport to="body">
      <div
        v-if="modePickerVideo"
        class="fixed inset-0 z-50 flex items-end justify-center"
        @click.self="modePickerVideo = null"
      >
        <div class="absolute inset-0 bg-black/60" @click="modePickerVideo = null"></div>
        <div class="relative w-full max-w-sm bg-gray-900 rounded-t-3xl px-5 pt-5 pb-8 space-y-4">
          <div class="flex gap-3 items-center">
            <img
              :src="`https://img.youtube.com/vi/${modePickerVideo.id}/default.jpg`"
              :alt="modePickerVideo.title"
              class="w-16 h-11 object-cover rounded-lg bg-gray-800 flex-shrink-0"
            />
            <p class="text-white text-sm font-semibold leading-snug line-clamp-2">{{ modePickerVideo.title || modePickerVideo.id }}</p>
          </div>
          <p class="text-gray-400 text-xs text-center">選擇學習模式</p>
          <div class="flex gap-3">
            <button
              class="flex-1 bg-blue-600 text-white py-3.5 rounded-2xl font-semibold text-sm min-h-[52px]
                     hover:bg-blue-500 transition-colors flex flex-col items-center gap-0.5"
              @click="goRecentWithMode('feed')"
            >
              <span class="text-xl">📝</span>
              <span>詞彙學習</span>
            </button>
            <button
              class="flex-1 bg-teal-700 text-white py-3.5 rounded-2xl font-semibold text-sm min-h-[52px]
                     hover:bg-teal-600 transition-colors flex flex-col items-center gap-0.5"
              @click="goRecentWithMode('shadow')"
            >
              <span class="text-xl">🎤</span>
              <span>跟讀模式</span>
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Try with example video -->
    <div v-if="recentVideos.length === 0" class="w-full max-w-sm mt-8">
      <p class="text-gray-500 text-xs uppercase tracking-wider mb-3 px-1">沒有影片可以貼？試試這個</p>
      <button
        class="w-full bg-gray-900 hover:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-3 transition-colors active:bg-gray-700 text-left"
        @click="tryExample"
      >
        <img
          src="https://img.youtube.com/vi/arj7oStGLkU/default.jpg"
          alt="TED Talk 示範"
          class="w-14 h-10 object-cover rounded-lg flex-shrink-0 bg-gray-800"
          loading="lazy"
        />
        <div class="min-w-0 flex-1">
          <p class="text-white text-sm font-medium truncate">TED: Do schools kill creativity?</p>
          <p class="text-gray-500 text-xs mt-0.5">Ken Robinson · 示範影片</p>
        </div>
        <span class="text-blue-400 text-xs flex-shrink-0">試試看 →</span>
      </button>
    </div>

    <!-- Bottom links -->
    <div class="mt-8 flex flex-col items-center gap-3">
      <a
        href="/vocab-study/"
        class="text-white text-sm hover:text-blue-400 transition-colors font-semibold
               bg-gray-900 border border-gray-700 px-5 py-2.5 rounded-2xl flex items-center gap-2"
      >
        📝 多益 / 雅思 / 托福 詞彙清單
      </a>
      <a
        href="/library/"
        class="text-gray-400 text-sm hover:text-white transition-colors font-medium"
      >
        🎬 瀏覽影片庫
      </a>
      <a
        href="/vocab-stats/"
        class="text-gray-400 text-sm hover:text-white transition-colors font-medium"
      >
        📊 全站單字排行榜
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
import { ref, computed, onUnmounted } from 'vue'
import { analyzeVideo, getErrorMessage } from '@/services/api.js'
import { getDue, getStreak } from '@/composables/useSRS.js'

const LEVELS = [
  {
    key: 'beginner',
    label: '初級',
    desc: '顯示所有詞彙，含 A1/A2 基礎單字',
    activeClass: 'bg-green-700 text-white shadow',
  },
  {
    key: 'intermediate',
    label: '中級',
    desc: 'B2+ 學術詞彙，適合 IELTS/TOEFL 備考（推薦）',
    activeClass: 'bg-blue-600 text-white shadow',
  },
  {
    key: 'advanced',
    label: '進階',
    desc: 'C1+ 高階術語，適合已流利或衝高分者',
    activeClass: 'bg-purple-700 text-white shadow',
  },
]

const LEVEL_KEY = 'jolike_level'
const level = ref(localStorage.getItem(LEVEL_KEY) || 'intermediate')
const currentLevelDesc = computed(() => LEVELS.find(l => l.key === level.value)?.desc ?? '')

function setLevel(key) {
  level.value = key
  localStorage.setItem(LEVEL_KEY, key)
}

const url = ref('')
const loading = ref(false)
const errorCode = ref(null)
const activeMode = ref('')   // 'feed' | 'shadow'
const lastMode  = ref('feed') // preserved across error for retry()
const dueCount = computed(() => getDue().length)
const streak = computed(() => getStreak().streak)

let pollTimer = null
function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}
onUnmounted(stopPoll)

function startPoll(trimmedUrl, dest) {
  stopPoll()
  let attempts = 0
  pollTimer = setInterval(async () => {
    attempts++
    if (attempts > 8) { stopPoll(); return } // give up after ~4 min
    try {
      const data = await analyzeVideo(trimmedUrl)
      stopPoll()
      errorCode.value = null
      saveRecentVideo(data.video.id, data.video.title)
      window.location.href = `${dest}?v=${data.video.id}`
    } catch (err) {
      if (err.error !== 'TRANSCRIPT_PENDING') {
        stopPoll()
        errorCode.value = err.error || 'ANALYSIS_FAILED'
      }
      // else keep polling
    }
  }, 30000)
}

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
  lastMode.value  = mode   // save for retry()
  errorCode.value = null

  try {
    const data = await analyzeVideo(trimmedUrl)
    stopPoll()
    saveRecentVideo(data.video.id, data.video.title)
    window.location.href = `${dest}?v=${data.video.id}`
  } catch (err) {
    errorCode.value = err.error || 'ANALYSIS_FAILED'
    loading.value = false
    activeMode.value = ''
    if (err.error === 'TRANSCRIPT_PENDING') {
      startPoll(trimmedUrl, dest)
    }
  }
}

function retry() {
  errorCode.value = null
  submitWithMode(lastMode.value)
}

function tryExample() {
  url.value = 'https://www.youtube.com/watch?v=arj7oStGLkU'
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

// ── Recent video mode picker ──────────────────────────────────────────────────
const modePickerVideo = ref(null)

function openRecentVideo(v) {
  modePickerVideo.value = v
}

function goRecentWithMode(mode) {
  if (!modePickerVideo.value) return
  const dest = mode === 'shadow' ? '/shadow/' : '/feed/'
  window.location.href = `${dest}?v=${modePickerVideo.value.id}`
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
