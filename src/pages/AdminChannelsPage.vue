<template>
  <div class="min-h-screen bg-black text-white px-4 py-8 max-w-2xl mx-auto">
    <div class="flex items-center gap-3 mb-8">
      <a href="/" class="text-gray-400 hover:text-white text-sm min-h-[44px] min-w-[44px] flex items-center">← 首頁</a>
      <h1 class="text-xl font-bold">頻道訂閱管理</h1>
    </div>

    <!-- Add channel form -->
    <div class="bg-gray-900 rounded-2xl p-5 mb-6">
      <p class="text-sm text-gray-400 mb-3">貼上 YouTube 頻道網址或 @handle，系統會自動訂閱並匯入影片</p>
      <div class="flex gap-2">
        <input
          v-model="addUrl"
          type="url"
          placeholder="https://youtube.com/@TED 或 youtube.com/channel/UCxxxxxx"
          class="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-600"
          :disabled="adding"
          @keydown.enter="addChannel"
        />
        <button
          class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-semibold rounded-xl px-5 py-3 text-sm transition-colors min-h-[48px]"
          :disabled="adding || !addUrl.trim()"
          @click="addChannel"
        >
          <span v-if="adding" class="animate-spin inline-block">⟳</span>
          <span v-else>訂閱</span>
        </button>
      </div>
      <p v-if="addError" class="mt-2 text-red-400 text-xs">{{ addError }}</p>
    </div>

    <!-- Channel list -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24 bg-gray-900 rounded-2xl animate-pulse"></div>
    </div>

    <div v-else-if="channels.length === 0" class="text-center text-gray-500 py-12">
      <p class="text-2xl mb-2">📺</p>
      <p class="text-sm">尚未訂閱任何頻道</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="ch in channels"
        :key="ch.id"
        class="bg-gray-900 rounded-2xl p-4"
      >
        <!-- Channel header -->
        <div class="flex items-center gap-3 mb-3">
          <img
            v-if="ch.thumbnail_url"
            :src="ch.thumbnail_url"
            :alt="ch.name"
            class="w-12 h-12 rounded-full object-cover bg-gray-800 flex-shrink-0"
          />
          <div v-else class="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-600 text-lg">📺</div>
          <div class="flex-1 min-w-0">
            <p class="text-white font-semibold truncate">{{ ch.name }}</p>
            <p class="text-gray-500 text-xs">
              {{ ch.handle || ch.id }} ·
              {{ ch.video_count || 0 }} 部影片
              <span v-if="ch.import_all_done" class="text-green-500 ml-1">✓ 全部入庫</span>
            </p>
            <p class="text-gray-600 text-xs mt-0.5">
              最後同步：{{ ch.last_synced_at ? formatDate(ch.last_synced_at) : '尚未同步' }}
            </p>
          </div>
          <button
            class="text-gray-600 hover:text-red-400 text-xs transition-colors px-2 py-1"
            :disabled="channelBusy[ch.id]"
            @click="removeChannel(ch.id)"
          >
            移除
          </button>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-2 flex-wrap">
          <!-- RSS sync -->
          <button
            class="text-xs px-3 py-2 rounded-xl font-medium transition-colors min-h-[36px]"
            :class="channelBusy[ch.id] === 'sync'
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
            :disabled="!!channelBusy[ch.id]"
            @click="rssSync(ch.id)"
          >
            <span v-if="channelBusy[ch.id] === 'sync'" class="animate-spin inline-block mr-1">⟳</span>
            🔄 RSS 同步最新
          </button>

          <!-- Import all historical videos -->
          <button
            v-if="!ch.import_all_done"
            class="text-xs px-3 py-2 rounded-xl font-medium transition-colors min-h-[36px]"
            :class="channelBusy[ch.id] === 'import'
              ? 'bg-yellow-900 text-yellow-400 cursor-not-allowed'
              : 'bg-yellow-900/60 text-yellow-300 hover:bg-yellow-900'"
            :disabled="!!channelBusy[ch.id]"
            @click="importAll(ch)"
          >
            <span v-if="channelBusy[ch.id] === 'import'" class="animate-spin inline-block mr-1">⟳</span>
            📥 掃描全部歷史影片
          </button>
          <span v-else class="text-xs text-green-500 px-2 py-2">✓ 歷史影片已全部入庫</span>

          <!-- Fetch transcripts for stubs -->
          <button
            v-if="stubCounts[ch.id] > 0"
            class="text-xs px-3 py-2 rounded-xl font-medium transition-colors min-h-[36px]"
            :class="channelBusy[ch.id] === 'transcripts'
              ? 'bg-blue-900 text-blue-400 cursor-not-allowed'
              : 'bg-blue-900/60 text-blue-300 hover:bg-blue-900'"
            :disabled="!!channelBusy[ch.id]"
            @click="fetchTranscripts(ch)"
          >
            <span v-if="channelBusy[ch.id] === 'transcripts'" class="animate-spin inline-block mr-1">⟳</span>
            🎬 抓取字幕 ({{ stubCounts[ch.id] }} 部待處理)
          </button>
        </div>

        <!-- Transcript fetch progress -->
        <div v-if="transcriptProgress[ch.id]" class="mt-3">
          <div class="flex justify-between text-xs text-gray-400 mb-1">
            <span>{{ transcriptProgress[ch.id].done }} / {{ transcriptProgress[ch.id].total }} 部完成</span>
            <span class="text-gray-600">
              <span v-if="transcriptProgress[ch.id].skipped > 0">{{ transcriptProgress[ch.id].skipped }} 無字幕</span>
              <span v-if="transcriptProgress[ch.id].errors > 0" class="text-yellow-600 ml-2">{{ transcriptProgress[ch.id].errors }} 失敗</span>
            </span>
          </div>
          <div class="w-full bg-gray-800 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${Math.round(transcriptProgress[ch.id].done / transcriptProgress[ch.id].total * 100)}%` }"
            ></div>
          </div>
          <p v-if="transcriptProgress[ch.id].log" class="text-gray-600 text-xs mt-1 truncate">{{ transcriptProgress[ch.id].log }}</p>
        </div>

        <!-- Result notice -->
        <p v-if="channelResult[ch.id]" class="mt-2 text-xs" :class="channelResult[ch.id].ok ? 'text-green-400' : 'text-red-400'">
          {{ channelResult[ch.id].msg }}
        </p>
      </div>
    </div>

    <!-- Cron hint -->
    <div class="mt-8 bg-gray-900/50 border border-gray-800 rounded-2xl px-4 py-3 text-xs text-gray-500">
      <p class="font-semibold text-gray-400 mb-1">⏰ 自動同步</p>
      <p>GitHub Actions cron 每小時自動呼叫 RSS 同步，新影片會自動入庫。字幕需手動點「抓取字幕」或等使用者觸發。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  getChannels, addChannel as apiAddChannel, deleteChannel as apiDeleteChannel,
  syncChannel, importChannelVideosPage, getChannelVideos, analyzeVideo,
} from '@/services/api.js'

