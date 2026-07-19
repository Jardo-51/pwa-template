# Code Review — pwa-template

- **Date:** 2026-07-12
- **Reviewed at:** commit `aee5356` (branch `main`, clean working tree)
- **Scope:** entire project — all `src/` files, Vite/TS/ESLint configs, PWA manifest, `.htaccess`, GitHub Actions workflows, Nix flake, `package.json`, README.
- **Verification performed:** `pnpm lint` (clean), `pnpm type-check` (clean), `pnpm build-only` (successful; dist output inspected to substantiate the font/precache findings).

## Summary

The template is small, idiomatic, and in good shape overall: strict TS project references, clean ESLint (vuetify config), lazy-loaded routes, sensible store design, a well-thought-out `.htaccess` (CSP, SPA rewrite, `sw.js` no-cache), and a working Nix-based CI. No CRITICAL findings.

The dominant problem is **font handling**: the `unplugin-fonts` fontsource config causes 192 font preloads (~4 MB in woff2 **and** woff) on every first visit and inflates the service-worker precache to **2.8 MB / 113 entries** — for an app that renders Latin text in a handful of weights. Fixing findings 1, 2, and 4 would shrink the offline install roughly tenfold.

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 11 |
| LOW | 17 |

---

## HIGH

- [x] **1. (HIGH)** Every Roboto subset is preloaded in both woff2 and woff — ~4 MB of fonts forced onto first page load.
  `vite.config.mts:19-29` requests 6 weights × 2 styles from fontsource; each variant ships 8 unicode-range subsets (latin, latin-ext, cyrillic, cyrillic-ext, greek, greek-ext, vietnamese, symbols…), producing 96 woff2 files in `dist`. `unplugin-fonts` then injects a `<link rel="preload" as="font">` for **every** `src` URL — measured in the built `index.html`: 96 woff2 + 96 woff = **192 preloads** (the built index.html is 26 KB of mostly preload tags). `rel=preload` downloads immediately and unconditionally, defeating the `unicode-range` lazy-subset mechanism, and the woff copies are pure waste since every browser that runs Vue 3 supports woff2.
  **Fix:** drop the `Fonts()` plugin (and the `import 'unfonts.css'` in `src/main.ts:17`) and instead import only what's used directly in `main.ts`, e.g. `import '@fontsource/roboto/latin-300.css'` / `latin-400` / `latin-500` / `latin-700` (`@fontsource/roboto` is already a direct dependency). This also makes the `remove-mdi-font-preloads` workaround plugin (`vite.config.mts:67-74`) unnecessary. If you keep `unplugin-fonts`, at minimum trim `weights` to `[300, 400, 500, 700]` and drop `italic`.

- [x] **2. (HIGH)** Service-worker precache is 2.8 MB (113 entries), almost entirely fonts — every install/update downloads all of it.
  `vite.config.mts:33` globs `**/*.woff2`, so all 96 Roboto subsets (~2 MB) plus the 400 KB full MDI webfont are precached on first visit and re-validated on every SW update. Build output confirms: `precache 113 entries (2789.90 KiB)`.
  **Fix:** fix finding 1 first (fewer files to glob), and consider removing `woff2` from `globPatterns` in favor of a `runtimeCaching` rule (`CacheFirst`, long expiration) for fonts so only fonts actually used get cached. With findings 1 + 4 addressed, keeping woff2 in the precache glob becomes fine.

- [x] **3. (HIGH)** No catch-all route — any unknown URL renders a blank page.
  `src/router/index.ts:5-14` defines only `/` and `/settings`. Because the SPA rewrite (`.htaccess`) and the workbox `navigateFallback` serve `index.html` for every path, any typo'd, stale, or externally shared deep link mounts the app with an empty `<router-view>` and only a console warning.
  **Fix:** add a `{ path: '/:pathMatch(.*)*', ... }` route rendering a NotFound page (or redirecting to `/`).

## MEDIUM

