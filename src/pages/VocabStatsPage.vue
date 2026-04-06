<template>
  <div class="min-h-screen bg-black text-white pb-16">
    <!-- Header -->
    <div class="sticky top-0 z-20 bg-black/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
      <button
        class="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center
               rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        @click="goHome"
      >←</button>
      <h1 class="text-lg font-bold flex-1">學習排行榜</h1>
      <span class="text-gray-500 text-sm">{{ currentListMeta?.emoji }} {{ currentListMeta?.label }}</span>
    </div>

    <!-- Learning Path Guide -->
    <div class="px-4 pt-4">
      <div class="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        <template v-for="(path, i) in learningPath" :key="path.list">
          <button
            class="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all min-h-[32px]"
            :class="selectedList === path.list
              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
              : pathCompleted(path.list)
                ? 'bg-green-900/50 text-green-400 border border-green-800'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
            @click="selectList(path.list)"
          >
            {{ pathCompleted(path.list) ? '✓ ' : '' }}{{ path.label }}
          </button>
          <span v-if="i < learningPath.length - 1" class="text-gray-700 flex-shrink-0 text-xs">→</span>
        </template>
      </div>
    </div>

    <!-- Milestone Progress -->
    <div v-if="!loading && words.length > 0" class="mx-4 mt-3">
      <div
        class="rounded-2xl px-4 py-3 transition-all"
        :class="milestoneReached ? 'bg-yellow-900/40 border border-yellow-700' : 'bg-gray-900'"
      >
        <div v-if="milestoneReached" class="text-center py-1">
          <p class="text-2xl mb-1">🎓</p>
          <p class="text-yellow-300 font-bold text-sm">{{ currentListMeta?.label }} Top {{ currentPage * 100 }} 完成！</p>
          <button
            v-if="!isLastPage"
            class="mt-2 bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-semibold min-h-[36px]"
            @click="loadNextPage"
          >繼續挑戰 {{ currentPage * 100 + 1 }}–{{ (currentPage + 1) * 100 }} →</button>
        </div>
        <div v-else class="flex items-center gap-3">
          <div class="flex-1">
            <div class="flex justify-between text-xs text-gray-400 mb-1">
              <span>已學 {{ milestoneCount }} / {{ words.length }}</span>
              <span v-if="milestoneCount > 0" class="text-green-400">{{ Math.round(milestoneCount / words.length * 100) }}%</span>
            </div>
            <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-green-600 rounded-full transition-all duration-500"
                :style="{ width: (milestoneCount / words.length * 100) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Bootstrap SRS -->
    <div v-if="showBootstrap && !loading && words.length > 0" class="mx-4 mt-3 bg-blue-950/50 border border-blue-800 rounded-2xl px-4 py-3">
      <p class="text-blue-300 text-sm font-semibold mb-1">快速分類</p>
      <p class="text-gray-400 text-xs mb-3">先做個快速測試，把你已知的詞放到底部，讓最值得學的詞排上來。</p>
      <div v-if="bootstrapWord" class="text-center py-2">
        <p class="text-white text-2xl font-bold mb-1">{{ bootstrapWord }}</p>
        <p class="text-gray-400 text-sm mb-3">{{ lookupMeaning(bootstrapWord) || '...' }}</p>
        <div class="flex gap-2">
          <button
            class="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-sm font-semibold min-h-[40px]"
            @click="bootstrapAnswer(false)"
          >不熟</button>
          <button
            class="flex-1 bg-green-700 text-white py-2 rounded-xl text-sm font-semibold min-h-[40px]"
            @click="bootstrapAnswer(true)"
          >我會了 ✓</button>
        </div>
        <p class="text-gray-600 text-xs mt-2">{{ bootstrapIdx + 1 }} / {{ bootstrapWords.length }}</p>
      </div>
      <div v-else class="flex gap-2">
        <button
          class="flex-1 bg-gray-800 text-gray-300 text-xs py-2 rounded-xl min-h-[36px]"
          @click="showBootstrap = false"
        >略過</button>
        <button
          class="flex-1 bg-blue-600 text-white text-sm font-semibold py-2 rounded-xl min-h-[36px]"
          @click="startBootstrap"
        >開始快速分類</button>
      </div>
    </div>

    <!-- Search -->
    <div v-if="!loading && words.length > 0" class="px-4 mt-3">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜尋單字..."
        class="w-full bg-gray-900 border border-gray-800 text-white text-sm rounded-xl px-4 py-2.5
               placeholder-gray-600 focus:outline-none focus:border-gray-600 min-h-[44px]"
      />
    </div>

    <!-- List picker -->
    <div v-if="levelFilteredLists.length > 1" class="px-4 pt-3">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="list in levelFilteredLists"
          :key="list.id"
          class="text-xs px-3 py-2 rounded-xl font-medium transition-colors min-h-[36px]"
          :class="selectedList === list.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
          @click="selectList(list.id)"
        >{{ list.emoji }} {{ list.label }}</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="px-4 pt-4 space-y-2">
      <div v-for="i in 10" :key="i" class="h-12 bg-gray-900 rounded-xl animate-pulse"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center py-20 gap-4 px-8 text-center">
      <p class="text-red-400">{{ error }}</p>
      <button class="bg-gray-700 text-white px-6 py-3 rounded-2xl min-h-[44px]" @click="load">重試</button>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredWords.length === 0 && !loading" class="flex flex-col items-center py-24 gap-3 px-8 text-center">
      <p class="text-4xl">📊</p>
      <p class="text-white text-base font-semibold">
        {{ searchQuery ? '找不到符合的單字' : '還沒有統計資料' }}
      </p>
      <p class="text-gray-500 text-sm">
        {{ searchQuery ? '換個關鍵字試試' : '影片入庫並掃描詞彙索引後，這裡會顯示排行' }}
      </p>
    </div>

    <!-- Leaderboard -->
    <div v-else class="px-4 pt-3">
      <div class="space-y-1">
        <template v-for="(item, idx) in filteredWords" :key="item.word">
          <!-- Word row -->
          <div
            class="rounded-xl overflow-hidden transition-all duration-300"
            :class="[
              srsStatuses[item.word] === 'mastered'
                ? 'opacity-50'
                : '',
              expandedWord === item.word ? 'ring-1 ring-blue-700' : ''
            ]"
          >
            <div
              class="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
              :class="srsStatuses[item.word] === 'mastered' ? 'bg-gray-900/50' : 'bg-gray-900 hover:bg-gray-800'"
              @click="toggleExpand(item.word)"
            >
              <!-- Rank -->
              <span
                class="text-xs font-mono w-7 text-right flex-shrink-0"
                :class="idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-600'"
              >{{ item.rank }}</span>

              <!-- Word + bar -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="font-semibold text-sm"
                    :class="srsStatuses[item.word] === 'mastered' ? 'text-gray-400 line-through' : 'text-white'"
                  >{{ item.word }}</span>
                  <span class="text-gray-500 text-xs truncate">{{ lookupMeaning(item.word) }}</span>
                  <span
                    v-if="srsStatuses[item.word] === 'learning'"
                    class="text-xs text-blue-400 flex-shrink-0"
                  >複習中</span>
                </div>
                <div class="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="barColor(idx)"
                    :style="{ width: barWidth(item.video_count) + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Count -->
              <span class="text-gray-600 text-xs flex-shrink-0">{{ item.video_count }} 部</span>

              <!-- Mastery button -->
              <button
                class="flex-shrink-0 w-9 h-9 min-h-[36px] rounded-full flex items-center justify-center
                       text-sm font-bold transition-all active:scale-90"
                :class="srsStatuses[item.word] === 'mastered'
                  ? 'bg-green-800/80 text-green-300'
                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'"
                :title="srsStatuses[item.word] === 'mastered' ? '取消：我不熟' : '我會了'"
                @click.stop="toggleMastery(item.word)"
              >{{ srsStatuses[item.word] === 'mastered' ? '✓' : '+' }}</button>
            </div>

            <!-- Inline panel (expanded) -->
            <div
              v-if="expandedWord === item.word"
              class="bg-gray-950 border-t border-gray-800 px-4 py-4"
            >
              <!-- cedict meaning -->
              <div class="mb-3">
                <p class="text-xs text-gray-500 mb-1">中文釋義</p>
                <p class="text-white text-sm">{{ lookupMeaning(item.word) || '（查無釋義）' }}</p>
              </div>

              <!-- Examples loading -->
              <div v-if="examplesLoading" class="space-y-2 mb-3">
                <p class="text-xs text-gray-500 mb-1">真實例句</p>
                <div v-for="i in 3" :key="i" class="h-10 bg-gray-800 rounded-lg animate-pulse"></div>
              </div>

              <!-- Examples -->
              <div v-else-if="examples.length > 0" class="mb-3">
                <p class="text-xs text-gray-500 mb-2">來自真實影片的例句</p>
                <div class="space-y-3">
                  <div
                    v-for="ex in examples"
                    :key="ex.video_id + ex.start"
                    class="bg-gray-900 rounded-xl p-3"
                  >
                    <p class="text-gray-200 text-sm leading-relaxed mb-2">
                      <span v-html="highlightWord(ex.text, item.word)"></span>
                    </p>
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-gray-500 text-xs truncate flex-1">{{ ex.title }}</p>
                      <!-- YouTube clip embed button -->
                      <button
                        class="flex-shrink-0 text-xs text-blue-400 hover:text-blue-300 underline min-h-[32px] px-2"
                        @click="playClip(ex)"
                      >▶ 播放片段</button>
                    </div>
                    <!-- YouTube iframe (shown when clip is playing) -->
                    <div
                      v-if="playingClip?.video_id === ex.video_id && playingClip?.start === ex.start"
                      class="mt-2 rounded-xl overflow-hidden aspect-video"
                    >
                      <iframe
                        :src="`https://www.youtube.com/embed/${ex.video_id}?start=${Math.floor(ex.start)}&autoplay=1&rel=0`"
                        class="w-full h-full"
                        frameborder="0"
                        allow="autoplay; encrypted-media"
                        allowfullscreen
                      ></iframe>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty examples -->
              <div v-else-if="!examplesLoading" class="mb-3">
                <p class="text-xs text-gray-500 mb-1">真實例句</p>
                <p class="text-gray-600 text-sm">暫無例句（此詞可能未出現在已索引的影片字幕中）</p>
              </div>

              <!-- Action buttons -->
              <div class="flex gap-2 mt-1">
                <button
                  v-if="srsStatuses[item.word] !== 'mastered'"
                  class="flex-1 bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl min-h-[44px] active:scale-95 transition-transform"
                  @click="markKnownAndCollapse(item.word)"
                >✓ 我會了</button>
                <button
                  v-if="srsStatuses[item.word] !== 'mastered'"
                  class="bg-gray-800 text-gray-400 text-sm px-3 py-2.5 rounded-xl min-h-[44px]"
                  @click="markUnsureAndCollapse(item.word)"
                >之後再複習</button>
                <button
                  class="bg-gray-800 text-gray-500 text-sm px-3 py-2.5 rounded-xl min-h-[44px]"
                  @click="expandedWord = null; playingClip = null"
                >✕</button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Load next page button (when not yet milestone reached) -->
      <div v-if="milestoneReached && !isLastPage" class="mt-6 text-center">
        <button
          class="bg-blue-600 text-white px-8 py-3 rounded-2xl font-semibold min-h-[44px]"
          @click="loadNextPage"
        >繼續挑戰 {{ currentPage * 100 + 1 }}–{{ (currentPage + 1) * 100 }} →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getVocabStats, getWordExamples } from '@/services/api.js'
