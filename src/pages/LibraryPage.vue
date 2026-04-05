<template>
  <div class="min-h-screen bg-black text-white pb-10">
    <!-- Header -->
    <div class="sticky top-0 z-20 bg-black/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <button
        class="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center
               rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        @click="goHome"
      >
        ←
      </button>
      <h1 class="text-lg font-bold flex-1">影片庫</h1>
      <span class="text-gray-500 text-sm">{{ videos.length }} 部影片</span>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="px-4 pt-6 grid grid-cols-2 gap-3">
      <div v-for="i in 6" :key="i" class="bg-gray-900 rounded-2xl overflow-hidden animate-pulse">
        <div class="h-24 bg-gray-800"></div>
        <div class="p-3 space-y-2">
          <div class="h-3 bg-gray-700 rounded w-full"></div>
          <div class="h-3 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 gap-4 px-8 text-center">
      <p class="text-red-400">{{ error }}</p>
      <button
        class="bg-gray-700 text-white px-6 py-3 rounded-2xl min-h-[44px]"
        @click="loadVideos"
      >
        重試
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="videos.length === 0" class="flex flex-col items-center justify-center py-24 gap-4 px-8 text-center">
      <p class="text-5xl">🎬</p>
      <p class="text-white text-lg font-semibold">還沒有影片</p>
      <p class="text-gray-500 text-sm">貼上 YouTube 連結並成功分析後，影片會自動出現在這裡</p>
      <button
        class="mt-2 bg-blue-600 text-white px-8 py-3 rounded-2xl font-semibold min-h-[48px]"
        @click="goHome"
      >
        去貼連結
      </button>
    </div>

    <!-- Video grid -->
    <div v-else class="px-4 pt-5 grid grid-cols-2 gap-3">
      <div
        v-for="video in videos"
        :key="video.id"
        class="relative bg-gray-900 rounded-2xl overflow-hidden cursor-pointer
               hover:bg-gray-800 transition-colors active:scale-95"
        @click="openVideo(video)"
      >
        <!-- Thumbnail -->
        <div class="relative">
          <img
            :src="`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`"
            :alt="video.title || video.id"
            class="w-full aspect-video object-cover bg-gray-800"
            loading="lazy"
          />
          <!-- Duration badge -->
          <span
            v-if="video.duration_seconds"
            class="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono"
          >
            {{ formatDuration(video.duration_seconds) }}
          </span>
          <!-- Admin delete button -->
          <button
            v-if="isAdmin"
            class="absolute top-1.5 right-1.5 bg-red-900/80 text-red-300 rounded-full
                   w-7 h-7 flex items-center justify-center text-xs z-10
                   hover:bg-red-800 transition-colors"
            title="刪除"
            @click.stop="confirmDelete(video)"
          >
            ✕
          </button>
        </div>

        <!-- Info -->
        <div class="p-2.5">
          <p class="text-white text-xs font-medium leading-snug line-clamp-2">
            {{ video.title || video.id }}
          </p>
          <div class="flex items-center gap-2 mt-1">
            <p class="text-gray-600 text-xs">{{ formatDate(video.analyzed_at) }}</p>
            <span
              v-if="learnedCount(video.id) > 0"
              class="text-xs text-teal-400 font-medium"
            >已學 {{ learnedCount(video.id) }} 詞</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Load more -->
    <div v-if="hasMore && !loading" class="flex justify-center pt-6 px-4">
      <button
        class="w-full max-w-xs bg-gray-800 text-gray-300 py-3 rounded-2xl font-medium min-h-[44px]
               hover:bg-gray-700 transition-colors"
        :disabled="loadingMore"
        @click="loadMore"
      >
        <span v-if="loadingMore" class="animate-spin inline-block mr-2">⟳</span>
        {{ loadingMore ? '載入中…' : '載入更多' }}
      </button>
    </div>

    <!-- Mode picker modal -->
    <teleport to="body">
      <div
        v-if="selectedVideo"
        class="fixed inset-0 z-50 flex items-end justify-center"
        @click.self="selectedVideo = null"
      >
        <div class="absolute inset-0 bg-black/60"></div>
        <div class="relative w-full max-w-sm bg-gray-900 rounded-t-3xl px-5 pt-5 pb-8 space-y-4">
          <!-- Video info -->
          <div class="flex gap-3 items-start">
            <img
              :src="`https://img.youtube.com/vi/${selectedVideo.id}/default.jpg`"
              :alt="selectedVideo.title"
              class="w-20 h-14 object-cover rounded-lg bg-gray-800 flex-shrink-0"
            />
            <div class="min-w-0">
              <p class="text-white text-sm font-semibold leading-snug line-clamp-2">{{ selectedVideo.title || selectedVideo.id }}</p>
              <p class="text-gray-500 text-xs mt-1">{{ formatDuration(selectedVideo.duration_seconds) }}</p>
            </div>
          </div>

          <p class="text-gray-400 text-xs text-center">選擇學習模式</p>

          <div class="flex gap-3">
            <button
              class="flex-1 bg-blue-600 text-white py-3.5 rounded-2xl font-semibold text-sm min-h-[52px]
                     hover:bg-blue-500 transition-colors flex flex-col items-center gap-0.5"
              @click="goToMode('feed')"
            >
              <span class="text-xl">📝</span>
              <span>詞彙學習</span>
            </button>
            <button
              class="flex-1 bg-teal-700 text-white py-3.5 rounded-2xl font-semibold text-sm min-h-[52px]
                     hover:bg-teal-600 transition-colors flex flex-col items-center gap-0.5"
              @click="goToMode('shadow')"
            >
              <span class="text-xl">🎤</span>
              <span>跟讀模式</span>
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Delete confirm modal -->
    <teleport to="body">
      <div
        v-if="deletingVideo"
        class="fixed inset-0 z-50 flex items-center justify-center px-6"
        @click.self="deletingVideo = null"
      >
        <div class="absolute inset-0 bg-black/70"></div>
        <div class="relative w-full max-w-xs bg-gray-900 rounded-2xl px-5 py-6 space-y-4 text-center">
          <p class="text-white font-semibold">確定刪除此影片？</p>
          <p class="text-gray-400 text-sm line-clamp-2">{{ deletingVideo.title || deletingVideo.id }}</p>
          <p class="text-gray-600 text-xs">影片字幕快取保留，僅從影片庫移除</p>
          <div class="flex gap-3 pt-1">
            <button
              class="flex-1 bg-gray-700 text-gray-300 py-3 rounded-xl min-h-[44px]"
              @click="deletingVideo = null"
            >
              取消
            </button>
            <button
              class="flex-1 bg-red-700 text-white py-3 rounded-xl font-semibold min-h-[44px]
                     hover:bg-red-600 transition-colors disabled:opacity-50"
              :disabled="deleteLoading"
              @click="executeDelete"
            >
              <span v-if="deleteLoading" class="animate-spin inline-block mr-1">⟳</span>
              刪除
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getLibrary, deleteLibraryVideo } from '@/services/api.js'

