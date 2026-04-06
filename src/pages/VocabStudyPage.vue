<template>
  <div class="min-h-screen bg-black text-white overflow-hidden relative">

    <!-- ── List selection (no ?list param) ──────────────────────────────────── -->
    <div v-if="!listId" class="min-h-screen flex flex-col px-5 py-8">
      <div class="flex items-center gap-3 mb-8">
        <button
          class="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center
                 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          @click="goHome"
        >←</button>
        <h1 class="text-xl font-bold">詞彙清單</h1>
      </div>
      <p class="text-gray-500 text-sm mb-6">選擇考試類型，開始系統學習</p>
      <div class="space-y-3">
        <button
          v-for="list in VOCAB_LISTS"
          :key="list.id"
          class="w-full bg-gray-900 hover:bg-gray-800 rounded-2xl px-4 py-4
                 flex items-center gap-4 transition-colors text-left active:scale-[0.98]"
          @click="startList(list.id)"
        >
          <span class="text-3xl flex-shrink-0">{{ list.emoji }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-white font-semibold text-base">{{ list.label }}</p>
            <p class="text-gray-500 text-xs mt-0.5 leading-snug">{{ list.desc }}</p>
          </div>
          <div class="flex-shrink-0 text-right">
            <p class="text-gray-400 text-xs">{{ listWordCount(list.id) }} 個詞</p>
            <p v-if="listLearnedCount(list.id) > 0" class="text-teal-400 text-xs mt-0.5">
              已學 {{ listLearnedCount(list.id) }}
            </p>
          </div>
          <span class="text-gray-600 flex-shrink-0">→</span>
        </button>
      </div>
    </div>

    <!-- ── Loading ───────────────────────────────────────────────────────────── -->
    <div v-else-if="loading" class="flex flex-col items-center justify-center min-h-screen gap-4">
      <div class="w-full max-w-sm px-6 space-y-4">
        <div class="h-48 bg-gray-800 rounded-3xl animate-pulse"></div>
        <div class="h-6 bg-gray-800 rounded animate-pulse w-1/3"></div>
        <div class="h-8 bg-gray-800 rounded animate-pulse w-2/3"></div>
      </div>
      <p class="text-gray-500 text-sm">載入詞彙清單中…</p>
    </div>

    <!-- ── Completed ─────────────────────────────────────────────────────────── -->
    <div v-else-if="isComplete" class="flex flex-col items-center justify-center min-h-screen gap-6 px-8 text-center">
      <div class="space-y-2">
        <p class="text-4xl">🎉</p>
        <p class="text-white text-xl font-bold">本次學習完成！</p>
        <p class="text-gray-400 text-sm">共 {{ cards.length }} 個單字</p>
      </div>
      <button
        class="bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg min-h-[56px] w-full max-w-xs"
        @click="() => (window.location.href = '/vocab-study/')"
      >
        選擇其他清單
      </button>
      <button
        class="bg-gray-800 text-gray-300 px-8 py-3 rounded-2xl font-semibold min-h-[48px] w-full max-w-xs"
        @click="goHome"
      >
        回首頁
      </button>
    </div>

    <!-- ── Study card view ───────────────────────────────────────────────────── -->
    <div
      v-else-if="currentCard"
      class="relative w-full h-screen flex flex-col overflow-hidden"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- Header -->
      <div class="relative z-10 flex items-center gap-2 px-4 pt-4 pb-2 flex-shrink-0">
        <button
          class="bg-gray-900 text-gray-400 text-xs px-3 py-2 rounded-full border border-gray-700
                 hover:bg-gray-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          @click="goHome"
        >←</button>
        <div class="bg-gray-900 text-gray-400 text-xs px-3 py-2 rounded-full border border-gray-700">
          {{ currentIndex + 1 }} / {{ cards.length }}
        </div>
        <div class="text-xs px-3 py-2 rounded-full border font-semibold" :class="currentList?.badgeClass">
          {{ currentList?.emoji }} {{ currentList?.label }}
        </div>
      </div>

      <!-- Card content (fills remaining height) with swipe animation -->
      <div
        class="flex-1 flex flex-col px-4 pb-4 min-h-0 transition-transform duration-300 ease-out will-change-transform"
        :style="cardTranslateStyle"
      >
        <!-- Word display card -->
        <div class="flex-1 bg-gray-900 rounded-3xl flex flex-col justify-center px-6 py-6 min-h-0 overflow-y-auto">
          <!-- Badges: difficulty + AWL + categories -->
          <div class="flex flex-wrap gap-2 mb-5">
            <span
              v-if="currentCard.difficulty_tier"
              class="text-xs px-2.5 py-1 rounded-full font-bold border"
              :class="tierBadgeClass(currentCard.difficulty_tier)"
            >{{ tierLabel(currentCard.difficulty_tier) }}</span>
            <span
              v-if="currentCard.awl_sublist"
              class="text-xs px-2.5 py-1 rounded-full font-bold"
              :class="awlBadgeClass(currentCard.awl_sublist)"
            >{{ awlBadgeLabel(currentCard.awl_sublist) }}</span>
            <span
              v-if="showToeicBadge"
              class="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700"
            >多益</span>
          </div>

          <!-- Keyword + TTS -->
          <div class="flex items-start gap-3 mb-3">
            <p class="text-4xl font-bold leading-tight flex-1">
              <mark class="bg-yellow-400 text-black px-2 py-0.5 rounded-lg">{{ currentCard.keyword }}</mark>
            </p>
            <button
              v-if="hasTTS"
              class="flex-shrink-0 w-11 h-11 min-h-[44px] rounded-full bg-gray-800 text-gray-300
                     hover:bg-gray-700 transition-colors flex items-center justify-center text-xl mt-1"
              title="朗讀"
              @click="speakWord"
            >🔊</button>
          </div>

          <!-- Base form (lemma) -->
          <p v-if="currentCard.lemma" class="text-gray-500 text-sm mb-2">
            原型：{{ currentCard.lemma }}
          </p>

          <!-- Phonetic + part of speech (from dictionary API, or CMUdict IPA fallback) -->
          <p v-if="dictData?.phonetic || ipaPhonetic || dictData?.partOfSpeech" class="text-gray-400 text-base mb-3">
            <span>{{ dictData?.phonetic || ipaPhonetic }}</span>
            <span v-if="dictData?.partOfSpeech" class="text-gray-600 ml-2 text-sm">{{ dictData.partOfSpeech }}</span>
          </p>

          <!-- English definition -->
          <p
            v-if="dictData?.definition"
            class="text-gray-200 text-base leading-relaxed mb-3"
          >{{ dictData.definition }}</p>

          <!-- Chinese meaning -->
          <p class="text-lg font-medium mb-1" :class="dictData?.definition ? 'text-gray-400' : 'text-gray-200'">
            <span v-if="currentCard.meaning_zh">{{ currentCard.meaning_zh }}</span>
            <span v-else-if="fallbackMeaning">{{ fallbackMeaning }}</span>
            <span v-else-if="loadingDef" class="text-gray-600 text-sm italic">翻譯中…</span>
            <span v-else class="text-gray-600 text-sm italic">—</span>
          </p>

          <!-- SRS status badge (shows if already in learning) -->
          <div v-if="currentCard._srsStatus !== 'new'" class="mt-3">
            <span
              class="text-xs px-2 py-0.5 rounded-full"
              :class="{
                'bg-blue-900/60 text-blue-400': currentCard._srsStatus === 'learning',
                'bg-teal-900/60 text-teal-400': currentCard._srsStatus === 'familiar',
                'bg-yellow-900/60 text-yellow-400': currentCard._srsStatus === 'mastered',
              }"
            >{{ { learning: '學習中', familiar: '熟悉', mastered: '精通' }[currentCard._srsStatus] }}</span>
          </div>

          <!-- Related videos from vocab index -->
          <div v-if="relatedVideos.length > 0" class="mt-4 pt-3 border-t border-gray-800">
            <p class="text-gray-500 text-xs mb-2">📹 出現在這些影片中</p>
            <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <a
                v-for="v in relatedVideos"
                :key="v.id"
                :href="`/feed/?v=${v.id}`"
                class="flex-shrink-0 flex flex-col gap-1"
              >
                <img
                  :src="`https://img.youtube.com/vi/${v.id}/default.jpg`"
                  :alt="v.title"
                  class="w-24 h-[54px] object-cover rounded-lg bg-gray-800"
                  loading="lazy"
                />
                <p class="text-gray-500 text-xs w-24 leading-snug line-clamp-2">{{ v.title || v.id }}</p>
              </a>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex-shrink-0 mt-3 space-y-2">
          <!-- Replay TTS -->
          <button
            v-if="hasTTS"
            class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold
                   text-base transition-colors min-h-[48px] bg-gray-800 text-white hover:bg-gray-700"
            @click="speakWord"
          >
            ↺ 重聽
          </button>

          <!-- ActionBar -->
          <ActionBar
            :card-id="currentCard.id"
            :status="cardStatus(currentCard.id)"
            :can-go-prev="currentIndex > 0"
            @mark="onMark"
            @prev="onPrev"
            @next="onNext"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import ActionBar from '@/components/ActionBar.vue'
