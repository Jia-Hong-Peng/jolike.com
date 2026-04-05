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
      <!-- Import in empty state too -->
      <button
        class="w-full bg-gray-900 border border-gray-700 text-gray-400 py-3 rounded-2xl font-medium text-sm min-h-[48px] hover:bg-gray-800 transition-colors"
        @click="triggerImport"
      >
        ↑ 匯入詞彙備份
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

      <!-- ── Word list ──────────────────────────────────────────────────────── -->
      <div class="bg-gray-900 rounded-2xl p-5 space-y-4">
        <div class="space-y-2">
          <h2 class="text-white font-semibold text-sm uppercase tracking-wider">我的單字庫</h2>
          <!-- Stage filter tabs -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="f in filters"
              :key="f.key"
              class="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
              :class="activeFilter === f.key
                ? 'bg-blue-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
              @click="activeFilter = f.key"
            >
              {{ f.label }}
            </button>
          </div>
        </div>

        <!-- Search -->
        <input
          v-model="searchQuery"
          type="search"
          placeholder="搜尋單字…"
          class="w-full bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 border border-gray-700
                 focus:border-blue-500 focus:outline-none placeholder-gray-600"
        />

        <!-- Word rows -->
        <div v-if="filteredWords.length === 0" class="text-center py-6 text-gray-600 text-sm">
          {{ searchQuery ? '沒有符合的單字' : '此階段沒有單字' }}
        </div>
        <ul v-else class="space-y-1">
          <li
            v-for="entry in filteredWords"
            :key="entry.word"
            class="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-white font-semibold text-sm">{{ entry.word }}</span>
                <span
                  class="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                  :class="stageClass(entry)"
                >
                  {{ stageName(entry) }}
                </span>
                <span
                  v-for="cat in (entry.categories || [])"
                  :key="cat"
                  class="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                  :class="categoryBadgeClass(cat)"
                >
                  {{ categoryLabel(cat) }}
                </span>
              </div>
              <p v-if="entry.meaning_zh" class="text-gray-500 text-xs mt-0.5 truncate">{{ entry.meaning_zh }}</p>
              <p class="text-gray-700 text-xs mt-0.5">{{ nextReviewText(entry) }}</p>
            </div>
            <!-- Delete button: requires second tap to confirm -->
            <button
              class="flex-shrink-0 w-9 h-9 min-w-[36px] flex items-center justify-center rounded-full transition-colors"
              :class="pendingDelete === entry.word
                ? 'bg-red-700 text-white'
                : 'bg-gray-800 text-gray-600 hover:text-red-400'"
              :title="pendingDelete === entry.word ? '再按一次確認刪除' : '刪除此單字'"
              @click="onDeleteTap(entry.word)"
              @blur="pendingDelete = null"
            >
              {{ pendingDelete === entry.word ? '✕' : '🗑' }}
            </button>
          </li>
        </ul>

        <!-- Word count footer -->
        <p class="text-gray-700 text-xs text-right pt-1">
          顯示 {{ filteredWords.length }} / {{ totalWords }} 個單字
        </p>
      </div>

      <!-- Export / backup -->
      <div class="flex gap-3">
        <button
          class="flex-1 bg-gray-900 border border-gray-700 text-gray-400 py-3 rounded-2xl font-medium text-sm min-h-[48px] hover:bg-gray-800 transition-colors"
          :title="`匯出 ${totalWords} 個詞彙的學習記錄（JSON）`"
          @click="exportData"
        >
          ↓ 匯出備份
        </button>
        <button
          class="flex-1 bg-gray-900 border border-gray-700 text-gray-400 py-3 rounded-2xl font-medium text-sm min-h-[48px] hover:bg-gray-800 transition-colors"
          title="從 JSON 備份檔匯入詞彙記錄"
          @click="triggerImport"
        >
          ↑ 匯入備份
        </button>
      </div>

      <!-- Import result toast -->
      <p v-if="importMsg" class="text-center text-sm" :class="importError ? 'text-red-400' : 'text-green-400'">
        {{ importMsg }}
      </p>
    </div>

    <!-- Hidden file input for import -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onFileSelected"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getStreak } from '@/composables/useSRS.js'

