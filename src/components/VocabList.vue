<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/60"
    @click="$emit('close')"
  ></div>

  <!-- Drawer panel (slides in from right) -->
  <div class="fixed inset-y-0 right-0 z-50 w-4/5 max-w-xs bg-gray-900 flex flex-col shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-4 border-b border-gray-700">
      <h2 class="text-white font-bold text-base">單字總表</h2>
      <button
        class="text-gray-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
        @click="$emit('close')"
      >✕</button>
    </div>

    <!-- List tabs -->
    <div class="border-b border-gray-800 overflow-x-auto flex-shrink-0">
      <div class="flex px-3 pt-2 pb-0 gap-1 min-w-max">
        <!-- 本影片 tab -->
        <button
          class="flex-shrink-0 text-xs px-3 py-1.5 rounded-t-lg font-medium transition-colors border-b-2"
          :class="activeTab === 'video'
            ? 'bg-gray-800 text-white border-blue-500'
            : 'text-gray-500 hover:text-gray-300 border-transparent'"
          @click="activeTab = 'video'"
        >
          🎬 本影片
        </button>
        <!-- Vocab list tabs -->
        <button
          v-for="list in VOCAB_LISTS"
          :key="list.id"
          class="flex-shrink-0 text-xs px-3 py-1.5 rounded-t-lg font-medium transition-colors border-b-2"
          :class="activeTab === list.id
            ? 'bg-gray-800 text-white border-blue-500'
            : 'text-gray-500 hover:text-gray-300 border-transparent'"
          @click="switchTab(list.id)"
        >
          {{ list.emoji }} {{ list.label.split(' ')[0] }}
        </button>
      </div>
    </div>

    <!-- ── 本影片 content ────────────────────────────────────────────────── -->
    <template v-if="activeTab === 'video'">
      <!-- Summary row -->
      <div class="flex gap-4 px-4 py-3 text-xs text-gray-400 border-b border-gray-800">
        <span>共 {{ cards.length }} 張</span>
        <span class="text-green-400">✓ {{ knownCount }} 已會</span>
        <span class="text-gray-500">○ {{ unseenCount }} 未看</span>
      </div>

      <ul class="flex-1 overflow-y-auto divide-y divide-gray-800">
        <li
          v-for="(card, index) in cards"
          :key="card.id"
          class="flex items-center gap-3 px-4 py-3 min-h-[52px] cursor-pointer transition-colors"
          :class="[
            index === currentIndex ? 'bg-blue-900/40 vocab-list-active' : 'hover:bg-gray-800'
          ]"
          @click="onJump(index)"
        >
          <span class="text-base w-5 flex-shrink-0 text-center" :title="statusLabel(card.id)">
            {{ statusIcon(card.id) }}
          </span>
          <span
            class="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            :class="typeBadgeClass(card.type)"
          >{{ typeLabel(card.type) }}</span>
          <span
            class="text-white text-sm font-medium truncate flex-1"
            :class="{ 'text-blue-300': index === currentIndex }"
          >{{ card.keyword }}</span>
          <span class="text-gray-500 text-xs truncate max-w-[60px] flex-shrink-0">
            {{ card.meaning_zh }}
          </span>
        </li>
      </ul>
    </template>

    <!-- ── Vocab list content ────────────────────────────────────────────── -->
    <template v-else>
      <!-- Summary row -->
      <div class="flex gap-3 px-4 py-2.5 text-xs text-gray-400 border-b border-gray-800 items-center">
        <span v-if="listLoading" class="animate-spin text-gray-600">⟳</span>
        <span v-else>此影片 {{ vocabWords.length }} 個詞</span>
        <span v-if="!listLoading && vocabLearnedCount > 0" class="text-teal-400">已學 {{ vocabLearnedCount }}</span>
      </div>

      <!-- Loading skeleton -->
      <div v-if="listLoading" class="flex-1 flex flex-col items-center justify-center gap-2 p-4">
        <div v-for="i in 5" :key="i" class="w-full h-10 bg-gray-800 rounded-xl animate-pulse"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="vocabWords.length === 0" class="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p class="text-gray-500 text-sm">此影片沒有 {{ activeListMeta?.label }} 詞彙</p>
        <p class="text-gray-600 text-xs mt-1">可點「學習此清單」學習完整詞彙庫</p>
      </div>

      <!-- Word list -->
      <ul v-else class="flex-1 overflow-y-auto divide-y divide-gray-800">
        <li
          v-for="word in vocabWords"
          :key="word.word"
          class="flex items-center gap-3 px-4 py-2.5 min-h-[44px] cursor-pointer hover:bg-gray-800 transition-colors"
          :class="word.cardIndex === currentIndex ? 'bg-blue-900/30' : ''"
          @click="onJump(word.cardIndex)"
        >
          <!-- SRS status icon -->
          <span class="text-sm w-5 flex-shrink-0 text-center">
            {{ statusIcon(word.cardId) }}
          </span>
          <!-- Word -->
          <span class="text-white text-sm font-medium flex-1 truncate"
            :class="word.cardIndex === currentIndex ? 'text-blue-300' : ''"
          >{{ word.word }}</span>
          <!-- Meaning -->
          <span class="text-gray-600 text-xs truncate max-w-[64px] flex-shrink-0">{{ word.meaning }}</span>
          <!-- SRS label -->
          <span
            v-if="word.srsStatus !== 'new'"
            class="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
            :class="{
              'bg-blue-900/60 text-blue-400': word.srsStatus === 'learning',
              'bg-teal-900/60 text-teal-400': word.srsStatus === 'familiar',
              'bg-yellow-900/60 text-yellow-400': word.srsStatus === 'mastered',
            }"
          >{{ { learning: '學習中', familiar: '熟悉', mastered: '精通' }[word.srsStatus] }}</span>
        </li>
      </ul>

      <!-- Study this list button -->
      <div class="p-4 border-t border-gray-800 flex-shrink-0">
        <button
          class="w-full py-3.5 rounded-2xl font-semibold text-sm min-h-[52px] transition-colors
                 bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2"
          @click="studyList"
        >
          <span>📝</span>
          <span>學習此清單</span>
          <span class="text-blue-300 text-xs">({{ activeListMeta?.label }})</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { VOCAB_LISTS, loadWordList, getSrsStatus } from '@/lib/vocabLists.js'
