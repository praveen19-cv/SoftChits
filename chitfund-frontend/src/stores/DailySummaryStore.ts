import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';
import { useGroupsStore } from './GroupsStore';

export interface DailyCollectionSummary {
  id: number;
  collection_date: string;
  group_id: number;
  total_amount: number;
  total_members_paid: number;
  collection_agent_id: number;
  created_at: string;
  updated_at: string;
}

export interface DailySummaryAnalytics {
  total_collections: number;
  average_daily_amount: number;
  peak_collection_day: string;
  peak_collection_amount: number;
  low_collection_day: string;
  low_collection_amount: number;
  total_unique_collection_days: number;
}

export const useDailySummaryStore = defineStore('dailySummary', () => {
  const summaries = ref<DailyCollectionSummary[]>([]);
  const currentSummary = ref<DailyCollectionSummary | null>(null);
  const analytics = ref<DailySummaryAnalytics | null>(null);
  const groupsStore = useGroupsStore();
  const loading = ref(false);
  const error = ref('');

  // Get daily summaries for a group
  async function fetchDailySummaries(groupId: number, startDate?: string, endDate?: string): Promise<DailyCollectionSummary[]> {
    try {
      loading.value = true;
      error.value = '';
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/daily-summary/${groupId}${query}`);
      
      summaries.value = response.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch daily summaries';
      console.error('Error fetching daily summaries:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Get specific daily summary
  async function fetchDailySummary(groupId: number, collectionDate: string): Promise<DailyCollectionSummary | null> {
    try {
      loading.value = true;
      error.value = '';
      
      const response = await api.get(`/daily-summary/${groupId}/${collectionDate}`);
      
      currentSummary.value = response.data;
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        currentSummary.value = null;
        return null;
      }
      error.value = err.response?.data?.error || 'Failed to fetch daily summary';
      console.error('Error fetching daily summary:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Update daily summary for a specific date
  async function updateDailySummary(groupId: number, collectionDate: string): Promise<DailyCollectionSummary> {
    try {
      loading.value = true;
      error.value = '';
      
      const response = await api.post(`/daily-summary/${groupId}/update`, {
        collection_date: collectionDate
      });
      
      // Update the summary in the list if it exists
      const index = summaries.value.findIndex(s => 
        s.group_id === groupId && s.collection_date === collectionDate
      );
      
      if (index !== -1) {
        summaries.value[index] = response.data.summary;
      } else {
        summaries.value.unshift(response.data.summary);
      }
      
      if (currentSummary.value?.group_id === groupId && 
          currentSummary.value?.collection_date === collectionDate) {
        currentSummary.value = response.data.summary;
      }
      
      return response.data.summary;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update daily summary';
      console.error('Error updating daily summary:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Rebuild all summaries for a group
  async function rebuildSummaries(groupId: number): Promise<{ rebuilt: number; message: string }> {
    try {
      loading.value = true;
      error.value = '';
      
      const response = await api.post(`/daily-summary/${groupId}/rebuild`);
      
      // Refresh summaries after rebuild
      await fetchDailySummaries(groupId);
      
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to rebuild summaries';
      console.error('Error rebuilding summaries:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Delete daily summary
  async function deleteDailySummary(groupId: number, collectionDate: string): Promise<void> {
    try {
      loading.value = true;
      error.value = '';
      
      await api.delete(`/daily-summary/${groupId}/${collectionDate}`);
      
      // Remove from the list
      summaries.value = summaries.value.filter(s => 
        !(s.group_id === groupId && s.collection_date === collectionDate)
      );
      
      // Clear current summary if it matches
      if (currentSummary.value?.group_id === groupId && 
          currentSummary.value?.collection_date === collectionDate) {
        currentSummary.value = null;
      }
      
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to delete daily summary';
      console.error('Error deleting daily summary:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Get analytics for a group
  async function fetchAnalytics(groupId: number, startDate?: string, endDate?: string): Promise<DailySummaryAnalytics> {
    try {
      loading.value = true;
      error.value = '';
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/daily-summary/${groupId}/analytics${query}`);
      
      analytics.value = response.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch analytics';
      console.error('Error fetching analytics:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Clear store state
  function clearState() {
    summaries.value = [];
    currentSummary.value = null;
    analytics.value = null;
    error.value = '';
  }

  // Computed getters
  function getSummariesByDateRange(startDate: string, endDate: string): DailyCollectionSummary[] {
    return summaries.value.filter(summary => 
      summary.collection_date >= startDate && summary.collection_date <= endDate
    );
  }

  function getTotalAmount(): number {
    return summaries.value.reduce((total, summary) => total + summary.total_amount, 0);
  }

  function getAverageAmount(): number {
    if (summaries.value.length === 0) return 0;
    return getTotalAmount() / summaries.value.length;
  }

  function getTotalCollectionDays(): number {
    return summaries.value.length;
  }

  return {
    // State
    summaries,
    currentSummary,
    analytics,
    loading,
    error,

    // Actions
    fetchDailySummaries,
    fetchDailySummary,
    updateDailySummary,
    rebuildSummaries,
    deleteDailySummary,
    fetchAnalytics,
    clearState,

    // Getters
    getSummariesByDateRange,
    getTotalAmount,
    getAverageAmount,
    getTotalCollectionDays
  };
});
