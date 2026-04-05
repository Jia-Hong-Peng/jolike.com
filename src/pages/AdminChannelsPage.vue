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

          <!-- Fetch transcripts via GitHub Actions (reliable — GitHub IPs not blocked by YouTube) -->
          <button
            v-if="stubCounts[ch.id] > 0"
            class="text-xs px-3 py-2 rounded-xl font-medium transition-colors min-h-[36px]"
            :class="channelBusy[ch.id] === 'github'
              ? 'bg-blue-900 text-blue-400 cursor-not-allowed'
              : 'bg-blue-900/60 text-blue-300 hover:bg-blue-900'"
            :disabled="!!channelBusy[ch.id]"
            @click="triggerFetch(ch)"
          >
            <span v-if="channelBusy[ch.id] === 'github'" class="animate-spin inline-block mr-1">⟳</span>
            🤖 抓取字幕 ({{ stubCounts[ch.id] }} 部待處理)
          </button>
        </div>

        <!-- GitHub Actions triggered — show link -->
        <div v-if="githubRunUrl[ch.id]" class="mt-3 text-xs text-blue-400">
          ✓ GitHub Actions 已啟動，在背景處理中
          <a :href="githubRunUrl[ch.id]" target="_blank" class="underline ml-1">查看進度 →</a>
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
  syncChannel, importChannelVideosPage, getChannelVideos, triggerGithubFetch,
} from '@/services/api.js'

const loading  = ref(true)
const channels = ref([])
const addUrl   = ref('')
const adding   = ref(false)
const addError = ref('')

const channelBusy   = reactive({})  // channelId → 'sync'|'import'|'github'|null
const channelResult = reactive({})  // channelId → { ok, msg }
const githubRunUrl  = reactive({})  // channelId → GitHub Actions runs URL
const stubCounts    = reactive({})  // channelId → number of stubs without transcript

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

async function triggerFetch(channel) {
  channelBusy[channel.id] = 'github'
  channelResult[channel.id] = null
  githubRunUrl[channel.id] = null
  try {
    const res = await triggerGithubFetch(channel.id)
    githubRunUrl[channel.id] = res.runsUrl
    channelResult[channel.id] = { ok: true, msg: '✓ GitHub Actions 已啟動，請點右上角連結追蹤進度' }
  } catch (e) {
    channelResult[channel.id] = {
      ok: false,
      msg: e?.message || '觸發失敗，請確認 GITHUB_TOKEN 已在 Cloudflare Pages 設定',
    }
  } finally {
    channelBusy[channel.id] = null
  }
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleString('zh-TW', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
</script>
