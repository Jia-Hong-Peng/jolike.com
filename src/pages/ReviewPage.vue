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

      <!-- Video clip (reuses existing VideoClip component) -->
      <div class="rounded-2xl overflow-hidden bg-gray-950 relative" style="height: 220px">
        <VideoClip
          :key="currentEntry.word"
          :video-id="currentEntry.videoId"
          :start="currentEntry.clip_start"
          :end="currentEntry.clip_end"
        />
      </div>

      <!-- Card info -->
      <div class="bg-gray-900 rounded-2xl px-6 py-5 space-y-3">
        <!-- Keyword + TTS -->
        <div class="flex items-center gap-3">
          <p class="text-2xl font-bold text-white">
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

        <!-- Chinese meaning -->
        <p
          v-if="currentEntry.meaning_zh && currentEntry.meaning_zh !== '—'"
          class="text-blue-300 text-base"
        >
          {{ currentEntry.meaning_zh }}
        </p>

        <!-- Sentence context with keyword highlighted -->
        <p
          v-if="currentEntry.sentence"
          class="text-gray-400 text-sm leading-relaxed"
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
    </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import VideoClip from '@/components/VideoClip.vue'
import { getDue, markReview } from '@/composables/useSRS.js'
import { subscribePush, isPushEnabled } from '@/composables/usePWA.js'

const loading = ref(true)
const dueCards = ref([])
const currentIdx = ref(0)
const sessionComplete = ref(false)
const showPushPrompt = ref(false)

const hasTTS = ref(typeof window !== 'undefined' && 'speechSynthesis' in window)
const supportsPush = ref(typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window)

onMounted(async () => {
  dueCards.value = getDue()
  loading.value = false
  // Pre-check if push already enabled so we don't re-prompt
  if (supportsPush.value) {
    const already = await isPushEnabled()
    if (already) showPushPrompt.value = false
  }
})

const currentEntry = computed(() => dueCards.value[currentIdx.value] ?? null)

const highlightedSentence = computed(() => {
  if (!currentEntry.value?.sentence) return ''
  const kw = currentEntry.value.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${kw})`, 'gi')
  return currentEntry.value.sentence.replace(
    regex,
    '<mark class="bg-yellow-400/30 text-yellow-300 rounded px-0.5">$1</mark>',
  )
})

function speak(word) {
  if (!hasTTS.value) return
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.85
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

async function mark(outcome) {
  const entry = currentEntry.value
  if (!entry) return
  markReview(entry.word, outcome)
  if (currentIdx.value < dueCards.value.length - 1) {
    currentIdx.value++
  } else {
    sessionComplete.value = true
    // After first completed review session, offer push notifications
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
