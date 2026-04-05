<template>
  <div class="min-h-screen bg-black text-white px-5 py-8 max-w-lg mx-auto">
    <h1 class="text-xl font-bold mb-1">詞彙索引補建</h1>
    <p class="text-gray-500 text-sm mb-6">
      對所有歷史影片重新掃描詞彙庫，補建 D1 vocab index。<br>
      已有索引的影片會直接覆蓋（安全）。
    </p>

    <!-- Idle -->
    <div v-if="phase === 'idle'" class="space-y-4">
      <div class="bg-gray-900 rounded-2xl px-5 py-4 text-sm text-gray-400 space-y-1">
        <p>此操作會：</p>
        <ol class="list-decimal ml-4 space-y-1">
          <li>從 /api/library 撈出所有影片</li>
          <li>每支影片呼叫 /api/video/:id 取得字幕</li>
          <li>前端掃描 11 個詞彙庫（約 1–5 秒/支）</li>
          <li>POST /api/video-vocab 存入 D1</li>
        </ol>
      </div>
      <button
        class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold
               py-4 rounded-2xl min-h-[56px] transition-colors"
        @click="start"
      >
        開始補建
      </button>
    </div>

    <!-- Running -->
    <div v-else-if="phase === 'running'" class="space-y-4">
      <!-- Progress bar -->
      <div class="bg-gray-800 rounded-full h-3 overflow-hidden">
        <div
          class="bg-blue-500 h-full transition-all duration-300"
          :style="`width: ${progress}%`"
        ></div>
      </div>
      <p class="text-center text-gray-300 text-sm">
        {{ doneCount }} / {{ totalCount }} 影片
        <span v-if="totalCount > 0" class="text-gray-500 ml-1">({{ progress }}%)</span>
      </p>

      <!-- Current video -->
      <div v-if="currentVideo" class="bg-gray-900 rounded-2xl px-4 py-3 text-sm">
        <p class="text-gray-400 text-xs mb-1">正在處理</p>
        <p class="text-white font-medium truncate">{{ currentVideo.title || currentVideo.id }}</p>
      </div>

      <!-- Log -->
      <div class="bg-gray-950 rounded-2xl px-4 py-3 max-h-60 overflow-y-auto text-xs font-mono space-y-1">
        <p v-for="(log, i) in logs.slice(-30)" :key="i" :class="log.type === 'error' ? 'text-red-400' : 'text-gray-400'">
          {{ log.msg }}
        </p>
      </div>
    </div>

    <!-- Done -->
    <div v-else-if="phase === 'done'" class="space-y-4 text-center">
      <p class="text-4xl">✅</p>
      <p class="text-white font-bold text-xl">補建完成</p>
      <div class="bg-gray-900 rounded-2xl px-5 py-4 text-sm text-gray-300 space-y-1 text-left">
        <p>共處理 <span class="text-white font-semibold">{{ totalCount }}</span> 支影片</p>
        <p class="text-green-400">成功 {{ successCount }} 支</p>
        <p v-if="errorCount > 0" class="text-red-400">失敗 {{ errorCount }} 支</p>
      </div>
      <button
        class="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold
               py-3 rounded-2xl min-h-[48px] transition-colors"
        @click="phase = 'idle'; logs = []"
      >
        再跑一次
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { scanTranscriptVocab } from '@/lib/vocabScan.js'

const phase        = ref('idle')
const totalCount   = ref(0)
const doneCount    = ref(0)
const successCount = ref(0)
const errorCount   = ref(0)
const currentVideo = ref(null)
const logs         = ref([])

const progress = computed(() =>
  totalCount.value > 0 ? Math.round((doneCount.value / totalCount.value) * 100) : 0
)

function addLog(msg, type = 'info') {
  logs.value.push({ msg, type })
}

async function fetchAllVideos() {
  const all = []
  let offset = 0
  const limit = 50
  while (true) {
    const res = await fetch(`/api/library?limit=${limit}&offset=${offset}`)
    const data = await res.json()
    const batch = data.videos ?? []
    all.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }
  return all
}

async function start() {
  phase.value        = 'running'
  doneCount.value    = 0
  successCount.value = 0
  errorCount.value   = 0
  logs.value         = []
  currentVideo.value = null

  addLog('正在載入影片清單…')
  let videos
  try {
    videos = await fetchAllVideos()
  } catch (err) {
    addLog(`載入失敗: ${err.message}`, 'error')
    phase.value = 'done'
    return
  }

  totalCount.value = videos.length
  addLog(`共 ${videos.length} 支影片，開始逐一掃描`)

  for (const v of videos) {
    currentVideo.value = v
    try {
      // Fetch transcript
      const res  = await fetch(`/api/video/${v.id}`)
      const data = await res.json()
      const transcript = data.transcript ?? []

      if (transcript.length === 0) {
        addLog(`[skip] ${v.id} 無字幕`)
        doneCount.value++
        continue
      }

      // Client-side vocab scan
      const vocab = await scanTranscriptVocab(transcript)
      const listCount = Object.keys(vocab).length

      // Store to D1
      if (listCount > 0) {
        await fetch('/api/video-vocab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: v.id, vocab }),
        })
        addLog(`[ok] ${v.title?.slice(0, 40) || v.id} — ${listCount} 個詞庫`)
      } else {
        addLog(`[skip] ${v.id} 無匹配詞彙`)
      }

      successCount.value++
    } catch (err) {
      addLog(`[err] ${v.id}: ${err.message}`, 'error')
      errorCount.value++
    }

    doneCount.value++
    // Small delay to avoid hammering the API
    await new Promise(r => setTimeout(r, 100))
  }

  currentVideo.value = null
  phase.value = 'done'
}
</script>
