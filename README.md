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

# Run unit tests once (or `pnpm test:watch` while developing)
pnpm test

# Run the end-to-end tests (needs the Nix playwright shell, see below)
nix develop .#playwright -c pnpm test:e2e
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
├── __tests__/       # Vitest setup + smoke test (App mount)
└── main.ts          # App entry point

e2e-tests/           # Playwright specs (service worker, theme) + helpers
```

## Testing

Two layers, run separately.

**Unit / component** — [Vitest](https://vitest.dev/) with
[@vue/test-utils](https://test-utils.vuejs.org/) in a jsdom environment.
`src/__tests__/App.spec.ts` mounts the whole app as a smoke test; add more specs
alongside it (any `*.spec.ts` / `*.test.ts` under `src/`). `src/__tests__/setup.ts`
stubs the browser APIs jsdom lacks but Vuetify and the app store need
(`ResizeObserver`, `matchMedia`, `scrollTo`). CI runs `pnpm test` on every push.

**End-to-end** — [Playwright](https://playwright.dev/) driving the **production
build** in Chromium: `playwright.config.ts` runs `pnpm build` and a `vite
preview` server itself, so a run exercises the minified bundle, the lazy route
chunks and the service worker.

```bash
nix develop .#playwright -c pnpm test:e2e
```

The browsers come from nixpkgs via the `playwright` dev shell rather than from
`playwright install`, and CI uses the same shell, so both drive the same binary.
`@playwright/test` is therefore pinned exactly (no caret) to the version nixpkgs
ships — bump the two together. See [`e2e-tests/README.md`](e2e-tests/README.md)
for that, for the conventions the specs follow, and for how to run one file or
step through a failure.

The two suites are about the template itself, so they stay useful after you
delete the demo pages:

- `pwa.spec.ts` — the network goes down and the app still reloads, keeps its
  stored settings, routes between its lazily-loaded pages, and answers a cold
  `/settings` (and an unknown path) out of workbox's navigate fallback. This is
  the one worth keeping green as an app grows: it catches a `globPatterns`
  change that leaves the app booting fine on a warm network and dead on a train.
  It does not check the web app manifest.
- `settings.spec.ts` — the dark-mode switch, that the choice survives a reload,
  and that the OS colour scheme is followed only until the user makes one.

CI runs the e2e suite on pull requests and pushes to `main` (a separate workflow
from Build, which stays fast and gates every push), and uploads the HTML report
as an artifact on every run.

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

- **Build** — runs on every push: lint, build, unit tests
- **E2E Tests** — pull requests and `main`: production build driven in Chromium
- **Deploy** — manual trigger, builds and deploys via `rsync` over SSH

Required repository secrets for deployment:

| Secret | Description |
|---|---|
| `DEPLOY_KEY` | SSH private key |
| `DEPLOY_HOST_KEY` | Known hosts entry for the target server |
| `DEPLOY_URL` | rsync destination (e.g. `user@host:/var/www/app/`) |

> **Note:** the deploy step runs `rsync` with `--delete`, so anything in the
> destination directory that isn't part of the build output is removed. If you
> keep server-managed files there (e.g. `.well-known/acme-challenge/` for
> Let's Encrypt, a hand-placed `robots.txt`, or host-panel files), point
> `DEPLOY_URL` at a dedicated docroot or add an `--exclude` for those paths.
