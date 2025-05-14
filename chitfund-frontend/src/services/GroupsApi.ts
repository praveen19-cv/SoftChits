import { api } from './api';

// Group API functions
export async function getAllGroups() {
  const response = await api.get('/groups');
  return response.data;
}

export async function getGroupById(id: number) {
  const response = await api.get(`/groups/${id}`);
  return response.data;
}

export async function createGroup(group: any) {
  const response = await api.post('/groups', group);
  return response.data;
}

export async function updateGroup(id: number, group: any) {
  const response = await api.put(`/groups/${id}`, group);
  return response.data;
}

export async function deleteGroup(id: number) {
  const response = await api.delete(`/groups/${id}`);
  return response.data;
} 