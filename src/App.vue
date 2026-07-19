<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>

    <AppBottomNav />

    <v-snackbar
      v-model="app.snackbar"
      :color="app.snackbarColor"
      :timeout="app.snackbarTimeout"
    >
      {{ app.snackbarText }}
    </v-snackbar>
  </v-app>
</template>

<script lang="ts" setup>
  import { watch } from 'vue'
  import { useTheme } from 'vuetify'
  import AppBottomNav from '@/components/layout/AppBottomNav.vue'
  import { useAppStore } from '@/stores/app'

  const app = useAppStore()
  const theme = useTheme()

  watch(() => app.darkMode, dark => {
    theme.change(dark ? 'dark' : 'light')
    // Keep the browser chrome (theme-color) tracking the in-app theme rather
    // than only the OS colour scheme, so a persisted dark toggle on a light OS
    // still gets dark chrome.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#121212' : '#1976D2')
  }, { immediate: true })
</script>
