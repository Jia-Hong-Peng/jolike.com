<template>
  <div class="flex gap-3 mt-3">
    <!-- Known button -->
    <button
      class="flex-1 flex items-center justify-center gap-1 rounded-2xl font-semibold
             text-base transition-colors min-h-[44px]"
      :class="status === 'known'
        ? 'bg-green-600 text-white'
        : 'bg-gray-800 text-white hover:bg-gray-700'"
      @click="onMark('known')"
    >
      <span>👍</span>
      <span>我會了</span>
    </button>

    <!-- Unsure button -->
    <button
      class="flex-1 flex items-center justify-center gap-1 rounded-2xl font-semibold
             text-base transition-colors min-h-[44px]"
      :class="status === 'unsure'
        ? 'bg-orange-600 text-white'
        : 'bg-gray-800 text-white hover:bg-gray-700'"
      @click="onMark('unsure')"
    >
      <span>❓</span>
      <span>不熟</span>
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  cardId: { type: String, required: true },
  status: { type: String, default: null },  // 'known'|'unsure'|null
})

const emit = defineEmits(['mark'])

function onMark(status) {
  emit('mark', { id: props.cardId, status })
}
</script>