- [x] **4. (MEDIUM)** Full MDI webfont (400 KB woff2, 3.5 MB across formats in dist) shipped for the 2 icons the template uses.
  `src/plugins/vuetify.ts:2` imports `@mdi/font`, which ships the complete ~7000-icon font in eot/ttf/woff/woff2 (all four end up in `dist/assets/`).
  **Fix:** switch to `@mdi/js` + the `mdi-svg` iconset (tree-shakable — only imported icon paths are bundled). Removes ~400 KB from the precache and all four font files from dist.
  **Note:** when this lands, also drop the `**/materialdesignicons*.woff2` entry from the workbox `globPatterns` in `vite.config.mts` (added in 045b3fd to precache the icon font) — it becomes a dead glob once the webfont is gone.
  **Caveat (ergonomics):** this trades the font's "type any icon name" convenience for smaller bundles. Today any of the ~7000 icons works by string — `<v-icon>mdi-home</v-icon>` — with zero setup. With `@mdi/js` + `mdi-svg`, every icon is still *available*, but each must be imported by name and passed as a path (`import { mdiHome } from '@mdi/js'` → `<v-icon :icon="mdiHome" />`); only imported icons ship, and the `mdi-xxx` string form stops working. Since this is a template, downstream apps inherit that workflow — worth documenting in the README so it isn't a surprise. (The two current usages in `AppBottomNav.vue` would migrate from `<v-icon>mdi-home</v-icon>` / `mdi-cog` to the imported-path form.)
  **Caveat (scope of what keeps working):** the split is whether an icon renders *through Vuetify* or *directly via the font's CSS classes*. (a) Vuetify's own built-in UI icons — checkbox checks, dropdown chevrons, close buttons, data-table sort arrows, pagination, etc. — keep working, but only if the config wires up `aliases` from the iconset (`import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'`), which re-exports them as SVG paths; omit `aliases` and Vuetify's chrome loses its icons. (b) Icon *props* on components (`prepend-icon`, `append-icon`, `v-btn` `icon`, `v-list-item`, `v-tab`, …) are supported but need the imported-path value, not the `mdi-xxx` string (with the svg set that string is treated as path data and renders nothing). (c) Raw font usage *outside* Vuetify breaks entirely, since the `@mdi/font` stylesheet is no longer loaded: `<i class="mdi mdi-home">`, custom CSS `::before { content: '\FXXXX'; font-family: 'Material Design Icons' }`, and any third-party lib expecting the MDI webfont. The template only uses `<v-icon>` today so in-repo impact is small, but downstream apps relying on (c) would need reworking.

- [x] **5. (MEDIUM)** `registerSW.js` is cached as immutable for 1 year despite not being content-hashed.
  `public/.htaccess:1-3` applies `max-age=31536000, immutable` to all `.js` files, but vite-plugin-pwa emits `dist/registerSW.js` with a stable name. If a plugin upgrade or config change (SW filename, scope, base) alters its content, existing visitors keep the stale registration script for up to a year.
  **Fix:** add a `<Files "registerSW.js">` block with the same no-cache headers used for `sw.js`.

- [x] **6. (MEDIUM)** No explicit cache headers for `index.html` and `manifest.webmanifest`.
  `public/.htaccess` pins hashed assets and `sw.js`, but the HTML shell gets no `Cache-Control`, so browsers apply heuristic caching (a fraction of the `Last-Modified` age). Clients not yet controlled by the SW (first visits, users who cleared the SW) can receive a stale `index.html` referencing asset hashes; today rsync-without-delete masks this (see finding 12), but the two settings should not depend on each other.
  **Fix:** add `no-cache` (or `max-age=0, must-revalidate`) headers for `index.html` and `manifest.webmanifest`.