const SRS_PREFIX = 'jolike_srs_'

function learnedCount(videoId) {
  let count = 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(SRS_PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(k) || '{}')
      if (entry.videoId === videoId) count++
    } catch { /* skip */ }
  }
  return count
}

const ADMIN_KEY = 'jolike_admin_token'
const PAGE_SIZE = 50

const loading     = ref(true)
const loadingMore = ref(false)
const error       = ref(null)
const videos      = ref([])
const offset      = ref(0)
const hasMore     = ref(false)

const selectedVideo = ref(null)
const deletingVideo = ref(null)
const deleteLoading = ref(false)

// ── Admin token: stored in localStorage after URL param ───────────────────────
const adminToken = ref('')

const isAdmin = computed(() => !!adminToken.value)

onMounted(async () => {
  // Check URL for admin token, persist it
  const params = new URLSearchParams(window.location.search)
  const urlToken = params.get('admin')
  if (urlToken) {
    localStorage.setItem(ADMIN_KEY, urlToken)
    // Clean token from URL without reload
    const clean = window.location.pathname
    window.history.replaceState({}, '', clean)
  }
  adminToken.value = localStorage.getItem(ADMIN_KEY) || ''

  await loadVideos()
})

async function loadVideos() {
  loading.value = true
  error.value = null
  try {
    const data = await getLibrary({ limit: PAGE_SIZE, offset: 0 })
    videos.value = data.videos
    offset.value = data.videos.length
    hasMore.value = data.videos.length === PAGE_SIZE
  } catch (err) {
    error.value = err.message || '載入失敗'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    const data = await getLibrary({ limit: PAGE_SIZE, offset: offset.value })
    videos.value = [...videos.value, ...data.videos]
    offset.value += data.videos.length
    hasMore.value = data.videos.length === PAGE_SIZE
  } catch {
    // fail silently, user can retry
  } finally {
    loadingMore.value = false
  }
}

// ── Video selection ───────────────────────────────────────────────────────────
function openVideo(video) {
  selectedVideo.value = video
}

function goToMode(mode) {
  if (!selectedVideo.value) return
  const dest = mode === 'shadow' ? '/shadow/' : '/feed/'
  window.location.href = `${dest}?v=${selectedVideo.value.id}`
}

// ── Admin delete ──────────────────────────────────────────────────────────────
function confirmDelete(video) {
  deletingVideo.value = video
}

async function executeDelete() {
  if (!deletingVideo.value || deleteLoading.value) return
  deleteLoading.value = true
  try {
    await deleteLibraryVideo(deletingVideo.value.id, adminToken.value)
    videos.value = videos.value.filter(v => v.id !== deletingVideo.value.id)
    deletingVideo.value = null
  } catch (err) {
    alert(err.message || '刪除失敗')
  } finally {
    deleteLoading.value = false
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(unixTs) {
  if (!unixTs) return ''
  const diff = Math.floor(Date.now() / 1000) - unixTs
  const days = Math.floor(diff / 86400)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return new Date(unixTs * 1000).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

function goHome() {
  window.location.href = '/'
}
</script>