import { VOCAB_LISTS, getSrsStatus } from '@/lib/vocabLists.js'
import { lookupMeaning } from '@/lib/lookup.js'
import { markWordKnown, markWordUnsure } from '@/composables/useSRS.js'

// ── Learning path config ─────────────────────────────────────────────────────

const learningPath = [
  { list: 'ngsl',     label: 'NGSL 基礎' },
  { list: 'coca',     label: 'COCA 5000' },
  { list: 'ielts',    label: 'IELTS' },
  { list: 'academic', label: '學術詞' },
  { list: 'cefr_c1',  label: 'C1 高級' },
]

// Visible list picker (all available lists for more options)
const levelFilteredLists = computed(() => {
  if (!availableLists.value) return VOCAB_LISTS
  return VOCAB_LISTS.filter(l => availableLists.value.includes(l.id))
})

// ── State ────────────────────────────────────────────────────────────────────

const loading         = ref(true)
const error           = ref(null)
const words           = ref([])            // raw from API, sorted by video_count DESC
const siteStats       = ref(null)
const availableLists  = ref(null)
const selectedList    = ref('ngsl')
const currentPage     = ref(1)             // 1 = top 100, 2 = 101-200, etc.
const isLastPage      = ref(false)

// Inline panel state
const expandedWord    = ref(null)
const examples        = ref([])
const examplesLoading = ref(false)
const playingClip     = ref(null)          // { video_id, start }

