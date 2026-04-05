<template>
  <div class="min-h-screen bg-black text-white px-4 py-8 max-w-sm mx-auto">
<!-- Header -->
    <div class="flex items-center gap-3 mb-8">
      <button
        class="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        @click="goHome"
      >
        ←
      </button>
      <h1 class="text-xl font-bold">我的詞彙進度</h1>
    </div>

    <!-- Empty state -->
    <div v-if="totalWords === 0" class="text-center py-16 space-y-4">
      <p class="text-5xl">📚</p>
      <p class="text-white text-lg font-semibold">還沒有學習記錄</p>
      <p class="text-gray-400 text-sm">學習影片後，將難詞標記「不確定」就會加入複習清單</p>
      <button
        class="mt-4 bg-blue-600 text-white px-8 py-3 rounded-2xl font-semibold min-h-[56px]"
        @click="goHome"
      >
        開始學習
      </button>
    </div>

    <!-- Stats -->
    <div v-else class="space-y-6">
<!-- Streak banner -->
      <div
        v-if="streak > 0"
        class="rounded-2xl p-4 text-center"
        :class="streak >= 7 ? 'bg-orange-900/60 border border-orange-700' : 'bg-gray-900'"
      >
        <p class="text-3xl font-bold" :class="streak >= 7 ? 'text-orange-400' : 'text-yellow-400'">
          🔥 {{ streak }} 天
        </p>
        <p class="text-gray-400 text-xs mt-1">連續複習天數</p>
      </div>

      <!-- Overview cards -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-gray-900 rounded-2xl p-4 text-center">
          <p class="text-3xl font-bold text-white">{{ totalWords }}</p>
          <p class="text-gray-400 text-xs mt-1">加入複習庫</p>
        </div>
        <div
          class="rounded-2xl p-4 text-center"
          :class="dueCount > 0 ? 'bg-yellow-900/60 border border-yellow-700' : 'bg-gray-900'"
        >
          <p class="text-3xl font-bold" :class="dueCount > 0 ? 'text-yellow-400' : 'text-white'">
            {{ dueCount }}
          </p>
          <p class="text-gray-400 text-xs mt-1">今日待複習</p>
        </div>
        <div class="bg-gray-900 rounded-2xl p-4 text-center">
          <p class="text-3xl font-bold text-white">{{ totalReviews }}</p>
          <p class="text-gray-400 text-xs mt-1">累積複習次數</p>
        </div>
        <div class="bg-gray-900 rounded-2xl p-4 text-center">
          <p class="text-xl font-bold text-white">{{ nextReviewLabel }}</p>
          <p class="text-gray-400 text-xs mt-1">下次複習</p>
        </div>
      </div>

      <!-- Learning stage breakdown -->
      <div class="bg-gray-900 rounded-2xl p-5 space-y-4">
        <h2 class="text-white font-semibold text-sm uppercase tracking-wider">學習階段</h2>
        <div
          v-for="stage in stages"
          :key="stage.label"
          class="flex items-center gap-3"
        >
          <span class="text-lg w-6 text-center flex-shrink-0">{{ stage.icon }}</span>
          <div class="flex-1">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm text-gray-300">{{ stage.label }}</span>
              <span class="text-sm font-semibold text-white">{{ stage.count }}</span>
            </div>
            <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="stage.barColor"
                :style="{ width: totalWords > 0 ? (stage.count / totalWords * 100) + '%' : '0%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- CEFR tier breakdown -->
      <div class="bg-gray-900 rounded-2xl p-5 space-y-4">
        <h2 class="text-white font-semibold text-sm uppercase tracking-wider">詞彙等級分布</h2>
        <div
          v-for="tier in tierBreakdown"
          :key="tier.label"
          class="flex items-center gap-3"
        >
          <span
            class="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 w-12 text-center"
            :class="tier.badgeClass"
          >
            {{ tier.cefr }}
          </span>
          <div class="flex-1">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm text-gray-300">{{ tier.label }}</span>
              <span class="text-sm font-semibold text-white">{{ tier.count }}</span>
            </div>
            <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="tier.barColor"
                :style="{ width: totalWords > 0 ? (tier.count / totalWords * 100) + '%' : '0%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Review button -->
      <button
        v-if="dueCount > 0"
        class="w-full bg-yellow-500 text-black py-4 rounded-2xl font-semibold text-lg min-h-[56px]"
        @click="() => (window.location.href = '/review/')"
      >
        複習到期單字（{{ dueCount }} 個）
      </button>

      <!-- Export / backup -->
      <button
        class="w-full bg-gray-900 border border-gray-700 text-gray-400 py-3 rounded-2xl font-medium text-sm min-h-[48px] hover:bg-gray-800 transition-colors"
        :title="`匯出 ${totalWords} 個詞彙的學習記錄（JSON）`"
        @click="exportData"
      >
        ↓ 匯出詞彙記錄備份
      </button>
