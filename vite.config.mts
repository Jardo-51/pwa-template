import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineConfig({
  plugins: [
    Vue({
      template: { transformAssetUrls },
    }),
    Vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // MDI icons ship as tree-shaken SVG paths inside the JS bundle (already
        // precached via the glob above), so no icon webfont is fetched at all.
        // Roboto text weights are cached on demand (CacheFirst) instead, so only
        // the weights/subsets a visitor actually renders get stored — and every
        // SW update no longer re-downloads the whole font payload.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        // Stable app identity so Chromium keeps the same installed app even if
        // start_url changes later.
        id: '/',
        name: 'PWA App',
        short_name: 'App',
        description: 'A Progressive Web App',
        theme_color: '#1976D2',
        background_color: '#ffffff',
        display: 'standalone',
        // No orientation lock — installed windows follow the device/user. Set
        // e.g. orientation: 'portrait' per app if a fixed orientation is needed.
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
})
