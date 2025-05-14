import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';
import type { AxiosResponse } from 'axios';

export interface Member {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: string;
}

const useMembersStore = defineStore('members', () => {
  const members = ref<Member[]>([]);

  async function fetchMembers(): Promise<Member[]> {
    const response: AxiosResponse<Member[]> = await api.get('/members');
    members.value = response.data;
    return response.data;
  }

  async function getMemberById(id: number): Promise<Member> {
    const response: AxiosResponse<Member> = await api.get(`/members/${id}`);
    return response.data;
  }

  async function createMember(member: Omit<Member, 'id'>): Promise<Member> {
    const response: AxiosResponse<Member> = await api.post('/members', member);
    members.value.push(response.data);
    return response.data;
  }

  async function updateMember(id: number, member: Partial<Member>): Promise<Member> {
    const response: AxiosResponse<Member> = await api.put(`/members/${id}`, member);
    const index = members.value.findIndex(m => m.id === id);
    if (index !== -1) {
      members.value[index] = response.data;
    }
    return response.data;
  }

  async function deleteMember(id: number): Promise<void> {
    await api.delete(`/members/${id}`);
    members.value = members.value.filter(m => m.id !== id);
  }

  return { members, fetchMembers, getMemberById, createMember, updateMember, deleteMember };
});

export { useMembersStore }; 