const MS_PER_DAY = 86400 * 1000
const PREFIX = 'jolike_srs_'

// ── Data ──────────────────────────────────────────────────────────────────────
// Use ref so deletions are reactive
const allEntries = ref(readAllEntries())

function readAllEntries() {
  const entries = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(PREFIX)) continue
    try {
      const entry = JSON.parse(localStorage.getItem(k))
      if (entry && entry.word) entries.push(entry)
    } catch { /* skip corrupt */ }
  }
  return entries
}

const streak = computed(() => getStreak().streak)

const totalWords    = computed(() => allEntries.value.length)
const dueCount      = computed(() => { const now = Date.now(); return allEntries.value.filter(e => e.nextReview <= now).length })
const totalReviews  = computed(() => allEntries.value.reduce((sum, e) => sum + (e.reviews ?? 0), 0))

const nextReviewLabel = computed(() => {
  const now = Date.now()
  const future = allEntries.value
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
  for (const e of allEntries.value) {
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
  for (const e of allEntries.value) {
    const t = e.difficulty_tier ?? 4
    counts[t] = (counts[t] ?? 0) + 1
  }
  return [
    { cefr: 'A1-A2', label: '基礎詞彙', count: counts[1], badgeClass: 'bg-gray-700 text-gray-300', barColor: 'bg-gray-500' },
    { cefr: 'B1',    label: '中級詞彙', count: counts[2], badgeClass: 'bg-teal-900 text-teal-300', barColor: 'bg-teal-500' },
    { cefr: 'B2',    label: '學術詞彙', count: counts[3], badgeClass: 'bg-blue-900 text-blue-300', barColor: 'bg-blue-500' },
    { cefr: 'C1+',   label: '進階詞彙', count: counts[4], badgeClass: 'bg-purple-900 text-purple-300', barColor: 'bg-purple-500' },
  ]
})

// ── Word list ─────────────────────────────────────────────────────────────────
const searchQuery = ref('')
const activeFilter = ref('all')
const pendingDelete = ref(null)

const categoryCount = (cat) => allEntries.value.filter(e => (e.categories || []).includes(cat)).length

const filters = computed(() => [
  { key: 'all',              label: `全部 (${allEntries.value.length})` },
  { key: 'due',              label: `待複習 (${dueCount.value})` },
  { key: 'mastered',         label: `精通 (${allEntries.value.filter(e => e.interval > 30).length})` },
  { key: 'academic',         label: `學術 (${categoryCount('academic')})` },
  { key: 'advanced_academic',label: `進階學術 (${categoryCount('advanced_academic')})` },
  { key: 'toeic',            label: `多益 (${categoryCount('toeic')})` },
])

const filteredWords = computed(() => {
  const now = Date.now()
  const q = searchQuery.value.toLowerCase().trim()
  const cat = activeFilter.value
  return allEntries.value
    .filter(e => {
      if (cat === 'due')               return e.nextReview <= now
      if (cat === 'mastered')          return e.interval > 30
      if (cat === 'academic' || cat === 'advanced_academic' || cat === 'toeic')
                                       return (e.categories || []).includes(cat)
      return true
    })
    .filter(e => !q || e.word.toLowerCase().includes(q) || (e.meaning_zh || '').includes(q))
    .sort((a, b) => a.word.localeCompare(b.word))
})

function stageName(entry) {
  if (entry.interval === 1)    return '新詞'
  if (entry.interval <= 7)     return '學習中'
  if (entry.interval <= 30)    return '熟悉'
  return '精通'
}

function stageClass(entry) {
  if (entry.interval === 1)    return 'bg-gray-700 text-gray-400'
  if (entry.interval <= 7)     return 'bg-blue-900/60 text-blue-400'
  if (entry.interval <= 30)    return 'bg-teal-900/60 text-teal-400'
  return 'bg-yellow-900/60 text-yellow-400'
}

function nextReviewText(entry) {
  const now = Date.now()
  const ms = entry.nextReview - now
  if (ms <= 0) return '待複習'
  const days = Math.floor(ms / MS_PER_DAY)
  const hours = Math.floor(ms / 3600000)
  if (days >= 1) return `${days} 天後複習`
  if (hours >= 1) return `${hours} 小時後`
  return '< 1 小時'
}

function onDeleteTap(word) {
  if (pendingDelete.value === word) {
    // Second tap: confirm delete
    localStorage.removeItem(PREFIX + word.toLowerCase())
    allEntries.value = allEntries.value.filter(e => e.word !== word)
    pendingDelete.value = null
  } else {
    // First tap: arm
    pendingDelete.value = word
    // Auto-disarm after 3 seconds
    setTimeout(() => {
      if (pendingDelete.value === word) pendingDelete.value = null
    }, 3000)
  }
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportData() {
  const data = allEntries.value
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jolike-vocabulary-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Import ────────────────────────────────────────────────────────────────────
const fileInputRef = ref(null)
const importMsg    = ref('')
const importError  = ref(false)

function triggerImport() {
  fileInputRef.value?.click()
}

function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  // Reset input so the same file can be selected again
  e.target.value = ''

  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result)
      if (!Array.isArray(parsed)) {
        showImportMsg('格式錯誤：備份檔應為 JSON 陣列', true)
        return
      }
      let imported = 0
      let skipped = 0
      for (const entry of parsed) {
        if (!entry.word || typeof entry.interval !== 'number' || typeof entry.nextReview !== 'number') {
          skipped++
          continue
        }
        const key = PREFIX + entry.word.toLowerCase()
        const existing = localStorage.getItem(key)
        if (existing) {
          // Keep the one with more review progress
          try {
            const cur = JSON.parse(existing)
            if ((cur.reviews ?? 0) >= (entry.reviews ?? 0)) { skipped++; continue }
          } catch { /* overwrite corrupt */ }
        }
        try {
          localStorage.setItem(key, JSON.stringify(entry))
          imported++
        } catch { skipped++ }
      }
      allEntries.value = readAllEntries()
      showImportMsg(`匯入成功：${imported} 個單字${skipped > 0 ? `，略過 ${skipped} 個` : ''}`, false)
    } catch {
      showImportMsg('讀取失敗：請確認是有效的 JSON 備份檔', true)
    }
  }
  reader.readAsText(file)
}