// Search
const searchQuery     = ref('')

// Reactive SRS statuses
const srsStatuses     = ref({})

// Bootstrap quiz
const showBootstrap   = ref(false)
const bootstrapWords  = ref([])
const bootstrapIdx    = ref(0)
const bootstrapWord   = computed(() => bootstrapWords.value[bootstrapIdx.value] ?? null)

// ── Milestone system ─────────────────────────────────────────────────────────

function milestoneKey(list, page) {
  return `jolike_milestone_${list}_${page}`
}

const milestoneCount = computed(() => {
  let count = 0
  for (const w of words.value) {
    if (srsStatuses.value[w.word] === 'mastered') count++
  }
  return count
})

const milestoneReached = computed(() => milestoneCount.value >= words.value.length && words.value.length > 0)

// Track milestone achievement in localStorage to persist across sessions
watch(milestoneReached, (reached) => {
  if (reached) {
    localStorage.setItem(milestoneKey(selectedList.value, currentPage.value), '1')
  }
})

function pathCompleted(listId) {
  return localStorage.getItem(milestoneKey(listId, 1)) === '1'
}

// ── SRS helpers ──────────────────────────────────────────────────────────────

function syncSrsStatuses() {
  const map = {}
  for (const item of words.value) map[item.word] = getSrsStatus(item.word)
  srsStatuses.value = map
}

