<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import StandardNotification from '@/components/standards/StandardNotification.vue'
import { debounce } from 'lodash'

const props = defineProps<{
  groupId: number
}>()

const store = useGroupsStore()
const loading = ref(false)
const commissionPercentage = ref(4) // Default 4%
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
}

const months = ref<MonthData[]>([])
const groupDetails = computed(() => store.currentGroup)

// Calculate commission amount based on total amount and percentage
const commissionAmount = computed(() => {
  if (!groupDetails.value) return 0
  return (groupDetails.value.total_amount * commissionPercentage.value) / 100
})

// Add the missing function
const calculateCommissionAmount = () => {
  // Recalculate all month values when commission changes
  months.value.forEach((_, index) => {
    if (index > 0) {
      calculateMonthValues(index)
    }
  })
}

// Calculate values for a specific month
const calculateMonthValues = (index: number) => {
  const month = months.value[index]
  if (!month || !groupDetails.value) return

  // Calculate total dividend
  month.totalDividend = month.bidAmount - commissionAmount.value

  // Calculate distributed dividend
  month.distributedDividend = month.totalDividend / (groupDetails.value.member_count || 1)

  // Calculate monthly subscription
  const baseSubscription = groupDetails.value.total_amount / (groupDetails.value.member_count || 1)
  month.monthlySubscription = baseSubscription - month.distributedDividend
}

// Update first month subscription
const updateFirstMonthSubscription = () => {
  if (!groupDetails.value) return
  const baseSubscription = groupDetails.value.total_amount / (groupDetails.value.member_count || 1)
  months.value[0].monthlySubscription = baseSubscription
}

// Save commission percentage
const saveCommission = async () => {
  try {
    loading.value = true
    // Convert to number and handle both integer and decimal values
    const commissionValue = Number(commissionPercentage.value)
    await store.updateGroupCommission(props.groupId, commissionValue)
    showNotification('Commission updated successfully')
  } catch (error: any) {
    showNotification(error.message || 'Failed to update commission', 'error')
  } finally {
    loading.value = false
  }
}

// Show notification
const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
  notification.value = {
    show: true,
    message,
    type
  }
}

// Load initial data
const loadData = async () => {
  try {
    loading.value = true;
    await store.fetchGroupById(props.groupId);
    await store.fetchChitDates(props.groupId);
    await store.fetchMonthlySubscriptions(props.groupId);
    
    // Initialize months data
    const numberOfMonths = (store.currentGroup?.number_of_months || 0) + 1;
    const chitDates = store.chitDates;
    const startDate = new Date(store.currentGroup?.start_date || '');

    if (!store.currentGroup) {
      throw new Error('Group details not found');
    }

    if (!chitDates.length) {
      console.warn('No chit dates found for group');
    }

    // Try to fetch subscriptions
    let subscriptions = store.monthlySubscriptions;
    if (!subscriptions.length || subscriptions.length !== numberOfMonths) {
      // Create initial subscriptions
      const baseSubscription = store.currentGroup.total_amount / store.currentGroup.member_count;
      const commissionAmount = (store.currentGroup.total_amount * commissionPercentage.value) / 100;
      
      // Ensure we create exactly numberOfMonths subscriptions
      subscriptions = Array(numberOfMonths).fill(null).map((_, index) => {
        if (index === 0) {
          // Month 1: Only monthly subscription, other fields zero
          return {
            month_number: index,
            bid_amount: 0,
            total_dividend: 0,
            distributed_dividend: 0,
            monthly_subscription: baseSubscription
          };
        } else {
          // For months 2 to N+1, use chitDates[index-1] if available
          const chitDateIndex = index - 1;
          const chitDate = chitDates[chitDateIndex];
          const bidAmount = chitDate?.amount || 0;
          const totalDividend = bidAmount - commissionAmount;
          const distributedDividend = totalDividend / store.currentGroup!.member_count;
          const monthlySubscription = baseSubscription - distributedDividend;

          return {
            month_number: index,
            bid_amount: bidAmount,
            total_dividend: totalDividend,
            distributed_dividend: distributedDividend,
            monthly_subscription: monthlySubscription
          };
        }
      });

      try {
        // Save the subscriptions
        await store.updateMonthlySubscriptions(props.groupId, subscriptions);
        // Refresh subscriptions after saving
        await store.fetchMonthlySubscriptions(props.groupId);
        subscriptions = store.monthlySubscriptions;
      } catch (error) {
        console.error('Failed to save subscriptions:', error);
        showNotification('Failed to save subscriptions. Please try again.', 'error');
        return;
      }
    }

    // Ensure we have exactly numberOfMonths entries
    if (subscriptions.length !== numberOfMonths) {
      console.warn(`Expected ${numberOfMonths} months but got ${subscriptions.length}`);
      // If we don't have enough months, create them
      if (subscriptions.length < numberOfMonths) {
        const baseSubscription = store.currentGroup.total_amount / store.currentGroup.member_count;
        const commissionAmount = (store.currentGroup.total_amount * commissionPercentage.value) / 100;
        
        // Add missing months
        for (let i = subscriptions.length; i < numberOfMonths; i++) {
          const chitDateIndex = i - 1;
          const chitDate = chitDates[chitDateIndex];
          const bidAmount = chitDate?.amount || 0;
          const totalDividend = bidAmount - commissionAmount;
          const distributedDividend = totalDividend / store.currentGroup!.member_count;
          const monthlySubscription = baseSubscription - distributedDividend;

          subscriptions.push({
            month_number: i,
            bid_amount: bidAmount,
            total_dividend: totalDividend,
            distributed_dividend: distributedDividend,
            monthly_subscription: monthlySubscription
          });
        }

        // Save the updated subscriptions
        try {
          await store.updateMonthlySubscriptions(props.groupId, subscriptions);
          await store.fetchMonthlySubscriptions(props.groupId);
          subscriptions = store.monthlySubscriptions;
        } catch (error) {
          console.error('Failed to save missing months:', error);
          showNotification('Failed to save missing months. Please try again.', 'error');
          return;
        }
      }
    }

    // Create months array with all months
    months.value = Array(numberOfMonths).fill(null).map((_, index) => {
      const subscription = subscriptions.find(s => s.month_number === index);
      let date = '';
      
      if (index === 0) {
        // Month 1: One month before start date
        const month1Date = new Date(startDate);
        month1Date.setMonth(month1Date.getMonth() - 1);
        date = month1Date.toISOString().slice(0, 10);
      } else {
        // For months 2 to N+1, use chitDates[index-1] if available
        const chitDateIndex = index - 1;
        const chitDate = chitDates[chitDateIndex];
        date = chitDate?.chit_date || '';
      }

      return {
        date: date,
        bidAmount: subscription?.bid_amount || 0,
        totalDividend: subscription?.total_dividend || 0,
        distributedDividend: subscription?.distributed_dividend || 0,
        monthlySubscription: subscription?.monthly_subscription || 0
      };
    });

    // Calculate initial values
    months.value.forEach((_, index) => {
      if (index === 0) {
        updateFirstMonthSubscription();
      } else {
        calculateMonthValues(index);
      }
    });
  } catch (error: any) {
    console.error('Error loading data:', error);
    showNotification(error.message || 'Failed to load data', 'error');
  } finally {
    loading.value = false;
  }
};

