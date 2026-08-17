import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/react-markdown/') || id.includes('/remark-') || id.includes('/rehype-')) return 'markdown'
          if (id.includes('/@tanstack/') || id.includes('/axios/')) return 'data'
          return 'vendor'
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  }
})
