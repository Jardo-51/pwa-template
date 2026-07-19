import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import Vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    Vue(),
    Vuetify({ autoImport: true }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    // Vuetify ships untranspiled ESM that Vitest must process rather than
    // externalise.
    server: { deps: { inline: ['vuetify'] } },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
})
