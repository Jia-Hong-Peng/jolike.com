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

      <!-- Submit button -->
      <button
        class="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
               disabled:cursor-not-allowed text-white font-semibold rounded-2xl
               py-4 text-base transition-colors flex items-center justify-center gap-2
               min-h-[56px]"
        :disabled="loading || !url.trim()"
        @click="submit"
      >
        <span v-if="loading" class="animate-spin text-lg">⟳</span>
        <span v-else>開始學習</span>
      </button>

      <!-- Retry hint for non-URL errors -->
      <button
        v-if="errorCode && errorCode !== 'INVALID_URL'"
        class="mt-3 w-full text-gray-400 text-sm underline"
        @click="retry"
      >
        重試
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { analyzeVideo, getErrorMessage } from '@/services/api.js'

const url = ref('')
const loading = ref(false)
const errorCode = ref(null)

const errorMessage = computed(() => {
  return errorCode.value ? getErrorMessage(errorCode.value) : ''
})

function onInput() {
  // Clear error when user edits (except show INVALID_URL immediately)
  if (errorCode.value && errorCode.value !== 'INVALID_URL') {
    errorCode.value = null
  }
}

// Basic YouTube URL check (inline validation before API call)
function isYouTubeUrl(val) {
  return /youtube\.com\/watch|youtu\.be\//.test(val)
}

async function submit() {
  if (loading.value) return
  const trimmedUrl = url.value.trim()

  if (!trimmedUrl) return

  if (!isYouTubeUrl(trimmedUrl)) {
    errorCode.value = 'INVALID_URL'
    return
  }

  // Check localStorage cache: skip POST if already analyzed
  const cachedId = getCachedVideoId(trimmedUrl)
  if (cachedId) {
    window.location.href = `/feed/?v=${cachedId}`
    return
  }

  loading.value = true
  errorCode.value = null

  try {
    const data = await analyzeVideo(trimmedUrl)
    window.location.href = `/feed/?v=${data.video.id}`
  } catch (err) {
    errorCode.value = err.error || 'ANALYSIS_FAILED'
    loading.value = false
  }
}

function retry() {
  errorCode.value = null
  submit()
}

/**
 * Check if this URL was already analyzed (localStorage cache).
 * Returns videoId if cached, null otherwise.
 */
function getCachedVideoId(youtubeUrl) {
  try {
    const match = youtubeUrl.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    if (!match) return null
    const videoId = match[1]
    const key = `jolike_session_${videoId}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const session = JSON.parse(raw)
    return session.videoId === videoId ? videoId : null
  } catch {
    return null
  }
}
</script>