import { lookupMeaning } from '@/lib/lookup.js'

const props = defineProps({
  cards:        { type: Array,    required: true },
  currentIndex: { type: Number,   required: true },
  cardStatus:   { type: Function, required: true },
})

const emit = defineEmits(['close', 'jump'])

// ── Tab state ─────────────────────────────────────────────────────────────────
const activeTab = ref('video')

onMounted(() => {
  nextTick(() => {
    const activeItem = document.querySelector('.vocab-list-active')
    activeItem?.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
})

// ── 本影片 helpers ────────────────────────────────────────────────────────────
const knownCount  = computed(() => props.cards.filter(c => props.cardStatus(c.id) === 'known').length)
const unseenCount = computed(() => props.cards.filter(c => !props.cardStatus(c.id)).length)

function statusIcon(cardId) {
  const s = props.cardStatus(cardId)
  if (s === 'known') return '✓'
  if (s === 'unsure') return '?'
  return '○'
}

function statusLabel(cardId) {
  const s = props.cardStatus(cardId)
  if (s === 'known') return '已會'
  if (s === 'unsure') return '不熟'
  return '未看'
}

function typeLabel(type) {
  return { word: '單字', phrase: '片語', pattern: '句型' }[type] ?? type
}

function typeBadgeClass(type) {
  return {
    word: 'bg-blue-900 text-blue-300',
    phrase: 'bg-purple-900 text-purple-300',
    pattern: 'bg-green-900 text-green-300',
  }[type] ?? 'bg-gray-800 text-gray-300'
}

function onJump(index) {
  emit('jump', index)
  emit('close')
}

// ── Vocab list tab ─────────────────────────────────────────────────────────────
const listLoading = ref(false)
const vocabWords  = ref([])  // [{ word, meaning, srsStatus, cardIndex, cardId }]

const activeListMeta = computed(() => VOCAB_LISTS.find(l => l.id === activeTab.value) ?? null)

const vocabLearnedCount = computed(() => vocabWords.value.filter(w => w.srsStatus !== 'new').length)

async function switchTab(listId) {
  activeTab.value = listId
  await loadVocabList(listId)
}

async function loadVocabList(listId) {
  listLoading.value = true
  vocabWords.value = []
  try {
    const words = await loadWordList(listId)
    const wordSet = new Set(words.map(w => w.toLowerCase()))
    // Only show cards from the current video that belong to this vocab list
    vocabWords.value = props.cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => wordSet.has(card.keyword.toLowerCase()))
      .map(({ card, index }) => ({
        word: card.keyword,
        meaning: card.meaning_zh,
        srsStatus: getSrsStatus(card.keyword),
        cardIndex: index,
        cardId: card.id,
      }))
  } finally {
    listLoading.value = false
  }
}


function studyList() {
  if (!activeListMeta.value) return
  window.location.href = `/vocab-study/?list=${activeListMeta.value.id}`
}
</script>
