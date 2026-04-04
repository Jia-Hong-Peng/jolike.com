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
      <p class="text-4xl">🎤</p>
      <p class="text-white text-xl font-bold">跟讀完成！</p>
      <p class="text-gray-400 text-sm">共 {{ segments.length }} 句，已存入 {{ totalSavedWords }} 個單字</p>
      <button
        v-if="totalSavedWords > 0"
        class="w-full max-w-xs bg-yellow-500 text-black py-4 rounded-2xl font-semibold text-lg min-h-[56px]"
        @click="goReview"
      >
        複習已存單字 →
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
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <button
          class="text-gray-400 text-sm min-h-[44px] min-w-[44px] flex items-center"
          @click="goHome"
        >
          ← 離開
        </button>
        <span class="text-sm text-gray-400">{{ currentIdx + 1 }} / {{ segments.length }}</span>
        <span class="text-xs text-orange-400 font-medium min-w-[4rem] text-right">
          {{ totalSavedWords > 0 ? `${totalSavedWords} 個單字` : '' }}
        </span>
      </div>

      <!-- Progress bar -->
      <div class="h-1 bg-gray-800 flex-shrink-0">
        <div
          class="h-full bg-blue-500 transition-all duration-300"
          :style="{ width: progressPct + '%' }"
        ></div>
      </div>

      <!-- Previous segment (faded context) -->
      <div class="px-5 pt-4 pb-1 flex-shrink-0 min-h-[40px]">
        <p v-if="prevSegment" class="text-sm text-gray-600 leading-relaxed line-clamp-2">
          {{ prevSegment.text }}
        </p>
      </div>

      <!-- Video clip -->
      <div class="px-4 flex-shrink-0">
        <div class="relative bg-gray-950 rounded-2xl overflow-hidden" style="height: 180px">
          <VideoClip
            ref="videoRef"
            :key="currentIdx"
            :video-id="videoId"
            :start="clipStart"
            :end="clipEnd"
          />
          <!-- Replay button overlay -->
          <button
            class="absolute bottom-3 left-3 bg-black/60 text-white rounded-full
                   w-10 h-10 flex items-center justify-center text-base z-10
                   hover:bg-black/80 transition-colors"
            title="重播此句"
            @click="replayClip"
          >
            ↺
          </button>
        </div>
      </div>

      <!-- Current segment text -->
      <div class="px-5 py-4 flex-1 overflow-y-auto">
        <p class="text-lg font-medium text-white leading-relaxed">
          {{ currentSegment.text }}
        </p>
        <!-- Words saved from this segment (shown after marking) -->
        <div v-if="savedSegments.has(currentIdx)" class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="w in savedSegments.get(currentIdx)"
            :key="w"
            class="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded-full border border-orange-800/50"
          >
            {{ w }}
          </span>
        </div>
      </div>

      <!-- Action area -->
      <div class="px-4 pb-6 space-y-3 flex-shrink-0">
        <!-- 不熟 button (disabled if already saved) -->
        <button
          v-if="!savedSegments.has(currentIdx)"
          class="w-full bg-orange-900/60 text-orange-300 py-3 rounded-2xl font-semibold
                 text-base min-h-[48px] border border-orange-800 hover:bg-orange-900 transition-colors"
          @click="markUnfamiliar"
        >
          🔖 不熟，存入複習
        </button>
        <div
          v-else
          class="w-full text-center text-orange-400 text-sm py-2"
        >
          ✓ 已存入 {{ savedSegments.get(currentIdx).length }} 個單字
        </div>

        <!-- Navigation -->
        <div class="flex gap-3">
          <button
            class="flex-1 bg-gray-800 text-gray-300 py-3 rounded-2xl font-semibold
                   text-base min-h-[48px] disabled:opacity-40 transition-colors hover:bg-gray-700"
            :disabled="currentIdx === 0"
            @click="prev"
          >
            ← 上一句
          </button>
          <button
            class="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-semibold
                   text-base min-h-[48px] hover:bg-blue-500 transition-colors"
            @click="next"
          >
            {{ currentIdx === segments.length - 1 ? '完成 ✓' : '下一句 →' }}
          </button>
        </div>
      </div>
    </template>

    <!-- Toast -->
    <transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-28 left-1/2 -translate-x-1/2 bg-gray-800 text-white
               px-5 py-2.5 rounded-xl text-sm shadow-lg z-50 whitespace-nowrap"
      >
        {{ toast }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VideoClip from '@/components/VideoClip.vue'
import { getVideo } from '@/services/api.js'
import { extractWordsFromSegment } from '@/lib/nlp.js'
import { scheduleReview } from '@/composables/useSRS.js'

const CLIP_MIN_S = 3

// ── State ─────────────────────────────────────────────────────────────────────
const loading    = ref(true)
const error      = ref(null)
const segments   = ref([])
const videoId    = ref('')
const currentIdx = ref(0)
const isComplete = ref(false)
const toast      = ref('')
const videoRef   = ref(null)

// savedSegments: Map<segmentIndex, string[]> — words saved per segment
const savedSegments = ref(new Map())

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
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

// ── Keyboard navigation ───────────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev()
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

// ── Computed ──────────────────────────────────────────────────────────────────
const currentSegment = computed(() => segments.value[currentIdx.value] ?? null)
const prevSegment    = computed(() => currentIdx.value > 0 ? segments.value[currentIdx.value - 1] : null)

const clipStart = computed(() => {
  const seg = currentSegment.value
  if (!seg) return 0
  return +Math.max(0, seg.start - 0.5).toFixed(2)
})

const clipEnd = computed(() => {
  const seg = currentSegment.value
  if (!seg) return 0
  return +(seg.start + Math.max(seg.dur ?? 2, CLIP_MIN_S) + 1.5).toFixed(2)
})

const progressPct = computed(() => {
  if (segments.value.length === 0) return 0
  return Math.round(((currentIdx.value + 1) / segments.value.length) * 100)
})

const totalSavedWords = computed(() => {
  let count = 0
  for (const words of savedSegments.value.values()) count += words.length
  return count
})

// ── Actions ───────────────────────────────────────────────────────────────────
function next() {
  if (currentIdx.value < segments.value.length - 1) {
    currentIdx.value++
  } else {
    isComplete.value = true
  }
}

function prev() {
  if (currentIdx.value > 0) currentIdx.value--
}

function replayClip() {
  videoRef.value?.play()
}

function markUnfamiliar() {
  const seg = currentSegment.value
  if (!seg) return

  const cards = extractWordsFromSegment(seg, videoId.value)
  if (cards.length === 0) {
    showToast('這句沒有偵測到需要學習的單字')
    return
  }

  cards.forEach(card => scheduleReview(card))

  // Store which words were saved for this segment index
  const newMap = new Map(savedSegments.value)
  newMap.set(currentIdx.value, cards.map(c => c.keyword))
  savedSegments.value = newMap

  showToast(`已存入 ${cards.length} 個單字到複習清單`)
}

let toastTimer = null
function showToast(msg) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2500)
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goHome() {
  window.location.href = '/'
}

function goReview() {
  window.location.href = '/review/'
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