- [x] **7. (MEDIUM)** Dark mode ignores the OS preference — first launch is always light.
  `src/stores/app.ts:8` defaults to light whenever `localStorage` is unset, and `src/plugins/vuetify.ts:7` sets `defaultTheme: 'light'`. Users with a system-wide dark preference get a white flash-bang on install.
  **Fix:** fall back to `window.matchMedia('(prefers-color-scheme: dark)').matches` when the localStorage key is absent (or restructure around Vuetify's `'system'` theme and store an explicit light/dark/system tri-state).

- [x] **8. (MEDIUM)** Consecutive snackbar messages can vanish almost immediately — the timeout is never reset.
  `src/stores/app.ts:10-14` sets `snackbar.value = true` while it may already be `true`; Vuetify's `VSnackbar` starts its `:timeout` (`src/App.vue:12`) only on the `false → true` transition, so a second `showSnackbar()` call replaces the text but inherits the first message's nearly expired timer.
  **Fix:** in `showSnackbar`, set `snackbar.value = false` then re-open on `nextTick()` (or maintain a message queue).

- [x] **9. (MEDIUM)** Manifest icon declares `purpose: 'any maskable'` on a non-maskable image.
  `vite.config.mts:54-59` reuses the plain 512×512 icon for both purposes. Maskable icons need the safe-zone padding (icon content within the inner 80%); a shared image either gets cropped on Android launchers or looks undersized elsewhere. Lighthouse flags combined `any maskable` for this reason.
  **Fix:** add a dedicated padded `pwa-maskable-512x512.png` with `purpose: 'maskable'` and keep the existing icons as `purpose: 'any'`.

- [x] **10. (MEDIUM)** GitHub workflows don't restrict `GITHUB_TOKEN` permissions.
  Neither `.github/workflows/build.yml` nor `deploy.yml` declares a `permissions:` block, so jobs inherit the repo/org default, which may be read-write. Neither job needs more than `contents: read`.
  **Fix:** add `permissions: contents: read` at the workflow level in both files.

- [x] **11. (MEDIUM)** CI never runs ESLint — only type-check + build.
  `.github/workflows/build.yml:27-32` runs `pnpm build` (which includes `type-check`), but `pnpm lint` is never executed, so lint regressions land silently.
  **Fix:** add `pnpm lint` to the build step (or a parallel job).

- [x] **12. (MEDIUM)** Deploys never delete anything — stale files accumulate on the server forever.
  `deploy.yml:51` runs `rsync -crvz` without `--delete`. Every deploy layers new hashed assets over all previous ones; over time the doc root fills with dead JS/CSS/fonts, and removed files (e.g. an old page pre-rendered file) remain publicly served. Keeping one previous generation of assets is a legitimate strategy for open tabs, but unbounded accumulation isn't.
  **Fix:** if intentional, document it in the README and add a periodic cleanup; otherwise add `--delete` (safe here because the SW precaches everything the old clients need, and finding 6's no-cache HTML prevents stale-shell 404s).

- [x] **13. (MEDIUM)** `playwright` dev shell sits outside the standard flake output schema.
  `flake.nix:26-36` defines `outputs.playwright` at the top level rather than under `devShells.${system}`. `nix flake check`/`nix flake show` flag it as an unknown output, and `nix develop .#playwright` only resolves through the literal-attrpath fallback rather than the documented shell lookup.
  **Fix:** move it to `devShells.${system}.playwright`.

- [x] **14. (MEDIUM)** `resolve.extensions` includes `.vue`, which Vite explicitly recommends against.
  `vite.config.mts:81-89` re-declares the default extension list plus `.vue`. Allowing extension-less `.vue` imports breaks IDE/type tooling (vue-tsc and Volar expect explicit `.vue` extensions, which the codebase already uses everywhere).
  **Fix:** delete the `extensions` array entirely (the defaults suffice).

## LOW

- [x] **15. (LOW)** `define: { 'process.env': {} }` in `vite.config.mts:76` is a legacy scaffold shim. Nothing in the app or current Vuetify reads `process.env`; it silently masks misuse of Node envs in browser code. Try removing it (verify with a build).

- [x] **16. (LOW)** `workbox-window` (`package.json:23`) is unused — it's only needed when importing the `virtual:pwa-register` module, and this app relies on the auto-injected `registerSW.js`. Also, `vite-plugin-pwa` is a build-time plugin and belongs in `devDependencies`. Remove `workbox-window`, move `vite-plugin-pwa` (and check whether `workbox-build` is still needed as an explicit dep — it's pulled in by `vite-plugin-pwa`).

- [x] **17. (LOW)** `tsconfig.node.json:3-9` includes `vitest.config.*`, `cypress.config.*`, `nightwatch.conf.*`, `playwright.config.*` — none exist in the project. Harmless but misleading; trim to `vite.config.*` (or keep deliberately as template affordance and add a comment).

- [x] **18. (LOW)** `tsconfig.app.json:3` includes `"env.d.ts"` at the repo root, but the file lives at `src/env.d.ts` (already covered by `src/**/*`). Remove the stale entry or move the file to the root to match.

- [x] **19. (LOW)** Routes in `src/router/index.ts` have no `name`. Named routes make programmatic navigation and active-state checks less brittle as the template grows.

- [x] **20. (LOW)** No `scrollBehavior` on the router — navigating between pages preserves the previous scroll position. Add the standard `scrollBehavior: () => ({ top: 0 })` (with `savedPosition` support).

- [x] **21. (LOW)** Snackbar timeout is hardcoded to `3000` in `src/App.vue:12` while the rest of the snackbar state lives in the store. Move the timeout into the store (optionally as a `showSnackbar` parameter) so callers can control it.

- [x] **22. (LOW)** `class="pb-16"` on `<v-main>` (`src/App.vue:3`) may double-pad: `v-bottom-navigation` is a Vuetify layout component, so `v-main` should already reserve space for it. Verify in the browser; if the layout offset works, drop the class (or if it doesn't, prefer wiring the nav into the layout over a magic padding number).

- [x] **23. (LOW)** `index.html` lacks a `<meta name="description">`, and the single `theme-color` (`#1976D2`) doesn't adapt to dark mode. Add a description and consider paired `<meta name="theme-color" media="(prefers-color-scheme: …)">` tags.

- [x] **24. (LOW)** Manifest polish: no `id` field (Chromium uses it for app identity across `start_url` changes), and `orientation: 'portrait'` hard-locks installed desktop/tablet windows. Add `id: '/'` and reconsider the orientation lock per app.

- [x] **25. (LOW)** `.htaccess` hardening: add `AddType application/manifest+json .webmanifest` (older Apache serves it as `text/plain`), and consider `form-action 'self'` in the CSP. `X-Frame-Options` is redundant next to `frame-ancestors 'none'` but harmless.

- [ ] **26. (LOW)** `deploy.yml:44-47` writes the SSH key with the default umask and then `chmod 600`s it — a brief window where the file is 0644. On an ephemeral single-tenant runner this is theoretical; still, `(umask 077; echo "…" > ~/.ssh/id_ed25519)` or `install -m 600` is the cleaner idiom.

- [ ] **27. (LOW)** `build.yml` and `deploy.yml` duplicate the checkout/Nix/pnpm-cache/build sequence verbatim. Extract a composite action (`.github/actions/build/`) or a reusable workflow so the two can't drift.

- [ ] **28. (LOW)** No `concurrency` group in `build.yml` — rapid pushes to the same branch queue redundant builds. Add `concurrency: { group: build-${{ github.ref }}, cancel-in-progress: true }`.

- [ ] **29. (LOW)** `flake.nix:10` hardcodes `x86_64-linux`; the dev shell won't evaluate on macOS or aarch64. Fine if the team is Linux-only; otherwise map over systems (e.g. `nixpkgs.lib.genAttrs` or `flake-utils`).

- [ ] **30. (LOW)** Stray backticks in comments: `src/main.ts:4` ("mounts the App\`") and `src/styles/settings.scss:7` (URL ends with a backtick, breaking the link when clicked).

- [ ] **31. (LOW)** No test infrastructure at all, even though `.gitignore` and `tsconfig.node.json` anticipate Vitest/Cypress/Playwright and the flake ships a Playwright shell. For a template meant to seed real apps, a minimal Vitest + one smoke test (mount `App.vue`) would make downstream projects start with testing wired up.
