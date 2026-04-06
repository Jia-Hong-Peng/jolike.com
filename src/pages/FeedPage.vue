<template>
  <div class="min-h-screen bg-black text-white overflow-hidden relative">
<!-- Loading state -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-screen gap-4">
      <!-- Card skeleton (animate-pulse) -->
      <div class="w-full max-w-sm px-4 space-y-3">
        <div class="h-64 bg-gray-800 rounded-2xl animate-pulse"></div>
        <div class="h-6 bg-gray-800 rounded animate-pulse w-1/3"></div>
        <div class="h-8 bg-gray-800 rounded animate-pulse w-2/3"></div>
        <div class="h-5 bg-gray-800 rounded animate-pulse w-1/2"></div>
      </div>
      <p class="text-gray-500 text-sm">正在分析字幕，請稍候…</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <p class="text-red-400 text-center">{{ error }}</p>
      <button
        class="bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold"
        @click="() => (window.location.href = '/')"
      >
        換影片
      </button>
    </div>

    <!-- All mastered state -->
    <div v-else-if="allMastered" class="flex flex-col items-center justify-center min-h-screen gap-6 px-8 text-center">
      <div class="space-y-2">
        <p class="text-4xl">🎓</p>
        <p class="text-white text-xl font-bold">你已掌握此影片的所有詞彙！</p>
        <p class="text-gray-400 text-sm">試試下一支影片，繼續挑戰新單字。</p>
      </div>
      <button
        class="bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg min-h-[56px] w-full max-w-xs"
        @click="goHome"
      >
        換影片
      </button>
    </div>

    <!-- Completed state -->
    <div v-else-if="isComplete" class="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <div class="text-center space-y-2">
        <p class="text-4xl">🎉</p>
        <p class="text-white text-xl font-bold">本次學習完成！</p>
        <p class="text-gray-400 text-sm">
          共 {{ cards.length }} 張卡片
          <span v-if="sessionKnownCount > 0" class="text-green-400">
            · 記住 {{ sessionKnownCount }} 個 ✓
          </span>
        </p>
      </div>
      <button
        v-if="dueCount > 0"
        class="bg-yellow-500 text-black px-8 py-4 rounded-2xl font-semibold text-lg min-h-[56px] w-full max-w-xs"
        @click="() => (window.location.href = '/review/')"
      >
        複習到期單字（{{ dueCount }} 個）
      </button>
      <button
        class="bg-gray-700 text-gray-300 px-8 py-3 rounded-2xl font-semibold text-base min-h-[48px] w-full max-w-xs"
        @click="() => (window.location.href = '/progress/')"
      >
        查看詞彙進度 →
      </button>
      <button
        class="bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg min-h-[56px] w-full max-w-xs"
        @click="goHome"
      >
        換影片
      </button>
    </div>

    <!-- Feed — card stack (FR-008: vertical scroll TikTok style) -->
    <div
      v-else-if="currentCard"
      class="relative w-full h-screen overflow-hidden flex justify-center"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- Card wrapper with CSS transition (T027) — max-width for desktop -->
      <div
        class="relative w-full max-w-sm h-full transition-transform duration-300 ease-out will-change-transform"
        :style="cardTranslateStyle"
      >
        <LearningCard
          ref="cardRef"
          :key="currentCard.id"
          :card="currentCard"
          :loop="loopEnabled"
          :playback-rate="slowMode ? 0.7 : 1.0"
        >
          <!-- Replay + Loop + Slow controls -->
          <div class="flex gap-2 mt-2">
            <button
              class="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold
                     text-base transition-colors min-h-[48px] bg-gray-800 text-white hover:bg-gray-700"
              title="重聽"
              @click="replayCard"
            >
              ↺ 重聽
            </button>
            <button
              class="flex items-center justify-center gap-1 rounded-2xl px-4 py-3 font-semibold
                     text-base transition-colors min-h-[48px]"
              :class="slowMode
                ? 'bg-teal-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
              title="慢速播放 0.7x"
              @click="slowMode = !slowMode"
            >
              🐢
              <span class="text-sm">{{ slowMode ? '0.7x' : '慢速' }}</span>
            </button>
            <button
              class="flex items-center justify-center gap-1 rounded-2xl px-4 py-3 font-semibold
                     text-base transition-colors min-h-[48px]"
              :class="loopEnabled
                ? 'bg-blue-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
              title="循環播放"
              @click="loopEnabled = !loopEnabled"
            >
              🔁
              <span class="text-sm">{{ loopEnabled ? '循環中' : '循環' }}</span>
            </button>
          </div>

          <!-- ActionBar -->
          <ActionBar
            :card-id="currentCard.id"
            :status="cardStatus(currentCard.id)"
            :can-go-prev="currentIndex > 0"
            @mark="onMark"
            @prev="onPrev"
            @next="onNext"
          />
        </LearningCard>

      </div>
    </div>

    <!-- Nav buttons: Teleported to body as fixed to avoid YouTube iframe z-index issue -->
    <Teleport to="body">
      <template v-if="currentCard && !isComplete && !allMastered && !error && !loading">
        <!-- Top-right: vocab list -->
        <button
          class="fixed top-4 right-4 z-[100] bg-black/50 backdrop-blur-sm text-white
                 rounded-full w-11 h-11 flex items-center justify-center text-lg
                 border border-white/20 hover:bg-black/70 transition-colors"
          title="單字總表"
          @click="showVocabList = true"
        >
          ☰
        </button>
        <!-- Top-left: back + progress + level -->
        <div class="fixed top-4 left-4 z-[100] flex items-center gap-2">
          <button
            class="bg-black/50 backdrop-blur-sm text-gray-300 text-xs px-3 py-2 rounded-full border border-white/20
                   hover:bg-black/70 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="回首頁"
            @click="goHome"
          >←</button>
          <div class="bg-black/50 backdrop-blur-sm text-gray-300 text-xs px-3 py-2 rounded-full border border-white/20">
            {{ currentIndex + 1 }} / {{ cards.length }}
          </div>
          <button
            class="bg-black/50 backdrop-blur-sm text-xs px-3 py-2 rounded-full border border-white/20
                   font-semibold transition-colors hover:bg-black/70"
            :class="{
              'text-green-400 border-green-800': level === 'beginner',
              'text-blue-400 border-blue-800': level === 'intermediate',
              'text-purple-400 border-purple-800': level === 'advanced',
            }"
            :title="currentLevel.desc"
            @click="cycleLevel"
          >{{ currentLevel.label }} ⟳</button>
        </div>
      </template>
    </Teleport>

    <!-- Vocab list drawer -->
    <Teleport to="body">
      <VocabList
        v-if="showVocabList"
        :cards="cards"
        :current-index="currentIndex"
        :card-status="cardStatus"
        @close="showVocabList = false"
        @jump="onJumpToCard"
      />
    </Teleport>