function personalize(rawWords) {
  return rawWords.map((item, originalIdx) => ({
    ...item,
    rank: originalIdx + 1 + (currentPage.value - 1) * 100,
    learningValue: item.video_count * (1 - masteryFactor(item.word)),
  })).sort((a, b) => b.learningValue - a.learningValue)
}

function masteryFactor(word) {
  const status = getSrsStatus(word)
  if (status === 'mastered') return 1.0
  if (status === 'learning' || status === 'familiar') return 0.4
  return 0.0
}

function toggleMastery(word) {
  const current = srsStatuses.value[word] ?? 'new'
  if (current === 'mastered') {
    markWordUnsure(word)
    srsStatuses.value = { ...srsStatuses.value, [word]: 'learning' }
  } else {
    markWordKnown(word, lookupMeaning(word))
    srsStatuses.value = { ...srsStatuses.value, [word]: 'mastered' }
  }
}

// ── Computed words ───────────────────────────────────────────────────────────

const sortedWords = computed(() => personalize(words.value))

const filteredWords = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return sortedWords.value
  return sortedWords.value.filter(item => item.word.toLowerCase().includes(q))
})

const maxCount = computed(() => words.value[0]?.video_count ?? 1)

// ── Inline expand ────────────────────────────────────────────────────────────

