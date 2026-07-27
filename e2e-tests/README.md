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
Nothing in the package manager knows about that coupling, so a routine
`pnpm update -L` — or a bump of the nixpkgs branch in `flake.lock` — moves one
side and not the other. The symptom is a launch failing with *"Executable
doesn't exist"*, which names neither the pin nor the flake and sends people to
`playwright install`, "fixing" it locally while leaving CI broken.

`scripts/check-playwright-pin.sh` is the guard for that. It reads the installed
package version and the driver version out of the flake's own locked input, and
fails with the command that reconciles them:

```sh
pnpm check:playwright-pin
```

CI runs it in `e2e-tests.yml` **before** the suite, so the diagnosis arrives
ahead of the failure it explains. It also rejects a range spec (`^1.59.1`),
since with a caret a fresh clone can resolve past the browsers on its own.

To bump them together deliberately, move the npm side to whatever the check
reports:

```sh
pnpm add -D @playwright/test@<version the check printed>
```

## The suites

The template ships the two suites that are about the template itself rather than
about any app built on it, so both stay useful after you delete the demo pages.

`pwa.spec.ts` is the one file about the service worker: the network goes down
and the app still reloads, keeps its stored settings, routes between its
lazily-loaded pages and answers a cold `/settings` — and a cold unknown path —
out of workbox's navigate fallback. Every assertion in it passes with the worker
deleted as long as the network is up, which is why it cuts it. It is the test
worth keeping green as an app grows: what it catches is a `globPatterns` change
that leaves the app booting fine on a warm network and dead on a train.

It does *not* cover the web app manifest — nothing fetches
`manifest.webmanifest` or checks installability, and `globPatterns` in
`vite.config.mts` does not list that extension — so a broken `start_url` or a
dropped icon passes silently. Fetching the manifest while offline and asserting
on it would be a good first addition.

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
