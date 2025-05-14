import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../services/api';

export interface Collection {
  id: number;
  name: string;
  // Add other properties as needed
}

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref<Collection[]>([]);

  async function fetchCollections() {
    const response = await api.get('/collections');
    collections.value = response.data;
  }

  async function createCollection(collection: Collection) {
    const response = await api.post('/collections', collection);
    collections.value.push(response.data);
  }

  async function updateCollection(id: number, collection: Collection) {
    const response = await api.put(`/collections/${id}`, collection);
    const index = collections.value.findIndex(c => c.id === id);
    if (index !== -1) {
      collections.value[index] = response.data;
    }
  }

  async function deleteCollection(id: number) {
    await api.delete(`/collections/${id}`);
    collections.value = collections.value.filter(c => c.id !== id);
  }

  return { collections, fetchCollections, createCollection, updateCollection, deleteCollection };
}); 