function showImportMsg(msg, error) {
  importMsg.value = msg
  importError.value = error
  setTimeout(() => { importMsg.value = '' }, 5000)
}

function categoryLabel(cat) {
  return { academic: '學術', advanced_academic: '進階學術', toeic: '多益' }[cat] ?? cat
}

function categoryBadgeClass(cat) {
  return {
    academic:          'bg-indigo-900/60 text-indigo-300',
    advanced_academic: 'bg-violet-900/60 text-violet-300',
    toeic:             'bg-emerald-900/60 text-emerald-300',
  }[cat] ?? 'bg-gray-700 text-gray-400'
}

function goHome() {
  window.location.href = '/'
}

// ── One-time categories migration ─────────────────────────────────────────────
// SRS entries created before the categories feature have no `categories` field.
// Lazy-load getVocabCategories and backfill so category filter tabs show correctly.
onMounted(async () => {
  const needsMigration = allEntries.value.some(e => !Array.isArray(e.categories))
  if (!needsMigration) return

  try {
    const { getVocabCategories } = await import('@/lib/lookup.js')
    let changed = false
    for (const entry of allEntries.value) {
      if (Array.isArray(entry.categories)) continue
      entry.categories = getVocabCategories(entry.lemma || entry.word)
      try {
        localStorage.setItem(PREFIX + entry.word.toLowerCase(), JSON.stringify(entry))
        changed = true
      } catch { /* storage full — skip */ }
    }
    if (changed) allEntries.value = [...allEntries.value]  // trigger reactivity
  } catch { /* non-fatal: migration fails silently */ }
})
</script>