</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import LearningCard from '@/components/LearningCard.vue'
import ActionBar from '@/components/ActionBar.vue'
import VocabList from '@/components/VocabList.vue'
import { getVideo, postVocabIndex } from '@/services/api.js'
import { scanTranscriptVocab } from '@/lib/vocabScan.js'
import { useLearningSession } from '@/composables/useLearningSession.js'
import { scheduleReview, getDue, getKnownWords } from '@/composables/useSRS.js'

// --- State ---
const loading = ref(true)
const error = ref(null)
const allMastered = ref(false)
const cards = ref([])
const cardRef = ref(null)
const showVocabList = ref(false)
const transcript = ref([])
const loopEnabled = ref(false)
const slowMode = ref(false)

// Level: persisted in localStorage
const LEVELS = [
  { key: 'beginner',     label: '初級', desc: '顯示所有詞彙，含基礎 A1/A2 單字（英文初學者適用）' },
  { key: 'intermediate', label: '中級', desc: '中高級 B2+ 詞彙為主，適合 IELTS/TOEFL 備考（推薦）' },
  { key: 'advanced',     label: '進階', desc: '進階 C1+ 學術術語，適合衝高分或英文已流利者' },
]
const level = ref(localStorage.getItem('jolike_level') || 'intermediate')

// Touch gesture tracking
let touchStartY = 0
const translateY = ref(0)  // CSS transform offset during swipe

const cardTranslateStyle = computed(() => {
  return translateY.value !== 0
    ? `transform: translateY(${translateY.value}px)`
    : ''
})

// --- Session composable (US3) ---
const _feedParams = new URLSearchParams(window.location.search)
const videoId   = _feedParams.get('v') || ''
const focusWord = _feedParams.get('word') || ''  // jump to specific word when coming from vocab-study
const {
  currentIndex,
  markCard,
  next,
  prev,
  jumpTo,
  isComplete,
  cardStatus,
  session,
} = useLearningSession(videoId, cards)

