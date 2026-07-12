# PWA Template

A Vue 3 PWA template for quickly bootstrapping new progressive web apps. Built with Vuetify, Pinia, and Vue Router — installable, offline-capable, and ready to deploy.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API) + TypeScript |
| UI | Vuetify 4 + Material Design Icons |
| State | Pinia |
| Routing | Vue Router |
| Build | Vite + vite-plugin-pwa |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Lint
pnpm lint
```

Alternatively, if you use [Nix](https://nixos.org/), you can run commands via the project's dev shell:

```bash
nix develop -c pnpm dev
```

## Project Structure

```
src/
├── pages/           # Route-level page components
├── components/
│   ├── layout/      # Bottom navigation
│   └── settings/    # Theme toggle
├── stores/          # Pinia stores (app: snackbar, dark mode)
├── plugins/         # Vuetify, Pinia, Router config
└── main.ts          # App entry point
```

## PWA & Offline Support

- Installable on mobile and desktop — runs as a standalone app
- Full offline functionality via service worker caching
- Auto-updates when a new version is deployed

## Fonts

Roboto (Vuetify's default typeface) is imported directly in `src/main.ts` via
[`@fontsource`](https://fontsource.org/), one CSS file per weight:

```ts
import '@fontsource/roboto/latin-300.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
```

Only the **latin subset** and the **300/400/500/700** weights are bundled — the
minimum Vuetify uses. This keeps the payload small, but has two consequences to
know when building on the template:

- **Non-latin text falls back to the system font.** For Central European
  diacritics (č, ő, ș), Cyrillic, Greek, Vietnamese, etc., add the matching
  subset next to the imports above, e.g. `import '@fontsource/roboto/latin-ext-400.css'`
  or `import '@fontsource/roboto/cyrillic-400.css'`.
- **Extra weights/styles need their own import.** Using Roboto 100/900 or
  italics? Add e.g. `import '@fontsource/roboto/latin-900.css'` /
  `latin-400-italic.css`. To swap in a different typeface entirely, install its
  `@fontsource` package, import it here, and point Vuetify's font at it.

Fonts are cached on demand by the service worker (`CacheFirst`) rather than
precached, so only the weights a visitor actually renders get stored.

## Icons

Material Design Icons are used via [`@mdi/js`](https://www.npmjs.com/package/@mdi/js)
with Vuetify's tree-shakable `mdi-svg` iconset (configured in
`src/plugins/vuetify.ts`) — **not** the full `@mdi/font` webfont. Only the icons
you import are bundled (as inline SVG paths), so there is no ~7000-icon,
multi-format font payload to ship or precache.

The tradeoff is the workflow: import each icon by name and pass it as a value
rather than using the `mdi-xxx` string form.

```vue
<script setup lang="ts">
  import { mdiHome } from '@mdi/js'
</script>

<template>
  <v-icon :icon="mdiHome" />       <!-- ✅ imported path -->
  <v-icon>mdi-home</v-icon>        <!-- ❌ renders nothing with the svg set -->
</template>
```

Vuetify's own built-in UI icons (checkbox checks, dropdown chevrons, close
buttons, …) keep working because `aliases` from the iconset is registered. Raw
font usage outside Vuetify (`<i class="mdi mdi-home">`, CSS `content: '\FXXXX'`)
is **not** available, since the `@mdi/font` stylesheet is no longer loaded.

## Dark Mode

- Toggle between light and dark themes from settings
- Preference persists across sessions

## Deployment

GitHub Actions workflows are included:

- **Build** — runs on every push, validates the project compiles
- **Deploy** — manual trigger, builds and deploys via `rsync` over SSH

Required repository secrets for deployment:

| Secret | Description |
|---|---|
| `DEPLOY_KEY` | SSH private key |
| `DEPLOY_HOST_KEY` | Known hosts entry for the target server |
| `DEPLOY_URL` | rsync destination (e.g. `user@host:/var/www/app/`) |
