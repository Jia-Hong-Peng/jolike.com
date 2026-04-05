<template>
  <div class="flex gap-2 mt-3">
    <!-- Prev -->
    <button
      class="flex-none flex items-center justify-center rounded-2xl px-5 min-h-[44px] font-semibold
             text-lg transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700
             disabled:opacity-30 disabled:cursor-not-allowed"
      :disabled="!canGoPrev"
      title="上一則"
      @click="$emit('prev')"
    >◀</button>

    <!-- Known -->
    <button
      class="flex-1 flex items-center justify-center gap-1 rounded-2xl font-semibold
             text-base transition-colors min-h-[44px]"
      :class="status === 'known'
        ? 'bg-green-600 text-white'
        : 'bg-gray-800 text-white hover:bg-gray-700'"
      @click="$emit('mark', { id: cardId, status: 'known' })"
    >
      <span>👍</span>
      <span>我會了</span>
    </button>

    <!-- Next -->
    <button
      class="flex-none flex items-center justify-center rounded-2xl px-5 min-h-[44px] font-semibold
             text-lg transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700"
      title="下一則"
      @click="$emit('next')"
    >▶</button>
  </div>
</template>

<script setup>
defineProps({
  cardId:    { type: String,  required: true },
  status:    { type: String,  default: null },   // 'known'|null
  canGoPrev: { type: Boolean, default: false },
})

defineEmits(['mark', 'prev', 'next'])
</script>