const currentCard = computed(() => cards.value[currentIndex.value] ?? null)
const dueCount = computed(() => getDue().length)
const sessionKnownCount = computed(() =>
  Object.values(session.value?.cards ?? {}).filter(s => s === 'known').length
)

// --- Lifecycle ---
onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)

  if (!videoId) {
    error.value = '缺少影片 ID，請重新輸入 YouTube 連結'
    loading.value = false
    return
  }

  try {
    const data = await getVideo(videoId)
    transcript.value = data.transcript
    const { extractLearningItems } = await import('@/lib/nlp.js')
    const knownWords = getKnownWords()
    let items = extractLearningItems(data.transcript, videoId, level.value, knownWords)

    // If a focusWord is requested (from vocab-study related video click),
    // ensure it appears by re-extracting with 'beginner' level if not found.
    let focusIdx = -1
    if (focusWord) {
      const fw = focusWord.toLowerCase()
      const found = items.some(c => (c.keyword ?? '').toLowerCase() === fw)
      if (!found) {
        const allItems = extractLearningItems(data.transcript, videoId, 'beginner', new Set())
        const focusCard = allItems.find(c => (c.keyword ?? '').toLowerCase() === fw)
        if (focusCard) items = [focusCard, ...items]
      }
      focusIdx = items.findIndex(c => (c.keyword ?? '').toLowerCase() === fw)
    }

    if (items.length === 0) {
      if (knownWords.size > 0) {
        allMastered.value = true
      } else {
        error.value = '無法從字幕中提取學習內容，請換一支影片'
      }
    } else {
      cards.value = items
      if (focusIdx >= 0) {
        await nextTick()
        jumpTo(focusIdx)
      }
    }

    // Background: scan full transcript against all vocab lists and store index
    scanTranscriptVocab(data.transcript).then(vocab => {
      postVocabIndex(videoId, vocab)
    }).catch(() => { /* non-critical */ })
  } catch (err) {
    error.value = err.message || '載入失敗，請確認網路連線'
  } finally {
    loading.value = false
  }
})

// --- Touch swipe gesture (T027) ---
function onTouchStart(e) {
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e) {
  const delta = touchStartY - e.changedTouches[0].clientY
  if (delta > 60) {
    // Swipe up → next card (equals "known")
    animateCardOut(() => {
      const card = currentCard.value
      markCard(card?.id, 'known')
      if (card) scheduleReview(card)
      next()
    })
  }
}

function animateCardOut(callback) {
  translateY.value = -window.innerHeight
  setTimeout(() => {
    translateY.value = 0
    callback()
  }, 300)
}

// --- ActionBar handlers ---
function onMark({ id, status }) {
  const card = currentCard.value
  markCard(id, status)
  if (card) scheduleReview(card)  // register card in SRS (skips if already exists)
  animateCardOut(() => next())
}

function onPrev() {
  animateCardOut(() => prev())
}

function onNext() {
  const card = currentCard.value
  if (card) scheduleReview(card)  // skip (▶) also registers card for review
  animateCardOut(() => next())
}

function replayCard() {
  cardRef.value?.playVideo()
}

function onJumpToCard(index) {
  jumpTo(index)
}

function cycleLevel() {
  const idx = LEVELS.findIndex(l => l.key === level.value)
  level.value = LEVELS[(idx + 1) % LEVELS.length].key
}

// Keyboard navigation: → = mark known + next, ← = prev, ↓ = next (skip)
function onKeyDown(e) {
  if (!currentCard.value || isComplete.value) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    const card = currentCard.value
    markCard(card?.id, 'known')
    if (card) scheduleReview(card)
    animateCardOut(() => next())
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (currentCard.value) scheduleReview(currentCard.value)
    animateCardOut(() => next())
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    animateCardOut(() => prev())
  }
}
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

// When level changes, re-extract from cached transcript and reset session
watch(level, async (newLevel) => {
  localStorage.setItem('jolike_level', newLevel)
  if (transcript.value.length === 0) return
  const { extractLearningItems } = await import('@/lib/nlp.js')
  const knownWords = getKnownWords()
  const items = extractLearningItems(transcript.value, videoId, newLevel, knownWords)
  if (items.length > 0) {
    cards.value = items
    allMastered.value = false
  } else if (knownWords.size > 0) {
    allMastered.value = true
  }
  jumpTo(0)
})

const currentLevel = computed(() => LEVELS.find(l => l.key === level.value) || LEVELS[1])

function goHome() {
  window.location.href = '/'
}
</script>
