import { createApp } from 'vue'
import ShadowingPage from '@/pages/ShadowingPage.vue'
import '@/styles/main.css'
import { registerSW } from '@/composables/usePWA.js'

createApp(ShadowingPage).mount('#app')
registerSW()
