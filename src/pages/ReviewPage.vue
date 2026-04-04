<template>
  <div class="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
<!-- No due cards -->
    <div v-if="!loading && dueCards.length === 0" class="text-center space-y-4">
      <p class="text-4xl">✅</p>
      <p class="text-white text-xl font-bold">沒有待複習單字</p>
      <p class="text-gray-400 text-sm">繼續學習新影片，累積更多詞彙</p>
      <button
        class="mt-4 bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg min-h-[56px]"
        @click="goHome"
      >
        回首頁
      </button>
    </div>

    <!-- Session complete -->
    <div v-else-if="sessionComplete" class="text-center space-y-4 w-full max-w-sm">
      <p class="text-4xl">🏆</p>
      <p class="text-white text-xl font-bold">複習完成！</p>
      <p class="text-gray-400 text-sm">共複習 {{ dueCards.length }} 個單字</p>

      <!-- Push notification prompt (shown after first session) -->
      <div v-if="showPushPrompt" class="bg-gray-800 rounded-2xl p-5 text-left space-y-3 border border-gray-700">
        <p class="text-white font-semibold">🔔 開啟每日複習提醒？</p>
        <p class="text-gray-400 text-sm">明天該複習時，JoLike 會通知你，讓記憶更穩固。</p>
        <div class="flex gap-3">
          <button
            class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm min-h-[44px]"
            @click="enablePush"
          >
            開啟通知
          </button>
          <button
            class="flex-1 bg-gray-700 text-gray-300 py-3 rounded-xl font-semibold text-sm min-h-[44px]"
            @click="dismissPush"
          >
            不用了
          </button>
        </div>
      </div>

      <button
        class="w-full bg-gray-700 text-gray-300 px-8 py-3 rounded-2xl font-semibold text-base min-h-[48px]"
        @click="() => (window.location.href = '/progress/')"
      >
        查看詞彙進度 →
      </button>
      <button
        class="w-full bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg min-h-[56px]"
        @click="goHome"
      >
        回首頁
      </button>
    </div>

    <!-- Review card -->
    <div v-else-if="currentEntry" class="w-full max-w-sm space-y-4">
      <!-- Progress indicator -->
      <p class="text-gray-500 text-sm text-center">
        {{ currentIdx + 1 }} / {{ dueCards.length }}
      </p>

      <!-- ── QUESTION phase: cloze deletion ── -->
      <template v-if="phase === 'question'">
        <div class="bg-gray-900 rounded-2xl px-6 py-8 space-y-4 text-center">
          <!-- Type badge -->
          <span class="text-xs font-semibold px-3 py-1 rounded-full" :class="typeBadgeClass">
            {{ typeLabel }}
          </span>

          <!-- Cloze sentence: word replaced with blank -->
          <p class="text-gray-200 text-base leading-relaxed" v-html="clozeSentence"></p>

          <p class="text-gray-600 text-xs mt-2">這個空格是什麼單字？</p>
        </div>

        <!-- Reveal button -->
        <button
          class="w-full bg-yellow-500 text-black py-4 rounded-2xl font-bold text-base min-h-[56px] hover:bg-yellow-400 transition-colors"
          @click="reveal"
        >
          顯示答案
        </button>
      </template>

      <!-- ── REVEALED phase: full card ── -->
      <template v-else>
        <!-- Video clip -->
        <div class="rounded-2xl overflow-hidden bg-gray-950 relative" style="height: 200px">
          <VideoClip
            :key="currentEntry.word"
            :video-id="currentEntry.videoId"
            :start="currentEntry.clip_start"
            :end="currentEntry.clip_end"
          />
        </div>

        <!-- Card info -->
        <div class="bg-gray-900 rounded-2xl px-6 py-5 space-y-2">
          <!-- Keyword + TTS -->
          <div class="flex items-center gap-3">
            <p class="text-2xl font-bold text-white leading-tight">
              <mark class="bg-yellow-400 text-black px-1 rounded">{{ currentEntry.word }}</mark>
            </p>
            <button
              v-if="hasTTS"
              class="flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600 transition-colors"
              title="朗讀單字"
              @click="speak(currentEntry.word)"
            >
              🔊
            </button>
          </div>

          <!-- IPA phonetic + part of speech -->
          <p v-if="dictData && dictData.phonetic" class="text-gray-400 text-sm">
            {{ dictData.phonetic }}
            <span v-if="dictData.partOfSpeech" class="text-gray-600 ml-1">{{ dictData.partOfSpeech }}</span>
          </p>

          <!-- English definition -->
          <p v-if="dictData && dictData.definition" class="text-gray-200 text-sm leading-snug">
            {{ dictData.definition }}
          </p>

          <!-- Chinese meaning -->
          <p
            v-if="currentEntry.meaning_zh && currentEntry.meaning_zh !== '—'"
            class="text-base"
            :class="dictData?.definition ? 'text-gray-400' : 'text-blue-300'"
          >
            {{ currentEntry.meaning_zh }}
          </p>

          <!-- Sentence with keyword highlighted -->
          <p
            v-if="currentEntry.sentence"
            class="text-gray-400 text-sm leading-relaxed pt-1"
            v-html="highlightedSentence"
          ></p>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <button
            class="flex-1 bg-red-900/70 text-red-300 py-4 rounded-2xl font-semibold text-base min-h-[56px] border border-red-800 hover:bg-red-900 transition-colors"
            @click="mark('unsure')"
          >
            還不熟 😅
          </button>
          <button
            class="flex-1 bg-green-900/70 text-green-300 py-4 rounded-2xl font-semibold text-base min-h-[56px] border border-green-800 hover:bg-green-900 transition-colors"
            @click="mark('known')"
          >
            記住了 ✓
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import VideoClip from '@/components/VideoClip.vue'
import { getDue, markReview } from '@/composables/useSRS.js'
import { subscribePush, isPushEnabled } from '@/composables/usePWA.js'
import { lookupDefinition } from '@/composables/useDictionary.js'

