import { createApp } from 'vue'
import FeedPage from '@/pages/FeedPage.vue'
import '@/styles/main.css'
import { registerSW } from '@/composables/usePWA.js'

createApp(FeedPage).mount('#app')
registerSW()
