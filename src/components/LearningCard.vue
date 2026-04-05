<template>
  <div class="relative w-full h-full flex flex-col">
    <!-- Video clip area (top 55%) -->
    <div class="flex-1 relative bg-gray-950" style="min-height: 0">
      <VideoClip
        ref="videoClipRef"
        :video-id="card.video_id"
        :start="card.clip_start"
        :end="card.clip_end"
        :loop="loop"
        :hide-controls="true"
        :playback-rate="playbackRate"
      />
    </div>

    <!-- Card info area (bottom) -->
    <div class="bg-gray-900 px-6 pt-5 pb-4 flex flex-col gap-2 rounded-t-3xl -mt-4 relative z-10">
<!-- Type badge + tier + AWL + frequency -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-semibold px-3 py-1 rounded-full" :class="typeBadgeClass">
          {{ typeLabel }}
        </span>
        <span
          v-if="card.difficulty_tier"
          class="text-xs px-2 py-1 rounded-full font-bold"
          :class="tierBadgeClass"
          :title="tierTitle"
        >
          {{ tierLabel }}
        </span>
        <!-- AWL / NAWL badge — signals IELTS/TOEFL exam relevance -->
        <span
          v-if="card.awl_sublist"
          class="text-xs px-2 py-1 rounded-full font-bold"
          :class="awlBadgeClass"
          :title="awlBadgeTitle"
        >
          {{ awlBadgeLabel }}
        </span>
        <!-- TOEIC badge — shown for business vocab not already tagged by AWL/TSL -->
        <span
          v-if="showToeicBadge"
          class="text-xs px-2 py-1 rounded-full font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700"
          title="TOEIC 多益商業詞彙"
        >
          多益
        </span>
        <span
          v-if="card.frequency > 1"
          class="text-xs px-2 py-1 rounded-full font-medium"
          :class="frequencyBadgeClass"
          :title="`在影片中出現 ${card.frequency} 次`"
        >
          {{ frequencyLabel }}
        </span>
      </div>

      <!-- Keyword + phonetic + TTS -->
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <p class="text-2xl font-bold text-white leading-tight">
            <mark class="bg-yellow-400 text-black px-1 rounded">{{ card.keyword }}</mark>
          </p>
          <!-- Base/dictionary form shown when keyword is an inflected form -->
          <span
            v-if="card.lemma"
            class="text-sm text-gray-400 font-normal"
            :title="`原型 (base form): ${card.lemma}`"
          >← {{ card.lemma }}</span>
          <button
            v-if="hasTTS"
            class="flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-full transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
            title="朗讀單字"
            @click.stop="onTTSClick"
          >
            🔊
          </button>
        </div>
        <!-- IPA phonetic -->
        <p v-if="dictData && dictData.phonetic" class="text-gray-400 text-sm mt-0.5">
          {{ dictData.phonetic }}
          <span v-if="dictData.partOfSpeech" class="text-gray-600 ml-1">{{ dictData.partOfSpeech }}</span>
        </p>
      </div>

      <!-- English definition (from Free Dictionary API) -->
      <p v-if="dictData && dictData.definition" class="text-gray-200 text-sm leading-snug">
        {{ dictData.definition }}
      </p>

      <!-- Chinese meaning: cedict → MyMemory fallback -->
      <!-- meaning_zh is '' (empty) when not in cedict, not '—' -->
      <p class="text-base" :class="chineseMeaningClass">
        <span v-if="card.meaning_zh">{{ card.meaning_zh }}</span>
        <span v-else-if="keywordMeaning">{{ keywordMeaning }}</span>
        <span v-else-if="translating" class="text-gray-600 text-sm italic">翻譯中…</span>
        <span v-else class="text-gray-600 text-sm italic">—</span>
      </p>

      <!-- Sentence context -->
      <div v-if="card.sentence" class="space-y-1">
        <p class="text-sm text-gray-400 leading-relaxed">
          <HighlightedSentence :sentence="card.sentence" :keyword="card.keyword" />
        </p>
        <p v-if="translationText" class="text-xs text-blue-300 leading-relaxed">{{ translationText }}</p>
      </div>

      <!-- Slot for ActionBar / ShadowingPanel -->
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import VideoClip from './VideoClip.vue'
import HighlightedSentence from './HighlightedSentence.vue'
import { lookupDefinition } from '@/composables/useDictionary.js'
import { useTTS } from '@/composables/useTTS.js'

