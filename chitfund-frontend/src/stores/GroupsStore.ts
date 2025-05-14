import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../services/api';

export interface Group {
  id: number;
  name: string;
  // Add other properties as needed
}

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([]);

  async function fetchGroups() {
    const response = await api.get('/groups');
    groups.value = response.data;
  }

  async function createGroup(group: Group) {
    const response = await api.post('/groups', group);
    groups.value.push(response.data);
  }

  async function updateGroup(id: number, group: Group) {
    const response = await api.put(`/groups/${id}`, group);
    const index = groups.value.findIndex(g => g.id === id);
    if (index !== -1) {
      groups.value[index] = response.data;
    }
  }

  async function deleteGroup(id: number) {
    await api.delete(`/groups/${id}`);
    groups.value = groups.value.filter(g => g.id !== id);
  }

  return { groups, fetchGroups, createGroup, updateGroup, deleteGroup };
}); 