# End-to-end tests

Playwright, driving the **production build** in a browser: `pnpm build` and a
`vite preview` server are started by `playwright.config.ts`, so a run checks the
minified bundle, the lazy route chunks and the service worker, not the dev
server.

## Running them

The browsers do not come from `playwright install` — they come from nixpkgs
instead, via the `playwright` shell in `flake.nix`:

```sh
nix develop .#playwright -c pnpm test:e2e
```

That shell exports `PLAYWRIGHT_BROWSERS_PATH` (at `playwright-driver.browsers`)
and `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`. Outside it, a run fails with
*"Executable doesn't exist"* — unless you have run `playwright install`
yourself, which is fine too, but then CI and your machine are driving different
binaries.

CI runs them through the same shell (`.github/workflows/e2e-tests.yml`).

Useful variations:

```sh
nix develop .#playwright -c pnpm test:e2e pwa.spec.ts   # one file
nix develop .#playwright -c pnpm test:e2e --headed      # watch it
nix develop .#playwright -c pnpm test:e2e --debug       # step through it
pnpm test:e2e:report                                    # last HTML report
```

### The preview port is shared

`playwright.config.ts` starts `vite preview` on **4173** and, outside CI, reuses
whatever is already answering there (`reuseExistingServer`). If another project
on this machine — say one derived from this template — left a preview server on
that port, a run silently drives *that* app instead, and every locator fails
with "element(s) not found" against a page you did not build. Reuse also skips
`pnpm build`, so a preview server left over from an hour ago gives you a green
run against a **stale bundle** — and that one does not announce itself at all.
Check with `ss -ltnp | grep 4173` when a run fails that way.

Move out of the way with `E2E_PORT`, rather than editing tracked config:

```sh
E2E_PORT=4273 nix develop .#playwright -c pnpm test:e2e
```

### Keeping the versions in step

`playwright-driver.browsers` pins one set of browser revisions, and
`@playwright/test` in `package.json` is pinned exactly (no caret) to match.
Bump them together:

```sh
nix eval --raw 'github:NixOS/nixpkgs/nixos-26.05#playwright-driver.version'
pnpm add -D @playwright/test@<that version>
```

## The suites

The template ships the two suites that are about the template itself rather than
about any app built on it, so both stay useful after you delete the demo pages.

`pwa.spec.ts` is the one file about the service worker: the network goes down
and the app still reloads, keeps its stored settings, routes between its
lazily-loaded pages and answers a cold `/settings` — and a cold unknown path —
out of workbox's navigate fallback. Every assertion in it passes with the worker
deleted as long as the network is up, which is why it cuts it. It is the test
worth keeping green as an app grows: what it catches is a `globPatterns` or
manifest change that leaves the app booting fine on a warm network and dead on a
train.

`settings.spec.ts` is the theme: the switch in Settings, that the choice
survives a reload (it lives in localStorage, so the reload *is* the test), and
`stores/app.ts`'s other half — the OS colour scheme is followed until the user
picks a theme, and stops being followed the moment they do.

## Conventions

These are what the two suites follow, and what a new one should.

- **Drive the app the way a user does**: the bottom nav, the buttons, the
  dialogs. Reaching past that — into IndexedDB, localStorage, `window` — is for
  a test whose subject has no form on screen at all, and each helper that does
  it should say in a comment why it is one of those. `serviceWorkerReady` is not
  a precedent for it: it reads `navigator.serviceWorker`, the browser rather
  than the app, and nothing is asserted on what it returns — it is the wait that
  makes cutting the network a test instead of a race.
- **Assert with `expect`, which retries. No sleeps.** Waiting for something
  means waiting for the thing on screen that says it happened, not for a
  plausible number of seconds to pass.
- **Snackbars sit over the bottom nav and swallow clicks aimed at it** — the
  helpers call `settle()` before navigating, which returns at once when there is
  no snackbar up. Where there is one, it clicks the message's Close button
  rather than waiting the timeout out.
- **Match names with `exact: true`.** Playwright matches an accessible name as a
  case-insensitive substring by default, so `getByRole('link', { name: 'Home' })`
  also finds the not-found page's *Go home* button.