async function toggleExpand(word) {
  if (expandedWord.value === word) {
    expandedWord.value = null
    playingClip.value = null
    return
  }
  expandedWord.value = word
  playingClip.value = null
  examples.value = []
  examplesLoading.value = true
  try {
    examples.value = await getWordExamples(word, selectedList.value, 3)
  } catch {
    examples.value = []
  } finally {
    examplesLoading.value = false
  }
}

function playClip(ex) {
  if (playingClip.value?.video_id === ex.video_id && playingClip.value?.start === ex.start) {
    playingClip.value = null
  } else {
    playingClip.value = { video_id: ex.video_id, start: ex.start }
  }
}

function markKnownAndCollapse(word) {
  markWordKnown(word, lookupMeaning(word))
  srsStatuses.value = { ...srsStatuses.value, [word]: 'mastered' }
  expandedWord.value = null
  playingClip.value = null
}

function markUnsureAndCollapse(word) {
  markWordUnsure(word)
  srsStatuses.value = { ...srsStatuses.value, [word]: 'learning' }
  expandedWord.value = null
  playingClip.value = null
}

// ── Bootstrap quiz ───────────────────────────────────────────────────────────

function checkShowBootstrap() {
  // Show bootstrap only if user has no SRS data yet for this list
  const hasAny = words.value.some(w => getSrsStatus(w.word) !== 'new')
  showBootstrap.value = !hasAny && words.value.length > 0
}

function startBootstrap() {
  // Sample up to 20 words from the list for quick classification
  const sample = words.value.slice(0, 20).map(w => w.word)
  bootstrapWords.value = sample
  bootstrapIdx.value = 0
}

function bootstrapAnswer(known) {
  const word = bootstrapWord.value
  if (!word) return
  if (known) {
    markWordKnown(word, lookupMeaning(word))
    srsStatuses.value = { ...srsStatuses.value, [word]: 'mastered' }
  }
  bootstrapIdx.value++
  if (bootstrapIdx.value >= bootstrapWords.value.length) {
    showBootstrap.value = false
    bootstrapWords.value = []
    bootstrapIdx.value = 0
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function barWidth(count) {
  return Math.round((count / maxCount.value) * 100)
}

function barColor(idx) {
  if (idx === 0) return 'bg-yellow-500'
  if (idx === 1) return 'bg-gray-400'
  if (idx === 2) return 'bg-amber-700'
  if (idx < 10)  return 'bg-blue-600'
  return 'bg-gray-700'
}

function highlightWord(text, word) {
  if (!text || !word) return text
  // HTML-escape first to prevent XSS — text comes from external transcript data
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const re = new RegExp(`(\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b)`, 'gi')
  return escaped.replace(re, '<mark class="bg-yellow-400/30 text-yellow-200 rounded px-0.5">$1</mark>')
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value = null
  expandedWord.value = null
  playingClip.value = null
  try {
    const offset = (currentPage.value - 1) * 100
    const { words: w, stats, available_lists } = await getVocabStats(selectedList.value, 100, offset)
    if (stats) siteStats.value = stats
    if (available_lists) availableLists.value = available_lists
    words.value = w
    isLastPage.value = w.length < 100
    syncSrsStatuses()
    checkShowBootstrap()
  } catch {
    error.value = '載入失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}

function selectList(id) {
  selectedList.value = id
  currentPage.value = 1
  searchQuery.value = ''
  load()
}

async function loadNextPage() {
  currentPage.value++
  searchQuery.value = ''
  await load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const currentListMeta = computed(() => VOCAB_LISTS.find(l => l.id === selectedList.value))

function goHome() {
  window.location.href = '/'
}

onMounted(load)
</script>
