<template>
  <div class="min-h-screen bg-black text-white flex flex-col">
    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
      <div class="w-full max-w-sm space-y-3">
        <div class="h-48 bg-gray-800 rounded-2xl animate-pulse"></div>
        <div class="h-6 bg-gray-800 rounded animate-pulse w-2/3"></div>
        <div class="h-5 bg-gray-800 rounded animate-pulse w-1/2"></div>
      </div>
      <p class="text-gray-500 text-sm">載入字幕中…</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <p class="text-red-400 text-center">{{ error }}</p>
      <button
        class="bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold min-h-[44px]"
        @click="goHome"
      >
        換影片
      </button>
    </div>

    <!-- Completion state -->
    <div v-else-if="isComplete" class="flex flex-col items-center justify-center min-h-screen gap-6 px-8 text-center">
      <p class="text-5xl">🎤</p>
      <p class="text-white text-xl font-bold">跟讀完成！</p>
      <p class="text-gray-400 text-sm">共 {{ segments.length }} 句，完成跟讀練習</p>
      <button
        class="w-full max-w-xs bg-blue-600 text-white py-4 rounded-2xl font-semibold text-lg min-h-[56px]"
        @click="restart"
      >
        再跟讀一次
      </button>
      <button
        class="w-full max-w-xs bg-gray-700 text-gray-300 py-3 rounded-2xl font-semibold min-h-[48px]"
        @click="goHome"
      >
        換影片
      </button>
    </div>

    <!-- Main shadowing UI -->
    <template v-else-if="currentSegment">
      <!-- Top bar -->
      <div class="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button
          class="text-gray-400 text-sm min-h-[44px] min-w-[44px] flex items-center"
          @click="goHome"
        >
          ← 離開
        </button>
        <span class="text-sm text-gray-500">{{ currentIdx + 1 }} / {{ segments.length }}</span>
        <span class="min-w-[4rem]"></span>
      </div>

      <!-- Progress bar -->
      <div class="h-0.5 bg-gray-800 flex-shrink-0">
        <div
          class="h-full bg-blue-500 transition-all duration-300"
          :style="{ width: progressPct + '%' }"
        ></div>
      </div>

      <!-- Video clip — capped height so buttons stay visible, click to replay -->
      <div
        class="relative w-full flex-shrink-0 bg-black overflow-hidden cursor-pointer"
        style="height: min(56.25vw, 46vh)"
        @click="replayClip"
      >
        <VideoClip
          ref="videoRef"
          :key="autoplay ? videoId : currentIdx"
          :video-id="videoId"
          :start="clipStart"
          :end="clipEnd"
          :hide-controls="true"
          :seamless="autoplay"
          :playback-rate="slowMode ? 0.7 : 1.0"
          @ended="onClipEnded"
        />

        <!-- Subtitle overlay at bottom of video -->
        <div
class="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-10
                    bg-gradient-to-t from-black/85 to-transparent pointer-events-none z-20"