const loading  = ref(true)
const channels = ref([])
const addUrl   = ref('')
const adding   = ref(false)
const addError = ref('')

const channelBusy     = reactive({})  // channelId → 'sync'|'import'|'transcripts'|null
const channelResult   = reactive({})  // channelId → { ok, msg }
const transcriptProgress = reactive({})  // channelId → { done, total, skipped, log }
const stubCounts      = reactive({})  // channelId → number of stubs without transcript

onMounted(loadChannels)

async function loadChannels() {
  loading.value = true
  try {
    channels.value = await getChannels()
    await Promise.all(channels.value.map(ch => loadStubCount(ch.id)))
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

async function loadStubCount(channelId) {
  try {
    const data = await getChannelVideos(channelId, { limit: 500 })
    stubCounts[channelId] = (data.videos ?? []).filter(v => !v.hasTranscript).length
  } catch {
    stubCounts[channelId] = 0
  }
}

async function addChannel() {
  if (!addUrl.value.trim() || adding.value) return
  adding.value = true
  addError.value = ''
  try {
    await apiAddChannel(addUrl.value.trim())
    addUrl.value = ''
    await loadChannels()
  } catch (e) {
    if (e.error === 'ALREADY_SUBSCRIBED') {
      addError.value = '此頻道已訂閱'
    } else if (e.error === 'INVALID_CHANNEL_URL') {
      addError.value = '無法識別頻道，請確認網址格式'
    } else if (e.error === 'CHANNEL_NOT_FOUND') {
      addError.value = '找不到此頻道'
    } else {
      addError.value = '加入失敗，請稍後再試'
    }
  } finally {
    adding.value = false
  }
}

async function removeChannel(channelId) {
  if (!confirm('確定移除此頻道？（已匯入的影片不會刪除）')) return
  try {
    await apiDeleteChannel(channelId)
    channels.value = channels.value.filter(c => c.id !== channelId)
  } catch {
    alert('移除失敗')
  }
}

async function rssSync(channelId) {
  channelBusy[channelId] = 'sync'
  channelResult[channelId] = null
  try {
    const res = await syncChannel(channelId)
    channelResult[channelId] = {
      ok: true,
      msg: `✓ 同步完成，新增 ${res.new ?? 0} 部影片（共確認 ${res.checked ?? 0} 則）`,
    }
    await loadChannels()
  } catch {
    channelResult[channelId] = { ok: false, msg: '同步失敗' }
  } finally {
    channelBusy[channelId] = null
  }
}

async function importAll(channel) {
  channelBusy[channel.id] = 'import'
  channelResult[channel.id] = null

  let page = 0
  let totalImported = 0
  let hasMore = true

  try {
    while (hasMore) {
      const res = await importChannelVideosPage(channel.id, page)
      totalImported += res.imported ?? 0
      hasMore = res.hasMore ?? false
      page++

      channelResult[channel.id] = {
        ok: true,
        msg: `掃描中... 已入庫 ${totalImported} 部${hasMore ? '，繼續掃描中' : ''}`,
      }

      // Small delay between pages to avoid hammering InnerTube
      if (hasMore) await new Promise(r => setTimeout(r, 1000))
    }

    channelResult[channel.id] = {
      ok: true,
      msg: `✓ 掃描完成，共 ${totalImported} 部歷史影片已入庫，請點「抓取字幕」繼續`,
    }
    await loadChannels()
  } catch {
    channelResult[channel.id] = {
      ok: totalImported > 0,
      msg: totalImported > 0
        ? `已入庫 ${totalImported} 部，掃描中途失敗，可再試一次繼續`
        : '掃描失敗，請稍後再試',
    }
  } finally {
    channelBusy[channel.id] = null
  }
}

async function fetchTranscripts(channel) {
  channelBusy[channel.id] = 'transcripts'
  channelResult[channel.id] = null

  // Get list of videos without transcript
  let videos = []
  try {
    const data = await getChannelVideos(channel.id, { limit: 500 })
    videos = (data.videos ?? []).filter(v => !v.hasTranscript)
  } catch {
    channelResult[channel.id] = { ok: false, msg: '載入影片清單失敗' }
    channelBusy[channel.id] = null
    return
  }

  if (videos.length === 0) {
    channelResult[channel.id] = { ok: true, msg: '所有影片都已有字幕' }
    channelBusy[channel.id] = null
    return
  }

  transcriptProgress[channel.id] = { done: 0, total: videos.length, skipped: 0, errors: 0, log: '' }

  // Process one at a time — batching hammers YouTube and triggers IP-level rate limiting
  for (const v of videos) {
    if (channelBusy[channel.id] !== 'transcripts') break  // cancelled

    transcriptProgress[channel.id].log = `處理中：${v.title || v.id}`
    try {
      await analyzeVideo(`https://www.youtube.com/watch?v=${v.id}`)
      transcriptProgress[channel.id].done++
    } catch (e) {
      if (e?.error === 'NO_CAPTIONS') {
        // Genuinely no English captions — stub was deleted server-side
        transcriptProgress[channel.id].skipped++
        transcriptProgress[channel.id].done++
      } else if (e?.error === 'RATE_LIMITED') {
        // YouTube blocked us — pause 30s then continue (stub stays for retry)
        transcriptProgress[channel.id].log = '⏸ YouTube 速率限制，等待 30 秒...'
        transcriptProgress[channel.id].errors++
        transcriptProgress[channel.id].done++
        await new Promise(r => setTimeout(r, 30000))
      } else {
        // Other network error — stub stays in D1, can retry later
        transcriptProgress[channel.id].errors++
        transcriptProgress[channel.id].done++
      }
    }

    // Jitter delay 1–2.5s to avoid fixed-interval detection
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500))
  }

  const prog = transcriptProgress[channel.id]
  const succeeded = prog.done - prog.skipped - prog.errors
  const parts = [`成功 ${succeeded} 部`]
  if (prog.skipped > 0) parts.push(`${prog.skipped} 部無英文字幕`)
  if (prog.errors > 0) parts.push(`${prog.errors} 部抓取失敗（可再試）`)
  channelResult[channel.id] = {
    ok: true,
    msg: `✓ 完成！${parts.join('，')}`,
  }
  channelBusy[channel.id] = null
  await loadChannels()
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleString('zh-TW', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
</script>
