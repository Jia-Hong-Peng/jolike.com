<template>
  <div class="mt-2">
    <!-- Mic permission denied -->
    <div
      v-if="state === 'error' && errorCode === 'MIC_DENIED'"
      class="bg-yellow-900/40 rounded-xl px-4 py-3 text-yellow-300 text-sm"
    >
      請在瀏覽器設定中允許麥克風使用權限，再點擊跟讀。
    </div>

    <!-- Not supported -->
    <div
      v-else-if="state === 'error' && errorCode === 'NOT_SUPPORTED'"
      class="text-gray-500 text-sm px-1"
    >
      此裝置不支援錄音功能。
    </div>

    <!-- Shadowing button -->
    <button
      v-else
      class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold
             text-base transition-colors min-h-[48px]"
      :class="buttonClass"
      :disabled="state === 'playing'"
      @click="onShadowingClick"
    >
      <span>{{ buttonIcon }}</span>
      <span>{{ buttonLabel }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount } from 'vue'
import { useShadowing } from '@/composables/useShadowing.js'

const props = defineProps({
  card: { type: Object, required: true },
})

const emit = defineEmits(['before-record'])

const { state, errorCode, startRecording, stopRecording, reset } = useShadowing()

const buttonLabel = computed(() => {
  return {
    idle: '跟讀',
    recording: '錄音中… 點擊停止',
    playing: '播放中…',
  }[state.value] ?? '跟讀'
})

const buttonIcon = computed(() => {
  return {
    idle: '🎤',
    recording: '⏹',
    playing: '🔊',
  }[state.value] ?? '🎤'
})

const buttonClass = computed(() => {
  return {
    idle: 'bg-gray-800 text-white hover:bg-gray-700',
    recording: 'bg-red-700 text-white animate-pulse',
    playing: 'bg-gray-700 text-gray-300 cursor-not-allowed',
  }[state.value] ?? 'bg-gray-800 text-white'
})

async function onShadowingClick() {
  if (state.value === 'recording') {
    stopRecording()
    return
  }
  if (state.value !== 'idle') return

  // Stop video playback before recording to avoid audio conflict (T024)
  emit('before-record')

  await startRecording()
}

onBeforeUnmount(() => {
  reset()
})
</script>
