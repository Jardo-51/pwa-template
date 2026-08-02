import process from 'node:process'
import { defineConfig } from '@playwright/test'

// `reuseExistingServer` below means whatever already answers on this port is
// what the suite drives — including a stale preview of another project derived
// from this template, which every fork ships on the same 4173. Override rather
// than edit this file when that happens:
//
//     E2E_PORT=4273 pnpm test:e2e
//
// `--strictPort` is the other half of it: vite fails loudly instead of quietly
// bumping to a port nothing is pointed at.
const PORT = Number(process.env.E2E_PORT ?? 4173)
// Checked rather than trusted: `Number('427e')` is NaN, not an error, and the
// only symptom would be the `webServer` wait timing out after 180 s against
// `http://127.0.0.1:NaN` — a failure that names neither the variable nor the
// typo. This is the knob people reach for when a run is already misbehaving,
// so it has to fail in a way that points at itself.
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error(`E2E_PORT must be a port number, got '${process.env.E2E_PORT}'.`)
}
const BASE_URL = `http://127.0.0.1:${PORT}`

/**
 * End-to-end tests, run against the production build.
 *
 * The browsers come from nix rather than from `playwright install`, and CI
 * takes them from the same shell, so both drive the same binary:
 *
 *     nix develop .#playwright -c pnpm test:e2e
 *
 * The shell exports `PLAYWRIGHT_BROWSERS_PATH` at the nixpkgs
 * `playwright-driver.browsers` derivation, which pins one set of browser
 * revisions. `@playwright/test` is therefore pinned exactly (no caret) to the
 * matching version — bump the two together, or a launch fails with
 * "Executable doesn't exist". Check what nixpkgs has with:
 *
 *     nix eval --raw 'github:NixOS/nixpkgs/nixos-26.05#playwright-driver.version'
 *
 * See e2e-tests/README.md.
 */
export default defineConfig({
  testDir: './e2e-tests',
  // A run drives a service worker and browser-persisted state; one worker keeps
  // those off each other's toes and keeps failures reproducible. Raise this
  // once an app built on the template has enough tests for it to matter.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 120_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    // The template's shell is phone-first (a bottom nav); this is the viewport
    // it is designed for. Not `isMobile`, which changes little here beyond
    // making clicks flakier.
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],

  // The built app, not the dev server: the service worker, the lazy route
  // chunks and the minified bundle are all part of what is being checked.
  webServer: {
    // `--host 127.0.0.1` rather than vite's default: it otherwise binds
    // `localhost`, which on the CI runners resolves to ::1 first, and the
    // wait below polls IPv4 and never gets an answer.
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Not silenced: when the wait does time out, the server's own output is
    // the only thing that says whether it ever came up.
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
