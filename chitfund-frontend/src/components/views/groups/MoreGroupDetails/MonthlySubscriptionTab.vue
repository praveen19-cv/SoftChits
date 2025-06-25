<!--
BUSINESS LOGIC SUMMARY:
This component manages monthly subscription calculations and export operations for chit fund groups.

KEY FEATURES:
1. Commission Management: Allows setting commission percentage (4% default) with automatic recalculation
2. Monthly Subscription Calculation: 
   - Month 1: Base subscription amount only (no bid/dividend)
   - Months 2-N: Base subscription minus distributed dividend based on bid amount
3. Export Operations: Exports monthly payouts to member installments in collection_balance table
4. Data Persistence: All calculations saved to monthly_subscription table with export status tracking
5. State Synchronization: Ensures UI and backend data consistency through proper save/load cycles

CALCULATION LOGIC:
- Base Subscription = Total Amount ÷ Member Count
- Commission Amount = Total Amount × Commission Percentage
- Total Dividend = Bid Amount - Commission Amount  
- Distributed Dividend = Total Dividend ÷ Member Count
- Monthly Subscription = Base Subscription - Distributed Dividend

EXPORT WORKFLOW:
1. Save current month data
2. Export creates installment records for all group members
3. Mark month as exported in monthly_subscription table
4. Update UI state and sync with backend
5. Prevent further modifications to exported months
-->

<script lang="ts" setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import StandardNotification from '@/components/standards/StandardNotification.vue'

const props = defineProps<{
  groupId: number
}>()

const store = useGroupsStore()
const collectionsStore = useCollectionsStore()
const loading = ref(false)
const commissionPercentage = ref(4)
const notification = ref({
  show: false,
  message: '',
  type: 'success'
})

interface MonthData {
  date: string
  bidAmount: number
  totalDividend: number
  distributedDividend: number
  monthlySubscription: number
  isExported?: boolean
}

const months = ref<MonthData[]>([])
const groupDetails = computed(() => store.currentGroup)

// Parse is_exported value from database (can be boolean, number, or string)
const parseExportedStatus = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return false;
};

const commissionAmount = computed(() => {
  if (!groupDetails.value) return 0
  return (groupDetails.value.total_amount * commissionPercentage.value) / 100
})

const calculateCommissionAmount = () => {
  months.value.forEach((_, index) => {
    if (index > 0) {
      calculateMonthValues(index)
    }
  })
}

const calculateMonthValues = (index: number) => {
  const month = months.value[index]
  if (!month || !groupDetails.value) return

  month.totalDividend = month.bidAmount - commissionAmount.value
  month.distributedDividend = month.totalDividend / (groupDetails.value.member_count || 1)

  const baseSubscription = groupDetails.value.total_amount / (groupDetails.value.member_count || 1)
  month.monthlySubscription = baseSubscription - month.distributedDividend
}

const updateFirstMonthSubscription = () => {
  if (!groupDetails.value) return
  const baseSubscription = groupDetails.value.total_amount / (groupDetails.value.member_count || 1)
  months.value[0].monthlySubscription = baseSubscription
}

const saveCommission = async () => {
  try {
    loading.value = true
    // Convert to number and handle both integer and decimal values
    const commissionValue = Number(commissionPercentage.value)
    
    // Update the commission in the groups table
    await store.updateGroupCommission(props.groupId, commissionValue)
    
    // Recalculate all month values with the new commission
    months.value.forEach((_, index) => {
      if (index > 0) { // Skip month 0 as it's not used for calculations
        calculateMonthValues(index)
      }
    })
    
    // Save the recalculated values to the monthly_subscription table
    // Create subscriptions array with updated data, preserving export status
    const subscriptions = months.value.map((month, index) => ({
      month_number: index + 1,
      bid_amount: month.bidAmount,      total_dividend: month.totalDividend,
      distributed_dividend: month.distributedDividend,
      monthly_subscription: month.monthlySubscription,
      is_exported: month.isExported ? 1 : 0
    }))
    
    await store.updateMonthlySubscriptions(props.groupId, subscriptions)
      await store.fetchMonthlySubscriptions(props.groupId)
    const updatedSubscriptions = store.monthlySubscriptions as any[];
    for (let i = 0; i < months.value.length; i++) {
      const subscription = updatedSubscriptions.find((s: any) => s.month_number === i + 1);
      if (subscription) {
        months.value[i].isExported = parseExportedStatus(subscription.is_exported);
      }
    }
    
    showNotification('Commission and monthly subscriptions updated successfully')
  } catch (error: any) {
    showNotification(error.message || 'Failed to update commission', 'error')
  } finally {
    loading.value = false
  }
}

