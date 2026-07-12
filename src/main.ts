/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue'

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Styles — only the Roboto weights Vuetify uses (latin subset), imported
// directly so they are bundled without unconditional `<link rel=preload>` tags.
// Localized apps should add the matching subset for their languages so those
// characters render in Roboto rather than falling back to the system font,
// e.g. `import '@fontsource/roboto/latin-ext-400.css'` for Central European
// diacritics or `cyrillic-400.css` for Cyrillic text.
import '@fontsource/roboto/latin-300.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'

const app = createApp(App)

registerPlugins(app)

app.mount('#app')
