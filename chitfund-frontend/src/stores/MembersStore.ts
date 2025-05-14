import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../services/api';

export interface Member {
  id: number;
  name: string;
  // Add other properties as needed
}

export const useMembersStore = defineStore('members', () => {
  const members = ref<Member[]>([]);

  async function fetchMembers() {
    const response = await api.get('/members');
    members.value = response.data;
  }

  async function createMember(member: Member) {
    const response = await api.post('/members', member);
    members.value.push(response.data);
  }

  async function updateMember(id: number, member: Member) {
    const response = await api.put(`/members/${id}`, member);
    const index = members.value.findIndex(m => m.id === id);
    if (index !== -1) {
      members.value[index] = response.data;
    }
  }

  async function deleteMember(id: number) {
    await api.delete(`/members/${id}`);
    members.value = members.value.filter(m => m.id !== id);
  }

  return { members, fetchMembers, createMember, updateMember, deleteMember };
}); 