const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
  notification.value = {
    show: true,
    message,
    type
  }
}

const loadData = async () => {
  try {
    await store.fetchGroupById(props.groupId);
    await store.fetchChitDates(props.groupId);
    await store.fetchMonthlySubscriptions(props.groupId);

    commissionPercentage.value = store.currentGroup?.commission_percentage ?? 4;
    const isAnyGroupExported = (store.monthlySubscriptions as { is_exported?: boolean | number | string }[]).some(subscription => parseExportedStatus(subscription.is_exported));
    if (isAnyGroupExported) {
      commissionPercentage.value = store.currentGroup?.commission_percentage || 4;
    }

    const numberOfMonths = (store.currentGroup?.number_of_months || 0) + 1;
    const chitDates = store.chitDates.slice(0, -1);
    const startDate = new Date(store.currentGroup?.start_date || '');

    if (!store.currentGroup) {
      throw new Error('Group details not found');
    }

    type MonthlySubscription = {
      month_number: number;
      bid_amount: number;
      total_dividend: number;
      distributed_dividend: number;
      monthly_subscription: number;
      is_exported?: boolean | number | string;
    };

    let subscriptions = store.monthlySubscriptions as MonthlySubscription[];
    
    if (!subscriptions.length || subscriptions.length !== numberOfMonths) {
      const baseSubscription = store.currentGroup.total_amount / store.currentGroup.member_count;

      if (!subscriptions.length) {
        subscriptions = Array(numberOfMonths).fill(null).map((_, index) => {
          if (index === 0) {
            return {
              month_number: index + 1,
              bid_amount: 0,
              total_dividend: 0,
              distributed_dividend: 0,
              monthly_subscription: baseSubscription,
              is_exported: false as boolean
            };
          } else {
            return {
              month_number: index + 1,
              bid_amount: 0,
              total_dividend: 0,
              distributed_dividend: 0,
              monthly_subscription: baseSubscription,
              is_exported: false as boolean
            };
          }
        });

        try {
          const subscriptionsToSave = subscriptions.map(sub => ({
            month_number: sub.month_number,
            bid_amount: sub.bid_amount,
            total_dividend: sub.total_dividend,
            distributed_dividend: sub.distributed_dividend,
            monthly_subscription: sub.monthly_subscription,
            is_exported: parseExportedStatus(sub.is_exported) ? 1 : 0
          }));
          await store.updateMonthlySubscriptions(props.groupId, subscriptionsToSave);
          await store.fetchMonthlySubscriptions(props.groupId);
          subscriptions = store.monthlySubscriptions;
        } catch (error) {
          showNotification('Failed to save subscriptions. Please try again.', 'error');
          return;
        }
      }
    }

    if (subscriptions.length !== numberOfMonths) {
      if (subscriptions.length < numberOfMonths) {
        const baseSubscription = store.currentGroup.total_amount / store.currentGroup.member_count;

        for (let i = subscriptions.length; i < numberOfMonths; i++) {
          if (i === 0) {
            subscriptions.push({
              month_number: i + 1,
              bid_amount: 0,
              total_dividend: 0,
              distributed_dividend: 0,
              monthly_subscription: baseSubscription
            });
          } else {
            subscriptions.push({
              month_number: i + 1,
              bid_amount: 0,
              total_dividend: 0,
              distributed_dividend: 0,
              monthly_subscription: baseSubscription
            });
          }
        }

        try {
          const subscriptionsToSave = subscriptions.map(sub => ({
            month_number: sub.month_number,
            bid_amount: sub.bid_amount,
            total_dividend: sub.total_dividend,
            distributed_dividend: sub.distributed_dividend,
            monthly_subscription: sub.monthly_subscription,
            is_exported: parseExportedStatus(sub.is_exported) ? 1 : 0
          }));
          await store.updateMonthlySubscriptions(props.groupId, subscriptionsToSave);
          await store.fetchMonthlySubscriptions(props.groupId);
          subscriptions = store.monthlySubscriptions;
        } catch (error) {
          showNotification('Failed to save missing months. Please try again.', 'error');
          return;
        }
      }
    }

    months.value = Array(numberOfMonths - 1).fill(null).map((_, index) => {
      const subscription = subscriptions.find(s => s.month_number === index + 1);
      let date = '';

      if (index === 0) {
        const month1Date = new Date(startDate);
        month1Date.setMonth(month1Date.getMonth() - 1);
        date = month1Date.toISOString().slice(0, 10);
      } else {
        const chitDateIndex = index - 1;
        const chitDate = chitDates[chitDateIndex];
        date = chitDate?.chit_date || '';
      }

      const isExported = parseExportedStatus(subscription?.is_exported);
      
      return {
        date: date,
        bidAmount: subscription?.bid_amount || 0,
        totalDividend: subscription?.total_dividend || 0,
        distributedDividend: subscription?.distributed_dividend || 0,
        monthlySubscription: subscription?.monthly_subscription || 0,
        isExported: isExported
      };
    });
  } catch (error: any) {
    showNotification(error.message || 'Failed to load data', 'error');
  }
};

