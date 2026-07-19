import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import App from '@/App.vue'
import router from '@/router'

describe('App', () => {
  it('mounts and renders the shell', async () => {
    const vuetify = createVuetify({ components, directives })
    const pinia = createPinia()

    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [vuetify, pinia, router] },
    })

    expect(wrapper.find('.v-application').exists()).toBe(true)
    expect(wrapper.find('.v-bottom-navigation').exists()).toBe(true)
  })
})
