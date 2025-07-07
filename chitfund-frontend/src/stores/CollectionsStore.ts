import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';
import { useGroupsStore } from './GroupsStore';

export interface AddCollection {
  group_id: number;
  member_id: number;
  installment_number: number;
  collection_amount: number;
  date: string;
  allow_excess?: boolean;
}

export interface ViewCollection {
  id: number;
  collection_date: string;
  group_id: number;
  member_id: number;
  installment_number: number;
  collection_amount: number;
  remaining_balance: number;
  is_completed: number;
  created_at: string;
  updated_remaining_balance: number;
  member_name: string;
  installment: string;
  amount: number;
}

export interface CollectionBalance {
  id: number;
  group_id: number;
  member_id: number;
  installment_number: number;
  total_paid: number;
  remaining_balance: number;
  is_completed: boolean;
  last_updated: string;
  member_name?: string;
}

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref<ViewCollection[]>([]);
  const collectionBalances = ref<CollectionBalance[]>([]);
  const groupsStore = useGroupsStore();
  const loading = ref(false);
  const error = ref('');

  async function getTableName(groupId: number): Promise<string> {
    // First try to get from store
    let group = groupsStore.groups.find(g => g.id === groupId);
    
    // If not in store, try to fetch it
    if (!group) {
      try {
        await groupsStore.fetchGroupById(groupId);
        group = groupsStore.currentGroup ?? undefined;
      } catch (err) {
        console.error('Error fetching group:', err);
        throw new Error('Group not found');
      }
    }

    if (!group) {
      throw new Error('Group not found');
    }

    // Remove any special characters and spaces from group name
    const cleanGroupName = group.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `collection_${groupId}_${cleanGroupName}`;
  }

  async function fetchCollections(groupId: number) {
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      const tableName = await getTableName(groupId);
      const response = await api.get(`/collections/${groupId}`);
      collections.value = response.data;
      return response.data;
    } catch (error: any) {
      console.error('Error fetching collections:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch collections');
    } finally {
      loading.value = false;
    }
  }

  async function getCollectionById(id: number, groupId: number) {
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      const tableName = await getTableName(groupId);
      const response = await api.get(`/collections/${groupId}/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching collection:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch collection');
    } finally {
      loading.value = false;
    }
  }

  async function createCollection(collection: AddCollection) {
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      // Convert the collection data to match backend format
      const collectionData = {
        group_id: collection.group_id,
        member_id: collection.member_id,
        installment_number: collection.installment_number,
        collection_amount: collection.collection_amount,
        collection_date: collection.date,
        allow_excess: collection.allow_excess || false
      };

      // First, ensure the table exists
      await api.post(`/collections/${collection.group_id}/create-table`);
      // Then create the collection
      const response = await api.post(`/collections`, collectionData);
      if (response.data) {
        collections.value.push(response.data);
      }
      return response.data;
    } catch (error: any) {
      console.error('Error creating collection:', error.response?.data || error);
      if (error.response?.status === 500) {
        throw new Error('Failed to create collection table. Please try again.');
      }
      throw new Error(error.response?.data?.error || 'Failed to create collection');
    } finally {
      loading.value = false;
    }
  }

  async function updateCollection(id: number, collection: Partial<ViewCollection>) {
    if (!collection.group_id) {
      throw new Error('Group ID is required for update');
    }
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      const tableName = await getTableName(collection.group_id);
      const response = await api.put(`/collections/${id}`, {
        ...collection,
        collection_amount: collection.collection_amount // Map collection_amount for backend
      });
      const index = collections.value.findIndex(c => c.id === id);
      if (index !== -1) {
        collections.value[index] = response.data;
      }
      return response.data;
    } catch (error: any) {
      console.error('Error updating collection:', error);
      throw new Error(error.response?.data?.error || 'Failed to update collection');
    } finally {
      loading.value = false;
    }
  }

  async function deleteCollection(id: number, groupId: number) {
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      const tableName = await getTableName(groupId);
      await api.delete(`/collections/${id}?group_id=${groupId}`);
      collections.value = collections.value.filter(c => c.id !== id);
    } catch (error: any) {
      console.error('Error deleting collection:', error);
      throw new Error(error.response?.data?.error || 'Failed to delete collection');
    } finally {
      loading.value = false;
    }
  }

  async function fetchCollectionsByDateAndGroup(date: string, groupId: number) {
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }
      const response = await api.get(`/collections/by-date-group/${groupId}/${date}`);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch collections';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCollectionsByGroup(groupId: number): Promise<ViewCollection[]> {
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      const tableName = await getTableName(groupId);
      const response = await api.get(`/collections/${groupId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching collections by group:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCollectionBalances(groupId: number) {
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      const tableName = await getTableName(groupId);
      const response = await api.get(`/collections/${groupId}/balances`);
      collectionBalances.value = response.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch collection balances';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchIncompleteCollectionBalances(groupId: number) {
    try {
      loading.value = true;
      error.value = '';
      
      // First ensure we have the group data
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      const response = await api.get(`/collection-balance/${groupId}/incomplete`);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch incomplete collection balances';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Export next month payout API call (creates installments and sets is_exported=1)
  async function exportNextMonthPayout(groupId: number, month: number, monthlySubscription: number) {
    try {
      loading.value = true;
      error.value = '';
      const response = await api.post(`/collections/group/${groupId}/export-month/${month}`, {
        monthly_subscription: monthlySubscription
      });
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to export month payout';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Reset next month payout API call (removes installments and sets is_exported=0)
  async function resetNextMonthPayout(groupId: number, month: number) {
    try {
      loading.value = true;
      error.value = '';
      const response = await api.post(`/collections/group/${groupId}/reset-next-month`, {
        month: month
      });
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to reset month payout';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Get next month export status
  async function getNextMonthStatus(groupId: number, month: number): Promise<boolean> {
    try {
      const response = await api.get(`/collections/group/${groupId}/next-month-status/${month}`);
      return response.data.is_exported === 1;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to get next month status';
      throw err;
    }
  }

  // Export month payout (alias for exportNextMonthPayout for compatibility)
  async function exportMonthPayout(groupId: number, month: number, monthlySubscription: number) {
    return exportNextMonthPayout(groupId, month, monthlySubscription);
  }

  // Set is_exported for a monthly subscription (backend API call)
  async function setMonthlySubscriptionExportStatus(groupId: number, month: number, isExported: boolean) {
    try {
      loading.value = true;
      error.value = '';
      await api.put(`/collections/${groupId}/monthly-subscription/${month}/export`, { is_exported: isExported });
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to update export status';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCollectionsByCustomerAndDateRange(
    customer: string,
    groupId: number,
    fromDate: string,
    toDate: string
  ) {
    try {
      loading.value = true;
      error.value = '';

      // Ensure group data is loaded
      if (!groupsStore.groups.length) {
        await groupsStore.fetchGroups();
      }

      const response = await api.get(
        `/collections/${groupId}/customer-sheet`,
        {
          params: { customer, fromDate, toDate },
        }
      );

      // Return the array directly
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch collections';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCollectionsByTableNameAndDate(tableName: string, date: string): Promise<ViewCollection[]> {
    try {
      loading.value = true;
      error.value = '';
      const response = await api.get(`/collections/by-table-date/${tableName}/${date}`);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch collections';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Update the API endpoint to use /api/collection-balance instead of /api/collections
  async function fetchPendingInstallmentsForCustomer(customerId: number, groupId: number) {
    try {
      const response = await api.get(`/collection-balance/${groupId}/pending-balance`, {
        params: { customerId }
      })
      return response.data // Should be an array of pending installments
    } catch (error) {
      throw error
    }
  }

  async function fetchCollectionBalancesForCustomer(customerId: number, groupId: number): Promise<CollectionBalance[]> {
    loading.value = true;
    try {
      const tableName = await getTableName(groupId)
      const response = await api.get(`/api/collection-balance/${tableName}/customer/${customerId}`)
      return response.data // Array of collection balances for the customer
    } catch (error) {
      console.error('Error fetching collection balances for customer:', error);
      throw error
    } finally {
      loading.value = false;
    }
  }

  // Collection adjustment methods (for future backend implementation)
  async function performCollectionAdjustment(adjustment: {
    customerId: number;
    fromGroupId: number;
    fromInstallmentNumber: number;
    toGroupId: number;
    toInstallmentNumber: number;
    amount: number;
  }) {
    loading.value = true;
    try {
      // This will be implemented when backend API is ready
      // For now, throw an error to indicate it's not implemented
      throw new Error('Collection adjustment API not yet implemented in backend');
      
      // const response = await api.post('/api/collections/adjust', adjustment);
      // return response.data;
    } catch (error) {
      console.error('Error performing collection adjustment:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function getAdjustmentHistory(customerId: number, groupIds?: number[]) {
    loading.value = true;
    try {
      const params = new URLSearchParams();
      params.append('customerId', customerId.toString());
      if (groupIds && groupIds.length > 0) {
        groupIds.forEach(id => params.append('groupIds', id.toString()));
      }
      
      // This will be implemented when backend API is ready
      throw new Error('Adjustment history API not yet implemented in backend');
      
      // const response = await api.get(`/api/collections/adjustments?${params.toString()}`);
      // return response.data;
    } catch (error) {
      console.error('Error fetching adjustment history:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  return {
    collections,
    collectionBalances,
    loading,
    error,
    fetchCollectionsByDateAndGroup,
    fetchCollections,
    getCollectionById,
    createCollection,
    updateCollection,
    deleteCollection,
    fetchCollectionsByGroup,
    fetchCollectionBalances,
    fetchCollectionBalancesForCustomer,
    fetchIncompleteCollectionBalances,
    exportNextMonthPayout,
    resetNextMonthPayout,
    getNextMonthStatus,
    exportMonthPayout,
    fetchCollectionsByCustomerAndDateRange,
    fetchCollectionsByTableNameAndDate,
    fetchPendingInstallmentsForCustomer,
    setMonthlySubscriptionExportStatus,
    performCollectionAdjustment,
    getAdjustmentHistory
  };
});