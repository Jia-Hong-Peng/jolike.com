<template>
  <span class="highlighted-sentence">
    <span v-if="parts.before">{{ parts.before }}</span>
    <mark v-if="parts.keyword" class="bg-yellow-200 text-yellow-900 rounded px-0.5">{{ parts.keyword }}</mark>
    <span
      v-if="parts.clozeBlank"
      class="inline-block min-w-[4rem] border-b-2 border-gray-500 mx-1"
    >&nbsp;</span>
    <span v-if="parts.after">{{ parts.after }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sentence: {
    type: String,
    required: true,
  },
  keyword: {
    type: String,
    required: true,
  },
  cloze: {
    type: Boolean,
    default: false,
  },
})

const parts = computed(() => {
  if (!props.sentence || !props.keyword) {
    return { before: props.sentence, keyword: '', clozeBlank: false, after: '' }
  }

  const lowerSentence = props.sentence.toLowerCase()
  const lowerKeyword = props.keyword.toLowerCase()
  const idx = lowerSentence.indexOf(lowerKeyword)

  if (idx === -1) {
    return { before: props.sentence, keyword: '', clozeBlank: false, after: '' }
  }

  const before = props.sentence.slice(0, idx)
  const keyword = props.sentence.slice(idx, idx + props.keyword.length)
  const after = props.sentence.slice(idx + props.keyword.length)

  return {
    before,
    keyword: props.cloze ? '' : keyword,
    clozeBlank: props.cloze,
    after,
  }
})
</script>
