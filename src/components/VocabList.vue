<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/60"
    @click="$emit('close')"
  ></div>

  <!-- Drawer panel (slides in from right) -->
  <div class="fixed inset-y-0 right-0 z-50 w-4/5 max-w-xs bg-gray-900 flex flex-col shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-4 border-b border-gray-700">
      <h2 class="text-white font-bold text-base">單字總表</h2>
      <button
        class="text-gray-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
        @click="$emit('close')"
      >
        ✕
      </button>
    </div>

    <!-- Summary row -->
    <div class="flex gap-4 px-4 py-3 text-xs text-gray-400 border-b border-gray-800">
      <span>共 {{ cards.length }} 張</span>
      <span class="text-green-400">✓ {{ knownCount }} 已會</span>
      <span class="text-yellow-400">? {{ unsureCount }} 不熟</span>
      <span class="text-gray-500">○ {{ unseenCount }} 未看</span>
    </div>

    <!-- Card list -->
    <ul class="flex-1 overflow-y-auto divide-y divide-gray-800">
      <li
        v-for="(card, index) in cards"
        :key="card.id"
        class="flex items-center gap-3 px-4 py-3 min-h-[52px] cursor-pointer transition-colors"
        :class="index === currentIndex
          ? 'bg-blue-900/40'
          : 'hover:bg-gray-800'"
        @click="onJump(index)"
      >
        <!-- Status indicator -->
        <span class="text-base w-5 flex-shrink-0 text-center" :title="statusLabel(card.id)">
          {{ statusIcon(card.id) }}
        </span>

        <!-- Type badge -->
        <span
          class="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          :class="typeBadgeClass(card.type)"
        >
          {{ typeLabel(card.type) }}
        </span>

        <!-- Keyword -->
        <span
          class="text-white text-sm font-medium truncate flex-1"
          :class="{ 'text-blue-300': index === currentIndex }"
        >
          {{ card.keyword }}
        </span>

        <!-- Meaning -->
        <span class="text-gray-500 text-xs truncate max-w-[60px] flex-shrink-0">
          {{ card.meaning_zh }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  cards: { type: Array, required: true },
  currentIndex: { type: Number, required: true },
  cardStatus: { type: Function, required: true },
})

const emit = defineEmits(['close', 'jump'])

const knownCount = computed(() => props.cards.filter(c => props.cardStatus(c.id) === 'known').length)
const unsureCount = computed(() => props.cards.filter(c => props.cardStatus(c.id) === 'unsure').length)
const unseenCount = computed(() => props.cards.filter(c => !props.cardStatus(c.id)).length)

function statusIcon(cardId) {
  const s = props.cardStatus(cardId)
  if (s === 'known') return '✓'
  if (s === 'unsure') return '?'
  return '○'
}

function statusLabel(cardId) {
  const s = props.cardStatus(cardId)
  if (s === 'known') return '已會'
  if (s === 'unsure') return '不熟'
  return '未看'
}

function typeLabel(type) {
  return { word: '單字', phrase: '片語', pattern: '句型' }[type] ?? type
}

function typeBadgeClass(type) {
  return {
    word: 'bg-blue-900 text-blue-300',
    phrase: 'bg-purple-900 text-purple-300',
    pattern: 'bg-green-900 text-green-300',
  }[type] ?? 'bg-gray-800 text-gray-300'
}

function onJump(index) {
  emit('jump', index)
  emit('close')
}
</script>
