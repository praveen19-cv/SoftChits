import { api } from './api';

// Collection API functions
export async function getAllCollections() {
  const response = await api.get('/collections');
  return response.data;
}

export async function getCollectionById(id: number) {
  const response = await api.get(`/collections/${id}`);
  return response.data;
}

export async function createCollection(collection: any) {
  const response = await api.post('/collections', collection);
  return response.data;
}

export async function updateCollection(id: number, collection: any) {
  const response = await api.put(`/collections/${id}`, collection);
  return response.data;
}

export async function deleteCollection(id: number) {
  const response = await api.delete(`/collections/${id}`);
  return response.data;
} 