const checkExportStatus = async (month: number) => {
  try {
    const apiExportStatus = await collectionsStore.getNextMonthStatus(props.groupId, month);
    
    if (month < 1 || month > months.value.length) {
      return false;
    }
    
    if (months.value[month - 1]) {
      const currentDbStatus = months.value[month - 1].isExported;
      
      if (currentDbStatus !== apiExportStatus) {
        months.value[month - 1].isExported = apiExportStatus;
      }
      
      return apiExportStatus;
    } else {
      return false;
    }
  } catch (error) {
    return months.value[month - 1]?.isExported || false;
  }
}

const setMonthExportStatus = async (month: number, isExported: boolean) => {
  try {
    loading.value = true;
    await collectionsStore.setMonthlySubscriptionExportStatus(props.groupId, month, isExported);
    months.value[month - 1].isExported = isExported;
    showNotification(isExported ? 'Month marked as exported.' : 'Month export reset.');
  } catch (error: any) {
    showNotification(error.message || 'Failed to update export status', 'error');  } finally {
    loading.value = false;
  }
}

const saveMonthData = async (monthIndex: number) => {
  try {
    loading.value = true
    const month = months.value[monthIndex]

    // Create all subscriptions array to preserve existing data AND export status
    const allSubscriptions = months.value.map((m, i) => ({
      month_number: i + 1,
      bid_amount: m.bidAmount,
      total_dividend: m.totalDividend,      distributed_dividend: m.distributedDividend,
      monthly_subscription: m.monthlySubscription,
      is_exported: m.isExported ? 1 : 0
    }))

    await store.updateMonthlySubscriptions(props.groupId, allSubscriptions)
    await store.fetchMonthlySubscriptions(props.groupId);// Update the local state with the fresh data from backend
    const updatedSubscriptions = store.monthlySubscriptions as any[];
    for (let i = 0; i < months.value.length; i++) {
      const subscription = updatedSubscriptions.find((s: any) => s.month_number === i + 1);
      if (subscription) {
        months.value[i].isExported = parseExportedStatus(subscription.is_exported);
      }
    }
    
    showNotification(`Month ${monthIndex + 1} data saved successfully`)
  } catch (error: any) {
    showNotification(error.message || `Failed to save month ${monthIndex + 1} data`, 'error')
  } finally {
    loading.value = false
  }
}

