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

interface MonthlySubscription {
  month_number: number;
  bid_amount: number;
  total_dividend: number;
  distributed_dividend: number;
  monthly_subscription: number;
}

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  chitDates: ChitDate[];
  monthlySubscriptions: MonthlySubscription[];
  loading: boolean;
  error: string | null;
}

export const useGroupsStore = defineStore('groups', {
  state: (): GroupState => ({
    groups: [],
    currentGroup: null,
    chitDates: [],
    monthlySubscriptions: [],
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
        const response = await api.get(`/api/groups/${groupId}/chit-dates`);
        
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
        
        // Format dates to match backend expectations
        const formattedDates = dates.map(date => ({
          chit_date: date.chit_date,
          minimum_amount: Number(date.amount) || 0,
          group_id: groupId
        }));
        
        const response = await api.put(`/api/groups/${groupId}/chit-dates`, { 
          chit_dates: formattedDates
        });
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        this.chitDates = response.data;
        return this.chitDates;
      } catch (error: any) {
        console.error('Error updating chit dates:', error);
        this.error = error.response?.data?.message || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async addMemberToGroup(groupId: number, memberId: number) {
      try {
        this.loading = true;
        const currentMemberCount = this.currentGroup?.member_count ?? 0;
        const response = await api.post(`/api/groups/${groupId}/members`, {
          member_id: memberId,
          group_member_id: currentMemberCount + 1
        });

        if (!response.data) {
          throw new Error('No data received from server');
        }

        // Update the current group's member count
        if (this.currentGroup) {
          this.currentGroup.member_count += 1;
        }

        return response.data;
      } catch (error: any) {
        console.error('Error adding member to group:', error);
        this.error = error.response?.data?.message || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getGroupById(id: number) {
      try {
        this.loading = true;
        const response = await api.get(`/api/groups/${id}`);
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        this.currentGroup = response.data;
        return response.data;
      } catch (error: any) {
        console.error('Error fetching group:', error);
        this.error = error.response?.data?.message || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async getGroupMembers(groupId: number) {
      try {
        this.loading = true;
        const response = await api.get(`/api/groups/${groupId}/members`);
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
    return response.data;
      } catch (error: any) {
        console.error('Error fetching group members:', error);
        this.error = error.response?.data?.message || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateGroupMembers(groupId: number, members: Array<{ id: number, groupMemberId: string }>) {
      try {
        this.loading = true;
        const response = await api.put(`/api/groups/${groupId}/members`, { members });
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        return response.data;
      } catch (error: any) {
        console.error('Error updating group members:', error);
        this.error = error.response?.data?.message || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateGroupCommission(groupId: number, commissionPercentage: number) {
      try {
        this.loading = true;
        const response = await api.put(`/api/groups/${groupId}/commission`, {
          commission_percentage: Number(commissionPercentage.toFixed(2))
        });
        
        if (!response.data) {
          throw new Error('No data received from server');
        }

        // Update the current group if it's the one being modified
        if (this.currentGroup?.id === groupId) {
          this.currentGroup = { ...this.currentGroup, ...response.data };
        }
        
        return response.data;
      } catch (error: any) {
        console.error('Error updating group commission:', error);
        this.error = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchMonthlySubscriptions(groupId: number) {
      try {
        this.loading = true;
        const response = await api.get(`/api/groups/${groupId}/monthly-subscriptions`);
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        this.monthlySubscriptions = response.data;
        return this.monthlySubscriptions;
      } catch (error: any) {
        console.error('Error fetching monthly subscriptions:', error);
        this.error = error.response?.data?.message || error.message;
        this.monthlySubscriptions = [];
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateMonthlySubscriptions(groupId: number, subscriptions: MonthlySubscription[]) {
      try {
        this.loading = true;
        const response = await api.put(`/api/groups/${groupId}/monthly-subscriptions`, {
          subscriptions
        });
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        this.monthlySubscriptions = response.data;
        return this.monthlySubscriptions;
      } catch (error: any) {
        console.error('Error updating monthly subscriptions:', error);
        this.error = error.response?.data?.message || error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
}); 