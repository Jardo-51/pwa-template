import { expect, test } from '@playwright/test'
import {
  appRoot,
  darkModeSwitch,
  openApp,
  openHome,
  openSettings,
  serviceWorkerReady,
  setDarkMode,
  settingsCard,
} from './support/app'

/**
 * The service worker, which is what makes this an app the user can open rather
 * than a page they have to be online for. `VitePWA` precaches the build
 * (`globPatterns` in `vite.config.mts`) and workbox serves navigations out of
 * it, and nothing here is visible until the network is gone: online, every
 * assertion below passes with the worker deleted.
 *
 * This is the test an app built on the template should keep running as it grows
 * — the failure it catches is a `globPatterns` or a `manifest` change that
 * leaves the app booting fine on a warm network and dead on a train.
 */
test.describe('the app with the network down', () => {
  test('reloads, routes and keeps its settings', async ({ page }) => {
    await openApp(page)
    // Something persisted to check the app came back *with its state*, not just
    // that it rendered. localStorage never needed the network, but a reload
    // that lost it would say the app booted without reading it.
    await setDarkMode(page, true)
    await serviceWorkerReady(page)

    await page.context().setOffline(true)
    await page.reload()

    // The app came back at all: `index.html` and the entry bundle were served
    // by the worker, since nothing could have fetched them.
    await openHome(page)
    await expect(appRoot(page)).toHaveClass(/v-theme--dark/)

    // Each route is a chunk of its own (`router/index.ts` imports the three
    // pages lazily), and the reload dropped the module graph, so Settings is
    // being fetched here with nowhere but the precache to come from. A
    // `globPatterns` that stopped covering the chunks would leave the app
    // booting and then failing to navigate, which is what this catches.
    await openSettings(page)
    await expect(darkModeSwitch(page)).toBeChecked()

    // A cold start on a URL that no file corresponds to: `/settings` is a
    // client-side route, so this is workbox's navigate fallback handing back
    // the precached `index.html` and the router taking it from there. The
    // in-app navigation above cannot show this — it never made a document
    // request — and it is what a user reopening an installed app does. Home
    // first so the assertion stands on its own: Settings being on screen after
    // it can only be the cold start having rendered it.
    await openHome(page)
    await page.goto('/settings')
    await expect(settingsCard(page)).toBeVisible()

    // The same fallback for a path the router has no route for either, which is
    // the case where "the server would have 404'd" and "the app renders its own
    // not-found page" are told apart: offline there is no server to have done
    // the former.
    await page.goto('/no-such-page')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'Go home', exact: true }).click()
    await openHome(page)
  })
})
