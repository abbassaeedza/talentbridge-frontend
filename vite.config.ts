import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  css: {
    postcss: {
      plugins: [{
        postcssPlugin: 'heroui-reduced-motion-selectors',
        Rule(rule) {
          // shortcut: HeroUI 3.2.4 loses these motion conditions during optimization; remove when upstream selectors are fixed.
          const match = rule.selector.match(/^(\.slider \.slider__thumb(?:\[data-dragging=true\])?::?after|(?:\.checkbox__control|\.radio__indicator:empty)::?before)(:is\(\)|:not\(:is\(\)\))$/)
          if (!match) return
          const [, selector, condition] = match
          const motion = condition.replace(':is()', ':is([data-reduce-motion=true],[data-reduce-motion=true] *)')
          rule.selector = selector.replace(/(::?before|::?after)$/, `${motion}$1`)
        },
      }],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep the shared CommonJS helper below its consumers to avoid startup cycles.
          if (id.includes('commonjsHelpers')) return 'react'
          if (!id.includes('node_modules')) return
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (/\/node_modules\/(react-aria|react-aria-components|react-stately|@react-aria|@react-stately|@react-types|@internationalized)\//.test(id)) return 'aria'
          if (id.includes('/@heroui/')) return 'ui'
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
