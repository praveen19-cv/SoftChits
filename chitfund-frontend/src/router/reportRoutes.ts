import { RouteRecordRaw } from 'vue-router';

const reportRoutes: RouteRecordRaw[] = [
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/components/views/reports/ReportsLayout.vue'),
    children: [
      {
        path: 'chit-ledger',
        name: 'chit-ledger',
        component: () => import('@/components/views/reports/ChitLedger.vue'),
        meta: {
          title: 'Chit Ledger'
        }
      },
      {
        path: 'customer-sheet',
        name: 'customer-sheet',
        component: () => import('@/components/views/reports/CustomerSheet.vue'),
        meta: {
          title: 'Customer Sheet'
        }
      }
    ]
  }
];

export default reportRoutes; 