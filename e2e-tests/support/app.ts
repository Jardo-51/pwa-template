import { expect, type Page } from '@playwright/test'

/**
 * The helpers the specs drive the app through — the bottom nav, the cards, the
 * switch — plus the two waits that make a browser test deterministic rather
 * than a race: {@link settle} and {@link serviceWorkerReady}.
 *
 * The rule these follow, and the one an app built on this template should keep
 * following: drive the app the way a user does. Reaching past the UI (into
 * IndexedDB, localStorage, `window`) is for a test whose subject has no form on
 * screen at all, and each such helper should say why it is one.
 * {@link serviceWorkerReady} is not a precedent for it — it asks the browser
 * about the browser, and nothing asserts on its answer.
 */

/** Opens the app at Home and waits for the shell to be up. */
export async function openApp (page: Page) {
  await page.goto('/')
  await expect(homeHeading(page)).toBeVisible()
}

/**
 * Waits until this page is being served *through* the service worker, which is
 * what has to be true before a test may cut the network.
 *
 * `controller` is the whole condition, and it says more than "a worker
 * exists". A worker only reaches the point of controlling a page by activating,
 * and `VitePWA`'s generated `sw.js` only activates once its install step has
 * written the precache — the build's HTML, JS, CSS, icons — to disk. So a
 * non-null controller means the files the app would otherwise ask the network
 * for are already on the device.
 *
 * It has to be waited for rather than assumed: `registerSW.js` registers on the
 * window's `load` event, and a test going offline straight after the first
 * paint would beat the install and then fail at the reload with
 * `net::ERR_INTERNET_DISCONNECTED` — a race, not a regression.
 *
 * The wait is `clientsClaim`'s doing (`registerType: 'autoUpdate'` sets it): a
 * first-ever worker would otherwise control nothing until the next navigation,
 * and this would hang on a healthy app.
 */
export async function serviceWorkerReady (page: Page) {
  // 30 s: an install of this precache is a fraction of a second locally, so
  // anything near this is a worker that is never going to activate.
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 30_000 },
  ).catch(() => {
    throw new Error(
      'No service worker took control of the page, so the precache was never '
      + 'written — an asset in `globPatterns` that cannot be fetched fails the '
      + 'install step and the worker never activates.',
    )
  })
}

/**
 * Snackbars sit over the bottom of the screen, where the nav is, and swallow
 * the clicks aimed at it. Resolves immediately when none is showing, which is
 * why the helpers below can call it unconditionally.
 *
 * Dismissed rather than waited out where that is possible: the message would
 * otherwise stay up for its full timeout and a suite that shows one in most of
 * its tests spends that idling. The close button is the same one a user has —
 * the template's own snackbar has none, but `closable` messages are the first
 * thing an app built on it tends to add.
 *
 * That click is best-effort — bounded, and its failure swallowed — because the
 * message can expire under it: finding the button says nothing about it still
 * being there when the click lands, and an unbounded click left waiting for a
 * button that has gone holds on until the test itself times out. Whatever the
 * click does not manage, the wait below covers.
 *
 * The `isVisible()` guard in front of it is what keeps that bound off the
 * common path: most calls find no snackbar at all, and going straight to the
 * click makes every one of those pay the timeout in full.
 */
export async function settle (page: Page) {
  const snack = page.locator('.v-snackbar--active').first()
  const close = snack.getByRole('button', { name: 'Close' })
  if (await close.isVisible()) {
    await close.click({ timeout: 1000 }).catch(() => {})
  }
  await snack.waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
}

/**
 * `exact` on every nav match on purpose: Playwright matches an accessible name
 * as a case-insensitive *substring* by default, so a plain `'Home'` also picks
 * up the not-found page's *Go home* button.
 */
async function navigate (page: Page, to: 'Home' | 'Settings') {
  await settle(page)
  await page.getByRole('link', { name: to, exact: true }).click()
}

function homeHeading (page: Page) {
  return page.getByRole('heading', { name: 'Home', exact: true })
}

export async function openHome (page: Page) {
  if (new URL(page.url()).pathname !== '/') {
    await navigate(page, 'Home')
  }
  await expect(homeHeading(page)).toBeVisible()
}

export async function openSettings (page: Page) {
  await navigate(page, 'Settings')
  await expect(settingsCard(page)).toBeVisible()
}

/** The Appearance card, which is what says the Settings page has rendered. */
export function settingsCard (page: Page) {
  return page.locator('.v-card').filter({ hasText: 'Appearance' })
}

/** The Appearance card's switch. Its own label is what the user reads. */
export function darkModeSwitch (page: Page) {
  return page.getByLabel('Dark mode', { exact: true })
}

/**
 * The element Vuetify hangs the active theme off, as `v-theme--dark` or
 * `v-theme--light` — the one place the choice is observable from outside.
 */
export function appRoot (page: Page) {
  return page.locator('.v-application')
}

/** The colour the browser paints its own chrome with, kept in step by App.vue. */
export function themeColor (page: Page): Promise<string | null> {
  return page.locator('meta[name="theme-color"]').getAttribute('content')
}

/** Turns dark mode on or off from the Appearance card. */
export async function setDarkMode (page: Page, dark: boolean) {
  await openSettings(page)
  await settle(page)
  await darkModeSwitch(page).setChecked(dark)
  await expect(appRoot(page)).toHaveClass(dark ? /v-theme--dark/ : /v-theme--light/)
}
