import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import Vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vitest/config'

// Intentionally a standalone config rather than `mergeConfig(viteConfig, …)`:
// merging would pull the PWA/fonts plugins from vite.config.mts into the test
// pipeline. The `@` alias and Vue/Vuetify plugins below are duplicated on
// purpose — keep them in sync with vite.config.mts by hand.
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
