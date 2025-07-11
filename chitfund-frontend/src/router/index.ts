import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import Home from '../components/home/Home.vue'
import reportRoutes from './reportRoutes'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  {
    path: '/members',
    name: 'members',
    component: () => import('../components/views/members/MemberList.vue')
  },
  {
    path: '/members/add',
    name: 'add-member',
    component: () => import('../components/views/members/AddMember.vue')
  },
  {
    path: '/members/edit/:id',
    name: 'edit-member',
    component: () => import('../components/views/members/EditMember.vue')
  },
  {
    path: '/groups',
    name: 'groups',
    component: () => import('../components/views/groups/GroupList.vue')
  },
  {
    path: '/groups/add',
    name: 'add-group',
    component: () => import('../components/views/groups/AddGroup.vue')
  },
  {
    path: '/groups/edit/:id',
    name: 'edit-group',
    component: () => import('../components/views/groups/EditGroup.vue')
  },
  {
    path: '/groups/:id/members',
    name: 'group-members',
    component: () => import('../components/views/groups/GroupMembers.vue')
  },
  {
    path: '/groups/:id/more',
    name: 'group-more',
    component: () => import('../components/views/groups/MoreGroupDetails/MoreGroupDetails.vue')
  },
  {
    path: '/collections',
    redirect: '/collections/view'
  },
  {
    path: '/collections/view',
    name: 'view-collections',
    component: () => import('../components/views/collections/ViewCollection.vue')
  },
  {
    path: '/collections/add',
    name: 'add-collection',
    component: () => import('../components/views/collections/AddCollection.vue')
  },
  {
    path: '/collections/adjust',
    name: 'adjust-collections',
    component: () => import('../components/views/collections/AdjustCollections.vue')
  },

  ...reportRoutes
]

function createRouterInstance() {
  return createRouter({
    history: createWebHistory(),
    routes
  })
}

export default createRouterInstance()