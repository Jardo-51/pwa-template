import { defineStore } from 'pinia'
import { nextTick, ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const snackbar = ref(false)
  const snackbarText = ref('')
  const snackbarColor = ref('success')
  // Honour the user's explicit choice when set; otherwise fall back to the OS
  // colour-scheme preference so a system-wide dark setting doesn't get a white
  // flash-bang on first launch.
  const storedDarkMode = localStorage.getItem('darkMode')
  const darkMode = ref(
    storedDarkMode === null
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : storedDarkMode === 'true',
  )

  function showSnackbar (text: string, color = 'success') {
    // Force a false → true transition so VSnackbar restarts its timeout even
    // when a previous message is still showing; otherwise the new message
    // inherits the old (nearly expired) timer and can vanish immediately.
    snackbar.value = false
    void nextTick(() => {
      snackbarText.value = text
      snackbarColor.value = color
      snackbar.value = true
    })
  }

  function toggleDarkMode () {
    darkMode.value = !darkMode.value
    localStorage.setItem('darkMode', String(darkMode.value))
  }

  return {
    snackbar,
    snackbarText,
    snackbarColor,
    darkMode,
    showSnackbar,
    toggleDarkMode,
  }
})