import { VOCAB_LISTS, getListMeta, loadWordList, generateVocabCards } from '@/lib/vocabLists.js'
import { useLearningSession } from '@/composables/useLearningSession.js'
import { scheduleReview, markKnown, markUnsure, getDue } from '@/composables/useSRS.js'
import { lookupDefinition } from '@/composables/useDictionary.js'
import { useTTS } from '@/composables/useTTS.js'
import { getVocabVideos } from '@/services/api.js'
import { lookupIpa } from '@/lib/pronunciation.js'

// ── URL param ─────────────────────────────────────────────────────────────────
const _params = new URLSearchParams(window.location.search)
const listId  = _params.get('list') || ''
const startWord = _params.get('word') || ''
const currentList = computed(() => listId ? getListMeta(listId) : null)

// ── State ─────────────────────────────────────────────────────────────────────
const loading  = ref(false)
const cards    = ref([])

// ── SRS session ───────────────────────────────────────────────────────────────
const {
  currentIndex,
  markCard,
  next,
  prev,
  jumpTo,
  isComplete,
  cardStatus,
} = useLearningSession(listId ? `vocab_${listId}` : '', cards)

const currentCard = computed(() => cards.value[currentIndex.value] ?? null)

// ── Load word list ─────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!listId) {
    buildWordCounts()
    return
  }
  loading.value = true
  try {
    const words = await loadWordList(listId)
    cards.value = generateVocabCards(words, listId)
    // Jump to specific word if passed via ?word= param
    if (startWord) {
      const idx = cards.value.findIndex(
        c => c.keyword.toLowerCase() === startWord.toLowerCase()
      )
      if (idx > 0) jumpTo(idx)
    }
  } finally {
    loading.value = false
  }
})

