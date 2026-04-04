import { createApp } from 'vue'
import InputPage from '@/pages/InputPage.vue'
import '@/styles/main.css'
import { registerSW } from '@/composables/usePWA.js'

createApp(InputPage).mount('#app')
registerSW()
