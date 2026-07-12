<template>
  <v-bottom-navigation grow>
    <v-btn to="/">
      <v-icon :icon="mdiHome" />
      <span>Home</span>
    </v-btn>

    <v-btn to="/settings">
      <v-icon :icon="mdiCog" />
      <span>Settings</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<script lang="ts" setup>
  import { mdiCog, mdiHome } from '@mdi/js'
</script>