// ── Word counts for list selection screen ─────────────────────────────────────
const wordCounts   = ref({})
const learnedCounts = ref({})

async function buildWordCounts() {
  // Lazy: load all lists in parallel to get counts
  const SRS_PREFIX = 'jolike_srs_'
  const srsWords = new Set()
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(SRS_PREFIX)) srsWords.add(k.slice(SRS_PREFIX.length))
  }

  await Promise.all(VOCAB_LISTS.map(async (list) => {
    const words = await loadWordList(list.id)
    wordCounts.value[list.id] = words.length
    learnedCounts.value[list.id] = words.filter(w => srsWords.has(w.toLowerCase())).length
  }))
}

function listWordCount(id)    { return wordCounts.value[id] ?? '…' }
function listLearnedCount(id) { return learnedCounts.value[id] ?? 0 }

function startList(id) {
  window.location.href = `/vocab-study/?list=${id}`
}

// ── Related videos from vocab index ───────────────────────────────────────────
const relatedVideos = ref([])

async function loadRelatedVideos() {
  if (!currentCard.value || !listId) { relatedVideos.value = []; return }
  try {
    relatedVideos.value = await getVocabVideos(listId, currentCard.value.keyword)
  } catch {
    relatedVideos.value = []
  }
}

// ── Dictionary lookup ─────────────────────────────────────────────────────────
const dictData        = ref(null)
const ipaPhonetic     = ref('')
const fallbackMeaning = ref('')
const loadingDef      = ref(false)

let generation = 0

