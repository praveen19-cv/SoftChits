import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Member API functions
export async function getAllMembers() {
  const response = await api.get('/members');
  return response.data;
}

export async function getMemberById(id: number) {
  const response = await api.get(`/members/${id}`);
  return response.data;
}

export async function createMember(member: any) {
  const response = await api.post('/members', member);
  return response.data;
}

export async function updateMember(id: number, member: any) {
  const response = await api.put(`/members/${id}`, member);
  return response.data;
}

export async function deleteMember(id: number) {
  const response = await api.delete(`/members/${id}`);
  return response.data;
}

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

export default api; 