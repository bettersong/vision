import { createWebHistory, createRouter } from 'vue-router'


const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/gesture'
    },
    {
      path: '/gesture',
      component: () => import('./pages/gesture.vue')
    },
    {
      path: '/choose',
      component: () => import('./pages/chooseImg.vue')
    }
  ]
});

export default router;
