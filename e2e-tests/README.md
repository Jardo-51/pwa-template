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

`playwright-driver.browsers` pins one set of browser revisions and
`@playwright/test` in `package.json` is pinned exactly (no caret) to match.
Nothing in the package manager knows about that coupling, so
`scripts/check-playwright-pin.sh` is the guard for it — its header explains the
failure mode it exists to catch, and it rejects both a drifted version and a
range spec:

```sh
pnpm check:playwright-pin
```

CI runs it in `e2e-tests.yml` **before** the suite, so the diagnosis arrives
ahead of the failure it explains. To bump the two sides together deliberately,
move the npm side to whatever the check reports:

```sh
pnpm add -D @playwright/test@<version the check printed>
```

## The suites

The template ships the two suites that are about the template itself rather than
about any app built on it, so both stay useful after you delete the demo pages.

What each one covers, and what it deliberately does not, is in its own docblock
— that is where it stays in step with the assertions. In outline:

- `pwa.spec.ts` — the service worker: the app with the network cut. The one
  worth keeping green as an app grows.
- `settings.spec.ts` — the theme: the switch, the reload that proves it is read
  back, and the OS colour scheme the app follows until the user chooses.

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
  helpers call `settle()` before navigating. It clears a snackbar that is
  already on screen (clicking the message's Close button rather than waiting the
  timeout out) and returns at once when there is none, so after a *mutating*
  action wait for the snackbar to appear before calling it — otherwise it
  returns before the thing it is meant to wait for exists.
- **Match names with `exact: true`.** Playwright matches an accessible name as a
  case-insensitive substring by default, so `getByRole('link', { name: 'Home' })`
  also finds the not-found page's *Go home* button.