async function loadCardData() {
  if (!currentCard.value) return
  const gen = ++generation
  loadingDef.value = true
  dictData.value = null
  ipaPhonetic.value = ''
  fallbackMeaning.value = ''

  try {
    const dict = await lookupDefinition(currentCard.value.lemma || currentCard.value.keyword)
    if (gen !== generation) return
    dictData.value = dict

    // NGSL fallback
    if (!dict?.definition) {
      const { lookupNgslDef } = await import('@/lib/ngsl.js')
      if (gen !== generation) return
      const ngslDef = lookupNgslDef(currentCard.value.lemma || currentCard.value.keyword)
      if (ngslDef) dictData.value = { ...(dictData.value || {}), definition: ngslDef }
    }

    // CMUdict IPA fallback: if Free Dictionary has no phonetic, look up cmudict
    if (!dict?.phonetic) {
      const ipa = await lookupIpa(currentCard.value.lemma || currentCard.value.keyword)
      if (gen !== generation) return
      if (ipa) ipaPhonetic.value = ipa
    }

    // Chinese meaning fallback via translation
    if (!currentCard.value.meaning_zh) {
      const word = currentCard.value.lemma || currentCard.value.keyword
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-TW`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (gen !== generation) return
      const data = await res.json()
      const result = data?.responseData?.translatedText || ''
      if (result && result.toLowerCase() !== word.toLowerCase()) fallbackMeaning.value = result
    }
  } catch { /* fail silently */ }
  finally { if (gen === generation) loadingDef.value = false }
}

watch(() => currentCard.value?.id, () => {
  generation++
  loadCardData()
  loadRelatedVideos()
})
onMounted(() => {
  if (listId) {
    loadCardData()
    loadRelatedVideos()
  }
})

// ── TTS ───────────────────────────────────────────────────────────────────────
const { hasTTS, speak } = useTTS()

function speakWord() {
  if (currentCard.value) speak(currentCard.value.lemma || currentCard.value.keyword)
}

// ── Touch swipe ───────────────────────────────────────────────────────────────
let touchStartY = 0
const translateY = ref(0)

const cardTranslateStyle = computed(() =>
  translateY.value !== 0 ? `transform: translateY(${translateY.value}px)` : '',
)

function onTouchStart(e) { touchStartY = e.touches[0].clientY }

function onTouchEnd(e) {
  const delta = touchStartY - e.changedTouches[0].clientY
  if (delta > 60) {
    animateCardOut(() => {
      const card = currentCard.value
      markCard(card?.id, 'known')
      if (card) advanceSrs(card, 'known')
      next()
    })
  }
}

function animateCardOut(callback) {
  translateY.value = -window.innerHeight
  setTimeout(() => { translateY.value = 0; callback() }, 300)
}

// known → instantly mastered; unsure → reset to learning
function advanceSrs(card, outcome) {
  if (!card) return
  if (outcome === 'known') {
    markKnown(card)
  } else {
    markUnsure(card)
  }
}

// ── ActionBar handlers ────────────────────────────────────────────────────────
function onMark({ id, status }) {
  const card = currentCard.value
  markCard(id, status)
  if (card) advanceSrs(card, status === 'known' ? 'known' : 'unsure')
  animateCardOut(() => next())
}

function onPrev() { animateCardOut(() => prev()) }

function onNext() {
  const card = currentCard.value
  if (card) scheduleReview(card)   // just seen = create entry if new, no interval change
  animateCardOut(() => next())
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
function onKeyDown(e) {
  if (!currentCard.value || isComplete.value) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    const card = currentCard.value
    markCard(card?.id, 'known')
    if (card) advanceSrs(card, 'known')
    animateCardOut(() => next())
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (currentCard.value) advanceSrs(currentCard.value, 'unsure')
    animateCardOut(() => next())
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    animateCardOut(() => prev())
  }
}
onMounted(() => { if (listId) window.addEventListener('keydown', onKeyDown) })
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

// ── Badge helpers (same as LearningCard) ──────────────────────────────────────
function tierLabel(t) { return { 1: '基礎', 2: '初中級', 3: '中高級', 4: '進階' }[t] ?? '' }
function tierBadgeClass(t) {
  if (t === 4) return 'bg-purple-900 text-purple-300 border-purple-700'
  if (t === 3) return 'bg-blue-900 text-blue-300 border-blue-700'
  if (t === 2) return 'bg-teal-900 text-teal-300 border-teal-700'
  return 'bg-gray-800 text-gray-500 border-gray-700'
}
function awlBadgeLabel(s) {
  if (!s) return ''
  if (s <= 3)  return 'IELTS 核心'
  if (s <= 7)  return 'IELTS 重要'
  if (s <= 10) return '學術詞彙'
  if (s === 11) return '學術詞彙'
  return '商業英文'
}
function awlBadgeClass(s) {
  if (!s) return ''
  if (s <= 3)  return 'bg-amber-900/70 text-amber-300 border border-amber-700'
  if (s <= 7)  return 'bg-yellow-900/60 text-yellow-400 border border-yellow-800'
  if (s <= 10) return 'bg-stone-800 text-stone-400 border border-stone-600'
  if (s === 11) return 'bg-indigo-900/60 text-indigo-300 border border-indigo-700'
  return 'bg-cyan-900/60 text-cyan-300 border border-cyan-700'
}
const showToeicBadge = computed(() => {
  if (!currentCard.value) return false
  if ((currentCard.value.awl_sublist ?? 0) >= 12) return false
  return (currentCard.value.categories ?? []).includes('toeic')
})

function goHome() { window.location.href = '/' }
</script>
