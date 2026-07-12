import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/settings',
      component: () => import('@/pages/SettingsPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})

export default router