// Save all monthly data
const saveMonthlyData = async () => {
  try {
    loading.value = true
    const subscriptions = months.value.map((month, index) => ({
      month_number: index,
      bid_amount: month.bidAmount,
      total_dividend: month.totalDividend,
      distributed_dividend: month.distributedDividend,
      monthly_subscription: month.monthlySubscription
    }))
    
    await store.updateMonthlySubscriptions(props.groupId, subscriptions)
    showNotification('Monthly data saved successfully')
  } catch (error: any) {
    showNotification(error.message || 'Failed to save monthly data', 'error')
  } finally {
    loading.value = false
  }
}

// Debounced save function for bid amount
const debouncedSaveMonthlyData = debounce(() => {
  saveMonthlyData();
}, 500);

// Add date formatting function
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');
}

// Add save functions for each editable field
const saveBidAmount = async (index: number) => {
  try {
    loading.value = true
    await store.updateChitDates(props.groupId, months.value.map((month, i) => ({
      chit_date: month.date,
      amount: i === index ? month.bidAmount : 0
    })))
    showNotification('Bid amount updated successfully')
  } catch (error: any) {
    showNotification(error.message || 'Failed to update bid amount', 'error')
  } finally {
    loading.value = false
  }
}

const saveFirstMonthSubscription = async () => {
  try {
    loading.value = true
    // Save the first month's subscription amount
    await store.updateChitDates(props.groupId, months.value.map((month, index) => ({
      chit_date: month.date,
      amount: index === 0 ? month.monthlySubscription : month.bidAmount
    })))
    showNotification('Monthly subscription updated successfully')
  } catch (error: any) {
    showNotification(error.message || 'Failed to update monthly subscription', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
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
        />
        <span class="percentage-symbol">%</span>
      </div>
      <div class="commission-amount">
        <label>Commission Amount:</label>
        <span>₹{{ commissionAmount.toLocaleString() }}</span>
      </div>
      <button 
        class="save-button" 
        @click="saveCommission"
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
          
          <div class="timeline-content">
            <div class="month-header">
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
                </div>
                <div class="field">
                  <label>Bid Amount:</label>
                  <input 
                    type="number"
                    v-model="month.bidAmount"
                    @input="() => { calculateMonthValues(index); debouncedSaveMonthlyData(); }"
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
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="text-align: right; margin-top: 2rem;">
      <button class="save-button" @click="saveMonthlyData" :disabled="loading">
        {{ loading ? 'Saving...' : 'Save All Changes' }}
      </button>
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