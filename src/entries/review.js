import { createApp } from 'vue'
import ReviewPage from '@/pages/ReviewPage.vue'
import '@/styles/main.css'
import { registerSW } from '@/composables/usePWA.js'

createApp(ReviewPage).mount('#app')
registerSW()
