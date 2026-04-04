<template>
  <div class="relative w-full h-full bg-black overflow-hidden">
    <!-- YouTube iframe container -->
    <div ref="iframeContainer" class="absolute inset-0" />

    <!-- Replay button (T021 — US2) -->
    <button
      class="absolute bottom-4 right-4 bg-black/60 text-white rounded-full
             w-11 h-11 flex items-center justify-center text-lg z-10
             hover:bg-black/80 transition-colors"
      title="重播"
      @click="play"
    >
      ↺
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  videoId: { type: String, required: true },
  start:   { type: Number, required: true },
  end:     { type: Number, required: true },
})

const iframeContainer = ref(null)
let player = null
let intervalId = null

// --- YouTube IFrame API loader ---
function loadYTApi() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve()
      return
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev()
      resolve()
    }
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
}

async function initPlayer() {
  await loadYTApi()
  if (!iframeContainer.value) return

  player = new window.YT.Player(iframeContainer.value, {
    width: '100%',
    height: '100%',
    videoId: props.videoId,
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      enablejsapi: 1,
      start: Math.floor(props.start),
    },
    events: {
      onReady: () => {
        play()
      },
    },
  })
}

function play() {
  if (!player || typeof player.seekTo !== 'function') return
  clearInterval(intervalId)
  player.seekTo(props.start, true)
  player.playVideo()

  intervalId = setInterval(() => {
    try {
      const current = player.getCurrentTime()
      if (current >= props.end) {
        player.pauseVideo()
        clearInterval(intervalId)
      }
    } catch {
      clearInterval(intervalId)
    }
  }, 200)
}

function stop() {
  clearInterval(intervalId)
  if (player && typeof player.pauseVideo === 'function') {
    player.pauseVideo()
  }
}

defineExpose({ play, stop })

onMounted(() => {
  initPlayer()
})

onBeforeUnmount(() => {
  clearInterval(intervalId)
  if (player && typeof player.destroy === 'function') {
    player.destroy()
  }
})

// Re-init player when videoId changes (navigating between cards)
watch(() => props.videoId, () => {
  if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById({ videoId: props.videoId, startSeconds: props.start })
    play()
  }
})
</script>

<style scoped>
/* Force YouTube iframe to fill the container */
:deep(iframe) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;
}
</style>