>
          <!-- Chinese translation -->
          <p v-if="currentZh" class="text-yellow-300 text-sm text-center leading-snug mb-1 drop-shadow">
            {{ currentZh }}
          </p>
          <!-- English subtitle -->
          <p class="text-white text-base font-semibold leading-snug text-center drop-shadow">
            {{ currentSegment.text }}
          </p>
        </div>

        <!-- Loop badge top-right -->
        <div
          v-if="looping"
          class="absolute top-2 right-2 z-30 bg-teal-600/90 text-white text-xs
                 font-semibold px-2.5 py-1 rounded-full"
        >
          🔁 循環
        </div>
      </div>

      <!-- Word chips — tap to save to review -->
      <div class="px-4 pt-3 pb-1 flex-shrink-0">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="token in segmentTokens"
            :key="token.word + token.idx"
            class="px-2.5 py-1 rounded-full text-sm font-medium transition-colors min-h-[32px]"
            :class="savedWords.has(token.word)
              ? 'bg-orange-600 text-white'
              : knownWords.has(token.word)
              ? 'border border-blue-500 bg-gray-900 text-blue-400'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 active:bg-gray-600'"
            @click.stop="tapWord(token.word)"
          >
            {{ token.display }}
          </button>
        </div>
        <p class="text-gray-700 text-xs mt-1.5">點單字儲存到複習</p>
      </div>

      <!-- Action area -->
      <div class="px-4 pt-2 pb-6 flex-shrink-0 space-y-2.5">
        <!-- Top controls: Replay | Slow | Loop | 連播 -->
        <div class="flex gap-2">
          <!-- Replay -->
          <button
            class="flex-1 bg-gray-800 text-white py-3 rounded-2xl font-semibold
                   text-sm min-h-[48px] hover:bg-gray-700 transition-colors
                   flex items-center justify-center gap-1"
            @click="replayClip"
          >
            <span>↺</span>
            <span>重播</span>
          </button>
          <!-- Slow speed -->
          <button
            class="flex-1 py-3 rounded-2xl font-semibold text-sm min-h-[48px]
                   flex items-center justify-center gap-1 transition-colors"
            :class="slowMode
              ? 'bg-teal-700 text-white hover:bg-teal-600'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
            title="慢速播放 0.7x"
            @click="slowMode = !slowMode"
          >
            <span>🐢</span>
            <span>{{ slowMode ? '0.7x' : '慢速' }}</span>
          </button>
          <!-- Loop -->
          <button
            class="flex-1 py-3 rounded-2xl font-semibold text-sm min-h-[48px]
                   flex items-center justify-center gap-1 transition-colors"
            :class="looping
              ? 'bg-blue-800 text-white hover:bg-blue-700'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
            @click="toggleLoop"
          >
            <span>🔁</span>
            <span>{{ looping ? '停止' : '循環' }}</span>
          </button>
          <!-- Auto-play -->
          <button
            class="flex-1 py-3 rounded-2xl font-semibold text-sm min-h-[48px]
                   flex items-center justify-center gap-1 transition-colors"
            :class="autoplay
              ? 'bg-blue-700 text-white hover:bg-blue-600'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
            @click="toggleAutoplay"
          >
            <span>▶▶</span>
            <span>{{ autoplay ? '停止' : '連播' }}</span>
          </button>
        </div>
        <div class="flex gap-2.5">
          <button
            class="flex-1 bg-gray-900 text-gray-400 py-3 rounded-2xl font-semibold
                   text-sm min-h-[48px] disabled:opacity-30 transition-colors hover:bg-gray-800"
            :disabled="currentIdx === 0"
            @click="prev"
          >
            ← 上一句
          </button>
          <button
            class="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-semibold
                   text-sm min-h-[48px] hover:bg-blue-500 transition-colors"
            @click="next"
          >
            {{ currentIdx === segments.length - 1 ? '完成 ✓' : '下一句 →' }}
          </button>
        </div>
        <p class="text-center text-gray-700 text-xs pt-0.5">
          點影片重播 &nbsp;·&nbsp; Space / L / ← →
        </p>
      </div>
    </template>

    <!-- Toast -->
    <transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-32 left-1/2 -translate-x-1/2 bg-gray-800 text-white
               px-4 py-2 rounded-xl text-sm shadow-lg z-50 whitespace-nowrap max-w-xs text-center"
      >
        {{ toast }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import VideoClip from '@/components/VideoClip.vue'
import { getVideo } from '@/services/api.js'
import { lookupMeaning, wordDifficultyTier } from '@/lib/nlp.js'
import { scheduleReview, getKnownWords } from '@/composables/useSRS.js'

const CLIP_START_PREBUFFER = 0.3  // seek slightly early to absorb seekTo latency
const CLIP_END_BUFFER      = 0.5  // seconds of padding after subtitle ends

// ── State ─────────────────────────────────────────────────────────────────────
const loading      = ref(true)
const error        = ref(null)
const segments     = ref([])
const videoId      = ref('')
const currentIdx   = ref(0)
const isComplete   = ref(false)
const looping      = ref(false)
const autoplay     = ref(false)   // auto-advance through all segments
const slowMode     = ref(false)   // 0.7x playback speed
const videoRef     = ref(null)

// zh translation cache: segmentIdx → translated string
const zhCache    = ref(new Map())
// savedWords: Set of word strings saved to SRS this session
const savedWords  = ref(new Set())
// knownWords: Set of words already mastered (reviews >= 3) — loaded once at mount
const knownWords  = ref(new Set())
// toast
const toast      = ref('')
let toastTimer   = null

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  knownWords.value = getKnownWords()
  const params = new URLSearchParams(window.location.search)
  const vid = params.get('v')
  if (!vid) {
    error.value = '找不到影片 ID'
    loading.value = false
    return
  }
  videoId.value = vid
  try {
    const data = await getVideo(vid)
    segments.value = (data.transcript || []).filter(s => s.text?.trim())
    if (segments.value.length === 0) {
      error.value = '此影片沒有字幕可跟讀'
    }
  } catch (err) {
    error.value = err.message || '載入失敗，請重試'
  } finally {
    loading.value = false
  }
})

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
function onKeyDown(e) {
  // Don't fire when typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  switch (e.key) {
    case ' ':
    case 'r':
    case 'R':
      e.preventDefault()
      replayClip()
      break
    case 'l':
    case 'L':
      e.preventDefault()
      toggleLoop()
      break
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault()
      next()
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault()
      prev()
      break
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

// ── Computed ──────────────────────────────────────────────────────────────────
const currentSegment = computed(() => segments.value[currentIdx.value] ?? null)

const clipStart = computed(() => {
  const seg = currentSegment.value
  if (!seg) return 0
  // Seek slightly early to absorb YouTube IFrame seekTo latency (~200ms)
  return +Math.max(0, seg.start - CLIP_START_PREBUFFER).toFixed(2)
})

const clipEnd = computed(() => {
  const seg = currentSegment.value
  if (!seg) return 0
  const dur = seg.dur && seg.dur > 0 ? seg.dur : 2
  // Use next segment's start as a ceiling to avoid bleeding into the next line
  const nextSeg = segments.value[currentIdx.value + 1]
  const naturalEnd = seg.start + dur + CLIP_END_BUFFER
  const ceiling = nextSeg ? nextSeg.start + 0.1 : Infinity
  return +Math.min(naturalEnd, ceiling).toFixed(2)
})

const currentZh = computed(() => zhCache.value.get(currentIdx.value) ?? '')

// Tokenize current segment into tappable words (keep punctuation attached for display)
const segmentTokens = computed(() => {
  const seg = currentSegment.value
  if (!seg?.text) return []
  return seg.text
    .split(/\s+/)
    .map((display, idx) => ({
      display,
      word: display.replace(/[^a-zA-Z'-]/g, '').toLowerCase(),
      idx,
    }))
    .filter(t => t.word.length >= 2)  // skip single-char punctuation tokens
})

const progressPct = computed(() => {
  if (segments.value.length === 0) return 0
  return Math.round(((currentIdx.value + 1) / segments.value.length) * 100)
})

// ── Translation (MyMemory free API, no key required) ─────────────────────────
async function translateIdx(idx) {
  if (zhCache.value.has(idx)) return
  const seg = segments.value[idx]
  if (!seg?.text) return
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(seg.text)}&langpair=en|zh-TW`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    const data = await res.json()
    const zh = data?.responseData?.translatedText
    if (zh && data?.responseStatus === 200) {
      const m = new Map(zhCache.value)
      m.set(idx, zh)
      zhCache.value = m
    }
  } catch { /* ignore — translation is best-effort */ }
}

// Translate current + pre-fetch next when index changes
watch(currentIdx, (idx) => {
  translateIdx(idx)
  if (idx + 1 < segments.value.length) translateIdx(idx + 1)
}, { immediate: true })

// Also kick off translation once segments load
watch(() => segments.value.length, (len) => {
  if (len > 0) {
    translateIdx(0)
    translateIdx(1)
  }
})

// ── Word tap ─────────────────────────────────────────────────────────────────
function tapWord(word) {
  if (!word) return
  const seg = currentSegment.value
  const meaning = lookupMeaning(word)

  const alreadySaved = savedWords.value.has(word)

  if (!alreadySaved) {
    const clip_start = +Math.max(0, (seg?.start ?? 0) - 0.3).toFixed(2)
    const clip_end   = +(( seg?.start ?? 0) + (seg?.dur ?? 2) + 0.5).toFixed(2)
    scheduleReview({
      id:              `${videoId.value}_${word}`,
      video_id:        videoId.value,
      type:            'word',
      keyword:         word,
      meaning_zh:      meaning || '—',
      frequency:       1,
      difficulty_tier: wordDifficultyTier(word),
      sentence:        seg?.text ?? '',
      clip_start,
      clip_end,
      sort_order:      0,
      level:           'intermediate',
    })
    const newSet = new Set(savedWords.value)
    newSet.add(word)
    savedWords.value = newSet
  }

  const label = meaning ? `${word}：${meaning}` : `${word} 已存入複習`
  showToast(alreadySaved ? `${word} 已在複習清單` : label)
}

function showToast(msg) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2500)
}

// ── Clip events ───────────────────────────────────────────────────────────────
function onClipEnded() {
  if (looping.value) {
    setTimeout(() => videoRef.value?.play(), 300)
  } else if (autoplay.value) {
    next(true)  // VideoClip watches clipStart and seeks immediately — no delay needed
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────
function replayClip() {
  videoRef.value?.play()
}

function toggleLoop() {
  looping.value = !looping.value
  if (looping.value) {
    autoplay.value = false   // mutually exclusive
    videoRef.value?.play()
  }
}

function toggleAutoplay() {
  autoplay.value = !autoplay.value
  if (autoplay.value) {
    looping.value = false    // mutually exclusive
    videoRef.value?.play()
  }
}

function next(fromAuto = false) {
  looping.value = false
  if (!fromAuto) autoplay.value = false   // manual press stops autoplay
  if (currentIdx.value < segments.value.length - 1) {
    currentIdx.value++
  } else {
    autoplay.value = false
    isComplete.value = true
  }
}

function prev() {
  looping.value = false
  autoplay.value = false
  if (currentIdx.value > 0) currentIdx.value--
}

function restart() {
  currentIdx.value = 0
  looping.value = false
  isComplete.value = false
}

function goHome() {
  window.location.href = '/'
}
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(6px); }
</style>