const loading = ref(true)
const dueCards = ref([])
const currentIdx = ref(0)
const sessionComplete = ref(false)
const showPushPrompt = ref(false)
const phase = ref('question')   // 'question' | 'revealed'
const dictData = ref(null)

const hasTTS = ref(typeof window !== 'undefined' && 'speechSynthesis' in window)
const supportsPush = ref(typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window)

onMounted(async () => {
  dueCards.value = getDue()
  loading.value = false
  if (supportsPush.value) {
    const already = await isPushEnabled()
    if (already) showPushPrompt.value = false
  }
})

const currentEntry = computed(() => dueCards.value[currentIdx.value] ?? null)

// Fetch dictionary data when card changes
watch(currentEntry, async (entry) => {
  dictData.value = null
  phase.value = 'question'
  if (entry && entry.type === 'word') {
    dictData.value = await lookupDefinition(entry.word)
  }
}, { immediate: true })

// ── Cloze sentence: replace keyword with blank ────────────────────────────────
const clozeSentence = computed(() => {
  if (!currentEntry.value?.sentence) return ''
  const kw = currentEntry.value.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return currentEntry.value.sentence.replace(
    new RegExp(`(${kw})`, 'gi'),
    '<span class="inline-block bg-gray-700 text-gray-700 rounded px-2 min-w-[4rem] select-none">$1</span>',
  )
})

// Highlighted sentence for revealed phase
const highlightedSentence = computed(() => {
  if (!currentEntry.value?.sentence) return ''
  const kw = currentEntry.value.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return currentEntry.value.sentence.replace(
    new RegExp(`(${kw})`, 'gi'),
    '<mark class="bg-yellow-400/30 text-yellow-300 rounded px-0.5">$1</mark>',
  )
})

const typeLabel = computed(() => ({
  word: '單字', phrase: '片語', pattern: '句型',
})[currentEntry.value?.type] ?? '單字')

const typeBadgeClass = computed(() => ({
  word: 'bg-blue-900 text-blue-300',
  phrase: 'bg-purple-900 text-purple-300',
  pattern: 'bg-green-900 text-green-300',
})[currentEntry.value?.type] ?? 'bg-gray-800 text-gray-300')

// ── Actions ───────────────────────────────────────────────────────────────────
function speak(word) {
  if (!hasTTS.value) return
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.85
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

function reveal() {
  phase.value = 'revealed'
  // Auto-speak the word on reveal
  if (hasTTS.value && currentEntry.value) {
    speak(currentEntry.value.word)
  }
}

function mark(outcome) {
  const entry = currentEntry.value
  if (!entry) return
  markReview(entry.word, outcome)
  if (currentIdx.value < dueCards.value.length - 1) {
    currentIdx.value++
  } else {
    sessionComplete.value = true
    if (supportsPush.value && Notification.permission === 'default') {
      showPushPrompt.value = true
    }
  }
}

async function enablePush() {
  showPushPrompt.value = false
  await subscribePush()
}

function dismissPush() {
  showPushPrompt.value = false
}

function goHome() {
  window.location.href = '/'
}
</script>