</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getStreak } from '@/composables/useSRS.js'

const MS_PER_DAY = 86400 * 1000
const PREFIX = 'jolike_srs_'

// Read all SRS entries from localStorage
function getAllEntries() {
  const entries = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(k))
      if (entry) entries.push(entry)
    } catch { /* skip corrupt */ }
  }
  return entries
}

const entries = getAllEntries()
const now = Date.now()
const { streak } = getStreak()

const totalWords = computed(() => entries.length)
const dueCount = computed(() => entries.filter(e => e.nextReview <= now).length)
const totalReviews = computed(() => entries.reduce((sum, e) => sum + (e.reviews ?? 0), 0))

const nextReviewLabel = computed(() => {
  const future = entries
    .filter(e => e.nextReview > now)
    .map(e => e.nextReview)
  if (future.length === 0) return dueCount.value > 0 ? '現在' : '—'
  const next = Math.min(...future)
  const msLeft = next - now
  const hours = Math.floor(msLeft / 3600000)
  const days = Math.floor(msLeft / MS_PER_DAY)
  if (days >= 1) return `${days} 天後`
  if (hours >= 1) return `${hours} 小時後`
  return '< 1 小時'
})

// Learning stage buckets by interval
const stages = computed(() => {
  const buckets = { new: 0, learning: 0, familiar: 0, mastered: 0 }
  for (const e of entries) {
    if (e.interval === 1) buckets.new++
    else if (e.interval <= 7) buckets.learning++
    else if (e.interval <= 30) buckets.familiar++
    else buckets.mastered++
  }
  return [
    { icon: '🌱', label: '新詞（1天）', count: buckets.new, barColor: 'bg-gray-400' },
    { icon: '📚', label: '學習中（2-7天）', count: buckets.learning, barColor: 'bg-blue-500' },
    { icon: '✅', label: '熟悉（8-30天）', count: buckets.familiar, barColor: 'bg-teal-500' },
    { icon: '🏆', label: '精通（31-90天）', count: buckets.mastered, barColor: 'bg-yellow-500' },
  ]
})

// CEFR tier distribution
const tierBreakdown = computed(() => {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const e of entries) {
    const t = e.difficulty_tier ?? 4
    counts[t] = (counts[t] ?? 0) + 1
  }
  return [
    {
      cefr: 'A1-A2',
      label: '基礎詞彙',
      count: counts[1],
      badgeClass: 'bg-gray-700 text-gray-300',
      barColor: 'bg-gray-500',
    },
    {
      cefr: 'B1',
      label: '中級詞彙',
      count: counts[2],
      badgeClass: 'bg-teal-900 text-teal-300',
      barColor: 'bg-teal-500',
    },
    {
      cefr: 'B2',
      label: '學術詞彙',
      count: counts[3],
      badgeClass: 'bg-blue-900 text-blue-300',
      barColor: 'bg-blue-500',
    },
    {
      cefr: 'C1+',
      label: '進階詞彙',
      count: counts[4],
      badgeClass: 'bg-purple-900 text-purple-300',
      barColor: 'bg-purple-500',
    },
  ]
})

function goHome() {
  window.location.href = '/'
}

function exportData() {
  const data = getAllEntries()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jolike-vocabulary-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
