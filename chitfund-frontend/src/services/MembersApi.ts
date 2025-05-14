import { api } from './api';

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