const props = defineProps({
  card: {
    type: Object,
    required: true,
  },
  loop: {
    type: Boolean,
    default: false,
  },
  playbackRate: {
    type: Number,
    default: 1.0,
  },
})

const videoClipRef  = ref(null)
const translating   = ref(false)
const translationText = ref('')
const keywordMeaning  = ref('')
const dictData        = ref(null)  // { phonetic, partOfSpeech, definition, example }

// ── TTS ───────────────────────────────────────────────────────────────────────
const { hasTTS, speak } = useTTS()

function onTTSClick() {
  // Speak the base form (lemma) for correct dictionary pronunciation;
  // fall back to keyword if no lemma (already base form or unknown)
  speak(props.card.lemma || props.card.keyword)
}

// ── Translation cache ─────────────────────────────────────────────────────────
const TRANS_LANGPAIR = 'en|zh-TW'

function transCacheGet(text) {
  try { return localStorage.getItem(`jolike_trans_${TRANS_LANGPAIR}_${text}`) || null } catch { return null }
}
function transCacheSet(text, val) {
  try { localStorage.setItem(`jolike_trans_${TRANS_LANGPAIR}_${text}`, val) } catch {}
}

async function translateText(text) {
  const cached = transCacheGet(text)
  if (cached) return cached
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${TRANS_LANGPAIR}`,
    { signal: AbortSignal.timeout(5000) }
  )
  const data = await res.json()
  const result = data?.responseData?.translatedText || ''
  if (result) transCacheSet(text, result)
  return result
}

// ── Load card data ────────────────────────────────────────────────────────────
// Generation counter: incremented on each card change to discard stale in-flight results.
// Prevents fast-swipe bug where old translation finishes after card has already changed.
let generation = 0

async function loadCardData() {
  const gen = ++generation
  translating.value = true
  translationText.value = ''
  keywordMeaning.value  = ''
  dictData.value        = null

  try {
    // Phase 1: dictionary + sentence translation (parallel, independent)
    const [dict, sentence] = await Promise.all([
      props.card.type === 'word' ? lookupDefinition(props.card.lemma || props.card.keyword) : Promise.resolve(null),
      props.card.sentence ? translateText(props.card.sentence) : Promise.resolve(''),
    ])
    if (gen !== generation) return  // card changed mid-load — discard stale results
    dictData.value        = dict
    translationText.value = sentence

    // NGSL/TSL fallback: if Free Dictionary has no definition, lazy-load ngsl.js
    // (~246KB, only needed for words not in Free Dictionary)
    if (!dictData.value?.definition && props.card.type === 'word') {
      const { lookupNgslDef } = await import('@/lib/ngsl.js')
      if (gen !== generation) return
      const ngslDef = lookupNgslDef(props.card.lemma || props.card.keyword)
      if (ngslDef) {
        dictData.value = { ...(dictData.value || {}), definition: ngslDef }
      }
    }

    // Phase 2: Chinese keyword meaning (parallel: try keyword + definition, pick best)
    // - Translating the keyword directly works for established terms (touchstone→試金石)
    // - Translating the English definition works for informal words (comfy→Comfortable→舒適)
    // We run both and pick the shorter non-identity result (shorter = proper term, longer = literal)
    if (!props.card.meaning_zh) {
      const lemmaOrKw = props.card.lemma || props.card.keyword
      const defText   = dict?.definition?.replace(/\.$/, '')
      const [kwRes, defRes] = await Promise.all([
        translateText(lemmaOrKw),
        defText ? translateText(defText) : Promise.resolve(''),
      ])
      if (gen !== generation) return
      const isGood = (res, src) => res && res.toLowerCase() !== src.toLowerCase()
      const kwGood  = isGood(kwRes, lemmaOrKw)
      const defGood = isGood(defRes, defText || '')
      // Prefer keyword translation when it's concise; fall back to definition translation
      if (kwGood && (!defGood || kwRes.length <= defRes.length)) {
        keywordMeaning.value = kwRes
      } else if (defGood) {
        keywordMeaning.value = defRes
      }
    }

  } catch {
    // fail silently (network error, timeout, or abort)
  } finally {
    if (gen === generation) translating.value = false
  }
}

watch(() => props.card.id, () => {
  generation++  // invalidate any in-flight load for the previous card
  loadCardData()
})
onMounted(() => loadCardData())

// Expose to parent
defineExpose({
  stopVideo:  () => videoClipRef.value?.stop(),
  playVideo:  () => videoClipRef.value?.play(),
})

// ── Display computed ──────────────────────────────────────────────────────────
const chineseMeaningClass = computed(() => {
  // Show Chinese in muted color when we already have a clear English definition
  return dictData.value?.definition ? 'text-gray-400' : 'text-gray-300'
})

const typeLabel = computed(() => ({ word: '單字', phrase: '片語', pattern: '句型' })[props.card.type] ?? props.card.type)

const typeBadgeClass = computed(() => ({
  word:    'bg-blue-900 text-blue-300',
  phrase:  'bg-purple-900 text-purple-300',
  pattern: 'bg-green-900 text-green-300',
})[props.card.type] ?? 'bg-gray-800 text-gray-300')

const frequencyLabel = computed(() => {
  const f = props.card.frequency ?? 0
  if (f >= 5) return `🔥 ${f} 次`
  if (f >= 3) return `⚡ ${f} 次`
  return `${f} 次`
})

const TIER_LABELS  = { 1: '基礎', 2: '初中級', 3: '中高級', 4: '進階' }
const TIER_TITLES  = { 1: '基礎詞彙 (CEFR A1/A2)', 2: '中級詞彙 (CEFR B1)', 3: '學術詞彙 (CEFR B2)', 4: '進階詞彙 (CEFR C1+)' }
const tierLabel    = computed(() => TIER_LABELS[props.card.difficulty_tier] ?? '')
const tierTitle    = computed(() => TIER_TITLES[props.card.difficulty_tier] ?? '')
const tierBadgeClass = computed(() => {
  const t = props.card.difficulty_tier
  if (t === 4) return 'bg-purple-900 text-purple-300 border border-purple-700'
  if (t === 3) return 'bg-blue-900 text-blue-300 border border-blue-700'
  if (t === 2) return 'bg-teal-900 text-teal-300 border border-teal-700'
  return 'bg-gray-800 text-gray-500'
})

const frequencyBadgeClass = computed(() => {
  const f = props.card.frequency ?? 0
  if (f >= 5) return 'bg-red-900/60 text-red-300'
  if (f >= 3) return 'bg-orange-900/60 text-orange-300'
  return 'bg-gray-800 text-gray-400'
})

// AWL / NAWL badge — shows academic exam relevance (IELTS / TOEFL)
const awlBadgeLabel = computed(() => {
  const s = props.card.awl_sublist
  if (!s) return ''
  if (s <= 3)  return 'IELTS 核心'  // AWL Sublist 1-3: highest coverage
  if (s <= 7)  return 'IELTS 重要'  // AWL Sublist 4-7
  if (s <= 10) return '學術詞彙'    // AWL Sublist 8-10
  if (s === 11) return '學術詞彙'   // NAWL
  return '商業英文'                  // TSL: TOEIC business vocab
})

const awlBadgeTitle = computed(() => {
  const s = props.card.awl_sublist
  if (!s) return ''
  if (s === 1)  return 'Academic Word List — Sublist 1（最高頻學術詞，IELTS/TOEFL 核心）'
  if (s <= 5)   return `Academic Word List — Sublist ${s}（高頻學術詞，IELTS/TOEFL 重要）`
  if (s <= 10)  return `Academic Word List — Sublist ${s}（學術詞彙，IELTS 進階）`
  if (s === 11) return 'New Academic Word List（現代學術語料高頻詞，TOEFL/IELTS 進階）'
  return 'TOEIC Service List（TOEIC 商業語料高頻詞，覆蓋 TOEIC 98.5%）'
})

const awlBadgeClass = computed(() => {
  const s = props.card.awl_sublist
  if (!s) return ''
  if (s <= 3) return 'bg-amber-900/70 text-amber-300 border border-amber-700'   // AWL 1-3: gold = critical
  if (s <= 7) return 'bg-yellow-900/60 text-yellow-400 border border-yellow-800' // AWL 4-7: yellow = important
  if (s <= 10) return 'bg-stone-800 text-stone-400 border border-stone-600'      // AWL 8-10: muted = useful
  if (s === 11) return 'bg-indigo-900/60 text-indigo-300 border border-indigo-700' // NAWL: indigo = modern academic
  return 'bg-cyan-900/60 text-cyan-300 border border-cyan-700'                    // TSL: cyan = business/TOEIC
})

// TOEIC badge: card.categories is set by nlp.js during analysis (avoids re-importing lookup.js here)
const showToeicBadge = computed(() => {
  if ((props.card.awl_sublist ?? 0) >= 12) return false  // already shown as 商業英文 via AWL badge
  return (props.card.categories ?? []).includes('toeic')
})
</script>
