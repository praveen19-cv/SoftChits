import { defineStore } from 'pinia';
import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

export interface Group {
  id: number;
  name: string;
  total_amount: number;
  member_count: number;
  start_date: string;
  end_date: string;
  status: string;
  number_of_months: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateGroup {
  name: string;
  total_amount: number;
  member_count: number;
  start_date: string;
  end_date: string;
  status: string;
  number_of_months: number;
}

interface ChitDate {
  chit_date: string;
  amount: number;
}

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  chitDates: ChitDate[];
  loading: boolean;
  error: string | null;
}

export const useGroupsStore = defineStore('groups', {
  state: (): GroupState => ({
    groups: [],
    currentGroup: null,
    chitDates: [],
    loading: false,
    error: null
  }),

  actions: {
    async fetchGroups() {
      try {
        this.loading = true;
        const response = await api.get('/api/groups');
        
        if (!response.data) {
          this.error = 'No data received from server';
          this.groups = [];
          return [];
        }

        // The response is already an array, so we can use it directly
        this.groups = response.data;
        return this.groups;
      } catch (error: any) {
        console.error('Error fetching groups:', error);
        this.error = error instanceof Error ? error.message : 'Unknown error';
        this.groups = [];
        return [];
      } finally {
        this.loading = false;
      }
    },

    async createGroup(groupData: CreateGroup) {
      try {
        this.loading = true;
        const response = await api.post('/api/groups', groupData);
        
        if (response.data) {
          // Add the new group to the list
          this.groups.push(response.data);
          return response.data;
        }
        
        throw new Error('No data received from server');
      } catch (error: any) {
        console.error('Error creating group:', error);
        this.error = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateGroup(id: number, groupData: Partial<Group>) {
      try {
        this.loading = true;
        const response = await api.put(`/api/groups/${id}`, groupData);
        
        if (response.data) {
          // Update the group in the list
          const index = this.groups.findIndex(g => g.id === id);
          if (index !== -1) {
            this.groups[index] = { ...this.groups[index], ...response.data };
          }
          return response.data;
        }
        
        throw new Error('No data received from server');
      } catch (error: any) {
        console.error('Error updating group:', error);
        this.error = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteGroup(id: number) {
      try {
        this.loading = true;
        await api.delete(`/api/groups/${id}`);
        
        // Remove the group from the list
        this.groups = this.groups.filter(g => g.id !== id);
      } catch (error: any) {
        console.error('Error deleting group:', error);
        this.error = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchGroupById(id: number) {
      try {
        this.loading = true;
        const response = await api.get(`/api/groups/${id}`);
        
        if (response.data) {
          this.currentGroup = response.data;
          return response.data;
        }
        
        throw new Error('No data received from server');
      } catch (error: any) {
        console.error('Error fetching group:', error);
        this.error = error instanceof Error ? error.message : 'Unknown error';
        this.currentGroup = null;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchChitDates(groupId: number) {
      try {
        this.loading = true;
        console.log('Fetching chit dates for group:', groupId);
        const response = await api.get(`/api/groups/${groupId}/chit-dates`);
        console.log('Chit dates response:', response.data);
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        this.chitDates = response.data;
        return this.chitDates;
      } catch (error: any) {
        console.error('Error fetching chit dates:', error.response?.data || error.message);
        this.error = error.response?.data?.message || error.message;
        this.chitDates = [];
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateChitDates(groupId: number, dates: ChitDate[]) {
      try {
        this.loading = true;
        console.log('Updating chit dates for group:', groupId, 'with data:', dates);
        
        // Ensure dates are in the correct format
        const formattedDates = dates.map(date => ({
          chit_date: date.chit_date,
          amount: Number(date.amount)
        }));
        
        const response = await api.put(`/api/groups/${groupId}/chit-dates`, { 
          dates: formattedDates 
        });
        
        console.log('Update response:', response.data);
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        this.chitDates = response.data;
        return this.chitDates;
      } catch (error: any) {
        console.error('Error updating chit dates:', error.response?.data || error.message);
        this.error = error.response?.data?.message || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
}); 