const saveMonthlyData = async () => {
  try {
    loading.value = true
    const subscriptions = months.value.map((month, index) => ({
      month_number: index + 1,
      bid_amount: month.bidAmount,
      total_dividend: month.totalDividend,
      distributed_dividend: month.distributedDividend,
      monthly_subscription: month.monthlySubscription,
      is_exported: month.isExported ? 1 : 0 // Preserve export status
    }))
      await store.updateMonthlySubscriptions(props.groupId, subscriptions)
    await store.fetchMonthlySubscriptions(props.groupId);

    const updatedSubscriptions = store.monthlySubscriptions as any[];
    for (let i = 0; i < months.value.length; i++) {
      const subscription = updatedSubscriptions.find((s: any) => s.month_number === i + 1);
      if (subscription) {
        months.value[i].isExported = parseExportedStatus(subscription.is_exported);
      }
    }
    
    showNotification('Monthly data saved successfully')
  } catch (error: any) {
    showNotification(error.message || 'Failed to save monthly data', 'error')
  } finally {
    loading.value = false
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');
}

const exportMonthPayout = async (monthNumber: number) => {
  try {
    loading.value = true;
    
    // STEP 1: Save current month data first to ensure the current month is saved before export
    await saveMonthData(monthNumber - 1); // monthIndex is 0-based, monthNumber is 1-based
    
    // STEP 2: Save all monthly data to ensure everything is up to date, preserving export status
    const subscriptions = months.value.map((month, index) => ({
      month_number: index + 1,
      bid_amount: month.bidAmount,
      total_dividend: month.totalDividend,
      distributed_dividend: month.distributedDividend,
      monthly_subscription: month.monthlySubscription,
      is_exported: month.isExported ? 1 : 0 // Preserve current export status
    }));
    
    await store.updateMonthlySubscriptions(props.groupId, subscriptions);
    
    // Get the monthly subscription amount for this month
    const monthlySubscription = months.value[monthNumber - 1].monthlySubscription;
    
    // STEP 3: Perform the export operation (this should handle both operations):
    // 1. Create installment records in collection_balance table
    // 2. Set is_exported = 1 in monthly_subscription table
    await collectionsStore.exportMonthPayout(props.groupId, monthNumber, monthlySubscription);
    
    // Update the UI state immediately after successful export
    months.value[monthNumber - 1].isExported = true;
    
    // STEP 4: Save all data again after export to ensure synchronization
    const postExportSubscriptions = months.value.map((month, index) => ({
      month_number: index + 1,
      bid_amount: month.bidAmount,
      total_dividend: month.totalDividend,
      distributed_dividend: month.distributedDividend,
      monthly_subscription: month.monthlySubscription,
      is_exported: month.isExported ? 1 : 0 // Include updated export status
    }));
    
    await store.updateMonthlySubscriptions(props.groupId, postExportSubscriptions);
    
    // STEP 5: Verify the export status from backend to ensure consistency
    const isExported = await collectionsStore.getNextMonthStatus(props.groupId, monthNumber);
    if (isExported !== true) {
      months.value[monthNumber - 1].isExported = isExported;
    }
    
    // STEP 6: Final save to ensure complete synchronization
    await saveMonthData(monthNumber - 1);
    
    showNotification(`Month ${monthNumber} payout exported and saved successfully`);
  } catch (error: any) {
    // If there's an error, refresh to get the correct state from backend
    try {
      const actualStatus = await collectionsStore.getNextMonthStatus(props.groupId, monthNumber);
      months.value[monthNumber - 1].isExported = actualStatus;
      await saveMonthData(monthNumber - 1);
    } catch (e) {
      // Silently handle error
    }
    showNotification(error.message || 'Failed to export month payout', 'error');
  } finally {
    loading.value = false;
  }
}

const resetMonthPayout = async (monthNumber: number) => {
  try {
    loading.value = true;
    
    await saveMonthData(monthNumber - 1);
    
    await collectionsStore.resetNextMonthPayout(props.groupId, monthNumber);
    
    months.value[monthNumber - 1].isExported = false;
    
    const isExported = await collectionsStore.getNextMonthStatus(props.groupId, monthNumber);
    if (isExported !== false) {
      months.value[monthNumber - 1].isExported = isExported;
    }
    
    const subscriptions = months.value.map((month, index) => ({
      month_number: index + 1,
      bid_amount: month.bidAmount,
      total_dividend: month.totalDividend,
      distributed_dividend: month.distributedDividend,
      monthly_subscription: month.monthlySubscription,
      is_exported: month.isExported ? 1 : 0
    }));
    
    await store.updateMonthlySubscriptions(props.groupId, subscriptions);
    
    await saveMonthData(monthNumber - 1);
    
    showNotification(`Month ${monthNumber} payout reset and saved successfully`);
  } catch (error: any) {
    try {
      const actualStatus = await collectionsStore.getNextMonthStatus(props.groupId, monthNumber);
      months.value[monthNumber - 1].isExported = actualStatus;
      await saveMonthData(monthNumber - 1);
    } catch (e) {
      // Silently handle error
    }
    showNotification(error.message || 'Failed to reset month payout', 'error');
  } finally {
    loading.value = false;  
  }
}

watch(months, () => {
  // Watch for changes in months data to ensure UI reactivity
}, { deep: true });

onMounted(async () => {
  try {
    loading.value = true;
    
    // Fetch existing data from monthly_subscription table and other related data    await loadData();
    
    await nextTick();
    
  } catch (error) {
    showNotification('Failed to load existing data. Please refresh the page.', 'error');
  } finally {
    loading.value = false;
  }
})
</script>

<template>
  <div class="monthly-subscription">
    <!-- Commission Section -->
    <div class="commission-section">
      <div class="commission-input">
        <label for="commission">Commission Percentage:</label>
        <input 
          type="number" 
          id="commission" 
          v-model="commissionPercentage" 
          min="0" 
          max="100" 
          step="0.01"
          @input="calculateCommissionAmount"
          :disabled="months.some(month => month.isExported)"
        />
        <span class="percentage-symbol">%</span>
      </div>
      <div class="commission-amount">
        <label>Commission Amount:</label>
        <span>₹{{ commissionAmount.toLocaleString() }}</span>
      </div>
      <button 
        class="save-button"        @click="saveCommission"
        :disabled="loading"
      >
        {{ loading ? 'Saving...' : 'Save Commission' }}
      </button>
    </div>

    <!-- Timeline Section -->
    <div class="timeline-container">
      <div class="timeline">
        <div v-for="(month, index) in months" :key="index" class="timeline-item">
          <div class="timeline-marker">
            <div class="marker-dot"></div>
            <div class="marker-line" v-if="index < months.length - 1"></div>
          </div>
          
          <div class="timeline-content">            <div class="month-header">
              <h3>Month {{ index + 1 }}</h3>
              <span class="date">{{ formatDate(month.date) }}</span>
            </div>
            
            <div class="month-details">
              <!-- First Month Special Case -->
              <template v-if="index === 0">
                <div class="field">
                  <label>Monthly Subscription:</label>
                  <input  
                    type="number"
                    v-model="month.monthlySubscription"
                    @input="updateFirstMonthSubscription"
                  />
                </div>
              </template>

              <!-- Other Months -->
              <template v-else>
                <div class="field">
                  <label>Total Amount:</label>
                  <span>₹{{ groupDetails?.total_amount.toLocaleString() }}</span>
                </div>                <div class="field">
                  <label>Bid Amount:</label>
                  <input 
                    type="number" 
                    v-model="month.bidAmount" 
                    @input="() => { calculateMonthValues(index); }" 
                  />
                </div>
                <div class="field">
                  <label>Commission Amount:</label>
                  <span>₹{{ commissionAmount.toLocaleString() }}</span>
                </div>
                <div class="field">
                  <label>Total Dividend:</label>
                  <span>₹{{ month.totalDividend.toLocaleString() }}</span>
                </div>
                <div class="field">
                  <label>Distributed Dividend:</label>
                  <span>₹{{ month.distributedDividend.toLocaleString() }}</span>
                </div>
                <div class="field">
                  <label>Monthly Subscription:</label>
                  <span class="subscription-value">₹{{ month.monthlySubscription.toLocaleString() }}</span>
                </div>
              </template>
            </div>            <!-- Add Export, Save, and Reset buttons for all months -->
            <div class="action-buttons">
              <button 
                class="save-button month-save-button" 
                @click="saveMonthData(index)"
                :disabled="loading"
              >
                {{ loading ? 'Saving...' : 'Save' }}
              </button>              <button 
                class="export-button" 
                :class="{ 'exported': month.isExported }"
                @click="exportMonthPayout(index + 1)"
                :disabled="loading || month.isExported"
                :title="month.isExported ? 'Month already exported' : 'Export month payout to members'"
              >
                {{ loading ? 'Exporting...' : month.isExported ? 'Exported' : 'Export' }}
              </button>
              <button 
                class="reset-button" 
                @click="resetMonthPayout(index + 1)"
                :disabled="loading || !month.isExported"
                :title="!month.isExported ? 'Month not exported yet' : 'Reset month payout and remove member installments'"
              >
                {{ loading ? 'Resetting...' : 'Reset' }}
              </button>
            </div>
          </div>
        </div>      </div>
    </div>

    <StandardNotification
      :show="notification.show"
      :message="notification.message"
      :type="notification.type"
      @close="notification.show = false"
    />
  </div>
</template>

<style scoped>
.monthly-subscription {
  padding: 2rem;
  background: #f8f9fa;
  min-height: 100vh;
}

.commission-section {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.commission-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 8px;
}

.commission-input input {
  width: 100px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.commission-amount {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 8px;
}

.save-button {
  padding: 0.75rem 1.5rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.save-button:hover {
  background-color: #2980b9;
  transform: translateY(-1px);
}

.save-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.timeline-container {
  position: relative;
  padding: 2rem 0;
}

.timeline {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
}

.timeline-item {
  display: flex;
  margin-bottom: 2rem;
  position: relative;
}

.timeline-marker {
  position: relative;
  width: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.marker-dot {
  width: 20px;
  height: 20px;
  background: #3498db;
  border-radius: 50%;
  border: 4px solid #fff;
  box-shadow: 0 0 0 2px #3498db;
  z-index: 2;
}

.marker-line {
  position: absolute;
  top: 24px;
  width: 2px;
  height: calc(100% + 2rem);
  background: #3498db;
  z-index: 1;
}

.timeline-content {
  flex: 1;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  padding: 1.5rem;
  margin-left: 1rem;
  transition: transform 0.3s ease;
  position: relative;
  padding-bottom: 4rem; /* Add space for buttons */
}

.timeline-content:hover {
  transform: translateY(-2px);
}

.month-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.month-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.25rem;
}

.date {
  color: #2c3e50;
  font-weight: 700;
  font-size: 1.1rem;
  background: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 6px;
}

.month-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
}

.field label {
  font-size: 0.875rem;
  color: #666;
  font-weight: 500;
}

.field input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  background: white;
  transition: border-color 0.3s ease;
}

.field input:focus {
  border-color: #3498db;
  outline: none;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.field input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.field span {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}

.percentage-symbol {
  color: #666;
  font-weight: 500;
}

.field span.subscription-value {
  font-size: 1.6rem;
  font-weight: 800;
}

.action-buttons {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.month-save-button {
  padding: 0.5rem 1rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  font-size: 0.875rem;
}

.month-save-button:hover {
  background-color: #2980b9;
  transform: translateY(-1px);
}

.month-save-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.export-button {
  padding: 0.5rem 1rem;
  background-color: #2ecc71;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.export-button.exported {
  background-color: #95a5a6;
  cursor: default;
}

.export-button:hover:not(.exported) {
  background-color: #27ae60;
  transform: translateY(-1px);
}

.export-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.reset-button {
  padding: 0.5rem 1rem;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.reset-button:hover {
  background-color: #c0392b;
  transform: translateY(-1px);
}

.reset-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 768px) {
  .monthly-subscription {
    padding: 1rem;
  }

  .commission-section {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .timeline-marker {
    width: 30px;
  }

  .marker-dot {
    width: 16px;
    height: 16px;
  }

  .timeline-content {
    margin-left: 0.5rem;
  }

  .month-details {
    grid-template-columns: 1fr;
  }
}
</style>