import { expect, test } from '@playwright/test'
import {
  appRoot,
  darkModeSwitch,
  openApp,
  openSettings,
  setDarkMode,
  themeColor,
} from './support/app'

/**
 * The theme: the switch in Settings, and the OS preference the app falls back
 * to until that switch is touched (`stores/app.ts`).
 *
 * The preference lives in localStorage rather than in any store the app owns,
 * so what makes it worth a browser test is the reload — the Pinia store reads
 * it back on start, and that is what the reload below is for.
 *
 * Deliberately *not* covered: the `defaultTheme` line in `plugins/vuetify.ts`,
 * which exists so a dark-mode user gets no white flash before the app mounts.
 * Every assertion here runs long after mount, by which point App.vue's
 * `immediate` watcher has set the theme itself — delete that line and this file
 * stays green. Proving it would mean asserting on the first paint, which is not
 * worth the flake; anyone touching it should know a green run here says nothing
 * about it.
 */
test.describe('the dark mode switch', () => {
  test('turns dark mode on, and comes back dark after a reload', async ({ page }) => {
    await openApp(page)
    await openSettings(page)
    await expect(appRoot(page)).toHaveClass(/v-theme--light/)
    await expect(darkModeSwitch(page)).not.toBeChecked()
    const lightColor = await themeColor(page)

    await setDarkMode(page, true)
    // The browser's own chrome follows the theme, which is the reason App.vue
    // touches this tag at all: index.html hard-codes a blue that reads wrong
    // against a dark app.
    const darkColor = await themeColor(page)
    expect(darkColor).not.toBe(lightColor)

    await page.reload()
    await openSettings(page)
    await expect(appRoot(page)).toHaveClass(/v-theme--dark/)
    await expect(darkModeSwitch(page)).toBeChecked()
    expect(await themeColor(page)).toBe(darkColor)

    // And the switch goes back the other way.
    await setDarkMode(page, false)
    expect(await themeColor(page)).toBe(lightColor)
    await page.reload()
    await openSettings(page)
    await expect(appRoot(page)).toHaveClass(/v-theme--light/)
  })
})

/**
 * The other half of `stores/app.ts`: with nothing stored, the app takes the OS
 * colour scheme and keeps tracking it live, and the moment the user picks a
 * theme it stops. `colorScheme` here is what makes the assertions about a
 * *system-wide* dark setting rather than about the runner's own.
 */
test.describe('the OS colour scheme', () => {
  test.use({ colorScheme: 'dark' })

  test('is followed until the user picks a theme, and then is not', async ({ page }) => {
    // No reload, no localStorage: this is a first-ever launch on a dark OS,
    // the case the fallback exists for.
    await openApp(page)
    await openSettings(page)
    await expect(appRoot(page)).toHaveClass(/v-theme--dark/)
    await expect(darkModeSwitch(page)).toBeChecked()

    // Still tracking it, without a reload — the store keeps the `change`
    // listener on the media query for exactly this.
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(appRoot(page)).toHaveClass(/v-theme--light/)
    await expect(darkModeSwitch(page)).not.toBeChecked()

    // The switch is an explicit choice, so the OS stops having a say: this
    // asserts the listener was detached, which is the part that would go
    // unnoticed if it broke — a user who chose dark on a light OS would have
    // the app flip back under them at sunrise.
    await setDarkMode(page, true)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(appRoot(page)).toHaveClass(/v-theme--dark/)
    await expect(darkModeSwitch(page)).toBeChecked()
  })
})
