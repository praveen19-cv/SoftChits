import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';

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

  async function getGroupById(id: number) {
    const response = await api.get(`/groups/${id}`);
    return response.data;
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

  async function getGroupMembers(groupId: number) {
    const response = await api.get(`/groups/${groupId}/members`);
    return response.data;
  }

  async function addGroupMember(groupId: number, memberId: number, groupMemberId: string) {
    const response = await api.post(`/groups/${groupId}/members`, {
      memberId,
      groupMemberId
    });
    return response.data;
  }

  async function removeGroupMember(groupId: number, memberId: number) {
    const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
    return response.data;
  }

  async function updateGroupMembers(groupId: number, members: Array<{ id: number, groupMemberId: string }>) {
    const response = await api.put(`/groups/${groupId}/members`, { members });
    return response.data;
  }

  return { groups, fetchGroups, getGroupById, createGroup, updateGroup, deleteGroup, getGroupMembers, addGroupMember, removeGroupMember, updateGroupMembers };
}); 