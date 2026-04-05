import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  // root at repo root: index.html → dist/index.html, feed/index.html → dist/feed/index.html
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index:       resolve(__dirname, 'index.html'),
        feed:        resolve(__dirname, 'feed/index.html'),
        review:      resolve(__dirname, 'review/index.html'),
        progress:    resolve(__dirname, 'progress/index.html'),
        shadow:      resolve(__dirname, 'shadow/index.html'),
        library:     resolve(__dirname, 'library/index.html'),
        vocabStudy:  resolve(__dirname, 'vocab-study/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
})
