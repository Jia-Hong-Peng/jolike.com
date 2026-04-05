import { createApp } from 'vue'
import VocabStudyPage from '@/pages/VocabStudyPage.vue'
import '@/styles/main.css'
import { registerSW } from '@/composables/usePWA.js'

createApp(VocabStudyPage).mount('#app')
registerSW()
