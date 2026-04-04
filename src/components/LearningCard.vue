<template>
  <div class="relative w-full h-full flex flex-col">
    <!-- Video clip area (top 60%) -->
    <div class="flex-1 relative bg-gray-950">
      <VideoClip
        ref="videoClipRef"
        :video-id="card.video_id"
        :start="card.clip_start"
        :end="card.clip_end"
      />
    </div>

    <!-- Card info area (bottom 40%) -->
    <div class="bg-gray-900 px-6 pt-5 pb-4 flex flex-col gap-3 rounded-t-3xl -mt-4 relative z-10">
      <!-- Type badge + frequency -->
      <div class="flex items-center gap-2">
        <span
          class="text-xs font-semibold px-3 py-1 rounded-full"
          :class="typeBadgeClass"
        >
          {{ typeLabel }}
        </span>
        <span
          v-if="card.frequency > 0"
          class="text-xs px-2 py-1 rounded-full font-medium"
          :class="frequencyBadgeClass"
          :title="`在影片中出現 ${card.frequency} 次`"
        >
          {{ frequencyLabel }}
        </span>
      </div>

      <!-- Keyword with highlight -->
      <p class="text-2xl font-bold text-white leading-tight">
        <mark class="bg-yellow-400 text-black px-1 rounded">{{ card.keyword }}</mark>
      </p>

      <!-- Chinese meaning (cedict if available, else auto-translated) -->
      <p class="text-gray-300 text-base">
        <span v-if="card.meaning_zh !== '—'">{{ card.meaning_zh }}</span>
        <span v-else-if="keywordMeaning" class="text-blue-300">{{ keywordMeaning }}</span>
        <span v-else class="text-gray-600 text-sm italic">翻譯中…</span>
      </p>

      <!-- Sentence context: highlight keyword within the source sentence -->
      <div v-if="card.sentence" class="space-y-1">
        <p class="text-sm text-gray-400 leading-relaxed" v-html="highlightedSentence" />

        <!-- Auto translation -->
        <p v-if="translating" class="text-xs text-gray-500 italic">翻譯中…</p>
        <p v-else-if="translationText" class="text-xs text-blue-300 leading-relaxed">{{ translationText }}</p>
      </div>

      <!-- Slot for action buttons (ShadowingPanel, ActionBar injected by parent) -->
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import VideoClip from './VideoClip.vue'

const props = defineProps({
  card: {
    type: Object,
    required: true,
    // { id, video_id, type, keyword, meaning_zh, clip_start, clip_end, sort_order }
  },
})

const videoClipRef = ref(null)
const translating = ref(false)
const translationText = ref('')
const keywordMeaning = ref('')

async function translate(text) {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`
  )
  const data = await res.json()
  return data?.responseData?.translatedText || ''
}

async function fetchTranslation() {
  if (translating.value) return
  translationText.value = ''
  keywordMeaning.value = ''
  translating.value = true
  try {
    const tasks = [
      props.card.sentence ? translate(props.card.sentence) : Promise.resolve(''),
      props.card.meaning_zh === '—' ? translate(props.card.keyword) : Promise.resolve(''),
    ]
    const [sentenceResult, keywordResult] = await Promise.all(tasks)
    translationText.value = sentenceResult
    keywordMeaning.value = keywordResult
  } catch {
    // fail silently — sentence translation shows enough context
  } finally {
    translating.value = false
  }
}

// Auto-translate when card changes
watch(() => props.card.id, () => fetchTranslation(), { immediate: false })
onMounted(() => fetchTranslation())

// Expose clip control to parent (ShadowingPanel needs to stop video before recording)
defineExpose({
  stopVideo: () => videoClipRef.value?.stop(),
  playVideo: () => videoClipRef.value?.play(),
})

const highlightedSentence = computed(() => {
  if (!props.card.sentence) return ''
  const keyword = props.card.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${keyword})`, 'gi')
  return props.card.sentence.replace(
    regex,
    '<mark class="bg-yellow-400/30 text-yellow-300 rounded px-0.5">$1</mark>',
  )
})

const typeLabel = computed(() => {
  return { word: '單字', phrase: '片語', pattern: '句型' }[props.card.type] ?? props.card.type
})

const typeBadgeClass = computed(() => {
  return {
    word: 'bg-blue-900 text-blue-300',
    phrase: 'bg-purple-900 text-purple-300',
    pattern: 'bg-green-900 text-green-300',
  }[props.card.type] ?? 'bg-gray-800 text-gray-300'
})

const frequencyLabel = computed(() => {
  const f = props.card.frequency ?? 0
  if (f >= 5) return `🔥 出現 ${f} 次`
  if (f >= 3) return `⚡ 出現 ${f} 次`
  return `出現 ${f} 次`
})

const frequencyBadgeClass = computed(() => {
  const f = props.card.frequency ?? 0
  if (f >= 5) return 'bg-red-900/60 text-red-300'
  if (f >= 3) return 'bg-orange-900/60 text-orange-300'
  return 'bg-gray-800 text-gray-400'
})
</script>
