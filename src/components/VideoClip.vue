<template>
  <div class="relative w-full h-full bg-black overflow-hidden">
    <!-- YouTube iframe container -->
    <div ref="iframeContainer" class="absolute inset-0"></div>

    <!-- Click-to-play overlay: shown when video is paused/unstarted/ended -->
    <div
      v-if="showPlayOverlay"
      class="absolute inset-0 z-10 flex items-center justify-center cursor-pointer bg-black/20"
      @click="play"
    >
      <div class="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
        <svg class="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>

    <!-- Replay button (bottom-right, always visible) -->
    <button
      class="absolute bottom-4 right-4 bg-black/60 text-white rounded-full
             w-11 h-11 flex items-center justify-center text-lg z-20
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
const showPlayOverlay = ref(true)  // shown until video actually starts playing
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
      onStateChange: (e) => {
        // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0, BUFFERING=3, CUED=5, UNSTARTED=-1
        if (e.data === 1 || e.data === 3) {
          showPlayOverlay.value = false  // playing or buffering → hide overlay
        } else {
          showPlayOverlay.value = true   // paused / ended / unstarted → show overlay
        }
      },
    },
  })
}

function play() {
  if (!player || typeof player.seekTo !== 'function') return
  clearInterval(intervalId)
  showPlayOverlay.value = false
  player.seekTo(props.start, true)
  player.playVideo()

  intervalId = setInterval(() => {
    try {
      const current = player.getCurrentTime()
      if (current >= props.end) {
        player.pauseVideo()
        clearInterval(intervalId)
        showPlayOverlay.value = true
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
  showPlayOverlay.value = true
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
