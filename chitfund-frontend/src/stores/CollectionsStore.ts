import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';
import { useGroupsStore } from './GroupsStore';

export interface Collection {
  id?: number;
  date: string;
  group_id: number;
  member_id: number;
  installment_string: string;
  amount: number;
}

export interface ExistingCollection {
  id: number;
  collection_date: string;
  group_id: number;
  member_id: number;
  installment_number: number;
  collection_amount: number;
  remaining_balance: number;
  is_completed: number;
  created_at: string;
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
  const collections = ref<Collection[]>([]);
  const collectionBalances = ref<CollectionBalance[]>([]);
  const groupsStore = useGroupsStore();
  const loading = ref(false);
  const error = ref('');

  async function getTableName(groupId: number): Promise<string> {
    const group = groupsStore.groups.find(g => g.id === groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    // Remove any special characters and spaces from group name
    const cleanGroupName = group.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `collection_${groupId}_${cleanGroupName}`;
  }

  async function fetchCollections() {
    const response = await api.get('/collections');
    collections.value = response.data;
  }

  async function getCollectionById(id: number) {
    const response = await api.get(`/collections/${id}`);
    return response.data;
  }

  async function createCollection(collection: Omit<Collection, 'id'>) {
    try {
      const tableName = await getTableName(collection.group_id);
      // First, ensure the table exists
      await api.post(`/collections/${tableName}/create-table`);
      // Then create the collection
      const response = await api.post(`/collections/${tableName}`, collection);
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
    }
  }

  async function updateCollection(id: number, collection: Partial<Collection>) {
    if (!collection.group_id) {
      throw new Error('Group ID is required for update');
    }
    const tableName = await getTableName(collection.group_id);
    const response = await api.put(`/collections/${tableName}/${id}`, {
      collection
    });
    const index = collections.value.findIndex(c => c.id === id);
    if (index !== -1) {
      collections.value[index] = response.data;
    }
  }

  async function deleteCollection(id: number, groupId: number) {
    const tableName = await getTableName(groupId);
    await api.delete(`/collections/${tableName}/${id}`);
    collections.value = collections.value.filter(c => c.id !== id);
  }

  async function fetchCollectionsByDateAndGroup(date: string, groupId: number) {
    try {
      loading.value = true;
      error.value = '';
      const tableName = await getTableName(groupId);
      const response = await api.get(`/collections/${tableName}/by-date?date=${date}`);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch collections';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCollectionsByGroup(groupId: number): Promise<ExistingCollection[]> {
    try {
      const response = await api.get(`/collections/collection_${groupId}_${getTableName(groupId)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching collections by group:', error);
      throw error;
    }
  }

  async function fetchCollectionBalances(groupId: number) {
    try {
      loading.value = true;
      error.value = '';
      const response = await api.get(`/collections/balances/${groupId}`);
      collectionBalances.value = response.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch collection balances';
      throw err;
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
    fetchCollectionBalances
  };
}); 