import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';

export interface ChitLedger {
  member_id: number;
  member_name: string;
  group_id: number;
  group_name: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  installments: {
    installment_number: number;
    amount: number;
    date: string;
    status: string;
  }[];
}

export interface CustomerSheet {
  member_id: number;
  member_name: string;
  groups: {
    group_id: number;
    group_name: string;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    installments: {
      installment_number: number;
      amount: number;
      date: string;
      status: string;
    }[];
  }[];
}

export const useReportsStore = defineStore('reports', () => {
  const chitLedger = ref<ChitLedger[]>([]);
  const customerSheet = ref<CustomerSheet[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchChitLedger(memberId?: number) {
    try {
      loading.value = true;
      const url = memberId ? `/reports/chit-ledger/${memberId}` : '/reports/chit-ledger';
      const response = await api.get(url);
      chitLedger.value = response.data;
      return response.data;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch chit ledger';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCustomerSheet(memberId?: number) {
    try {
      loading.value = true;
      const url = memberId ? `/reports/customer-sheet/${memberId}` : '/reports/customer-sheet';
      const response = await api.get(url);
      customerSheet.value = response.data;
      return response.data;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch customer sheet';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    chitLedger,
    customerSheet,
    loading,
    error,
    fetchChitLedger,
    fetchCustomerSheet
  };
}); 