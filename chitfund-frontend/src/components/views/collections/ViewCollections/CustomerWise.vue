<template>
  <div class="customerwise-bg">
    <div class="customerwise-container card">
      <div class="card-header">
        <h3>👤 Customer Wise Collections</h3>
        <p class="header-description">View detailed collections and ledger for individual customers</p>
      </div>      <div class="filters">
        <!-- First Row: Customer, Status, Groups -->
        <div class="filter-row">
          <div class="form-group">
            <label for="customer-search">Customer</label>
            <div class="cs-dropdown">
              <div class="cs-dropdown-selected" @click="customerDropdownOpen = !customerDropdownOpen">
                {{ selectedCustomerName || 'Select Customer' }}
                <span class="cs-dropdown-arrow">▼</span>
              </div>
              <div v-if="customerDropdownOpen" class="cs-dropdown-list">
                <input
                  id="customer-search"
                  name="customer-search"
                  v-model="customerSearch"
                  class="cs-dropdown-search"
                  placeholder="Search customer..."
                  @click.stop
                />
                <div
                  v-for="customer in filteredCustomers"
                  :key="customer.id"
                  class="cs-dropdown-item"
                  @click="selectCustomer(customer)"
                >
                  {{ customer.name }}
                </div>
                <div v-if="!filteredCustomers.length" class="cs-dropdown-noresult">No customers found</div>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label>Groups & Status</label>
            <GroupSelection
              :groups="groups.map(g => ({ id: g.id, name: g.name, status: g.status || 'active' }))"
              v-model="selectedGroupIds"
              v-model:statusModelValue="selectedStatusIds"
              :multiSelectGroups="true"
              placeholder="Select groups"
              @change="handleGroupSelectionChange"
              @statusChange="handleStatusSelectionChange"
            />
          </div>
        </div>
        
        <!-- Second Row: From Date, To Date, Submit -->
        <div class="filter-row">
          <div class="form-group">
            <label for="from_date">From Date</label>
            <input type="date" id="from_date" name="from_date" v-model="fromDate" :disabled="fromChitStart" />
            <div class="from-chit-start">
              <input type="checkbox" id="fromChitStart" name="fromChitStart" v-model="fromChitStart" @change="handleFromChitStart" />
              <label for="fromChitStart">From chit start</label>
            </div>
          </div>
          
          <div class="form-group">
            <label for="to_date">To Date</label>
            <input type="date" id="to_date" name="to_date" v-model="toDate" :disabled="fromChitStart" />
          </div>
          
          <div class="form-group">
            <label>&nbsp;</label> <!-- Empty label for alignment -->
            <button class="submit-btn" @click="onSubmit" :disabled="!selectedCustomerId || selectedGroupIds.length === 0">
              Submit
            </button>
          </div>
        </div>
      </div>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      
      <!-- Group-wise Data Display -->
      <div v-if="selectedGroupIds.length > 0 && collections.length > 0" class="groups-data-section">
        <div 
          v-for="groupId in selectedGroupIds" 
          :key="`group-${groupId}`"
          class="group-data-container"
        >
          <div class="group-header">
            <h3 class="group-title">
              📊 {{ groups.find(g => g.id === groupId)?.name || 'Unknown Group' }}
            </h3>
          </div>
          
          <!-- Transactions Section -->
          <div class="group-section">
            <h4 class="section-title">💰 Transactions</h4>
            <div class="section-content">
              <CustomerLedger 
                :customer="selectedCustomer"
                :group="groups.find(g => g.id === groupId)"
                :collections="collections.filter(c => c.group_id === groupId)"
              />
            </div>
          </div>
          
          <!-- Pending Balances Section -->
          <div class="group-section">
            <h4 class="section-title">⏳ Pending Balances</h4>
            <div class="section-content">
              <PendingBalanceEach :customerId="selectedCustomerId" :groupId="groupId" />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Fallback for single display when no group selection -->
      <div v-else-if="collections.length > 0">
        <!-- Use CustomerLedger component -->
        <CustomerLedger 
          :customer="selectedCustomer"
          :group="selectedGroup"
          :collections="collections"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useMembersStore } from '@/stores/MembersStore'
import PendingBalanceEach from './PendingBalanceEach.vue'
import CustomerLedger from './CustomerLedger.vue'
import GroupSelection from '@/components/standards/GroupSelection.vue'

const groupsStore = useGroupsStore()
const collectionsStore = useCollectionsStore()
const membersStore = useMembersStore()

const customerSearch = ref('')
const groupSearch = ref('')
const selectedCustomerId = ref<number | null>(null)
const selectedGroupId = ref<number | null>(null)
const selectedGroupIds = ref<number[]>([])
const selectedStatusIds = ref<string[]>(['active'])
const fromDate = ref('')
const toDate = ref('')
const fromChitStart = ref(false)
const collections = ref<any[]>([])
const collectionBalances = ref<any[]>([])
const errorMessage = ref('')

const customers = ref<{ id: number; name: string }[]>([])
const groups = ref<{ id: number; name: string; start_date?: string; total_amount?: number; member_count?: number; status?: string }[]>([])

const customerDropdownOpen = ref(false)
const groupDropdownOpen = ref(false)

const filteredCustomers = computed(() => {
  const search = customerSearch.value.toLowerCase()
  return customers.value.filter(c => c.name.toLowerCase().includes(search))
})
const filteredGroups = computed(() => {
  const search = groupSearch.value.toLowerCase()
  return groups.value.filter(g => g.name.toLowerCase().includes(search))
})

const selectedCustomerName = computed(() => {
  const customer = customers.value.find(c => c.id === selectedCustomerId.value)
  return customer ? customer.name : ''
})
const selectedGroupName = computed(() => {
  const group = groups.value.find(g => g.id === selectedGroupId.value)
  return group ? group.name : ''
})

const selectedCustomer = computed(() => {
  return customers.value.find(c => c.id === selectedCustomerId.value) || null
})
const selectedGroup = computed(() => {
  return groups.value.find(g => g.id === selectedGroupId.value) || null
})

function selectCustomer(customer: { id: number; name: string }) {
  selectedCustomerId.value = customer.id
  customerSearch.value = customer.name
  customerDropdownOpen.value = false
}
function selectGroup(group: { id: number; name: string; start_date?: string }) {
  selectedGroupId.value = group.id
  groupSearch.value = group.name
  groupDropdownOpen.value = false
  if (fromChitStart.value) handleFromChitStart()
}

function handleFromChitStart() {
  if (fromChitStart.value && selectedGroupIds.value.length > 0) {
    // Use the first selected group for the date logic
    const firstGroupId = selectedGroupIds.value[0]
    const group = groups.value.find(g => g.id === firstGroupId)
    if (group && group.start_date) {
      fromDate.value = group.start_date
      // Set toDate to today
      const today = new Date()
      toDate.value = today.toISOString().slice(0, 10)
    }
  }
}

async function onSubmit() {
  errorMessage.value = ''
  
  if (selectedCustomerId.value && selectedGroupIds.value.length > 0) {
    // Handle date logic
    let effectiveFromDate = fromDate.value
    let effectiveToDate = toDate.value
    
    // If no dates are entered, fetch all transactions
    if (!effectiveFromDate && !effectiveToDate) {
      // Set a very early date to get all records
      effectiveFromDate = '1900-01-01'
      effectiveToDate = new Date().toISOString().slice(0, 10) // Today
    } else if (effectiveFromDate && !effectiveToDate) {
      // If only from date is entered, set to date to today
      effectiveToDate = new Date().toISOString().slice(0, 10)
    } else if (!effectiveFromDate && effectiveToDate) {
      // If only to date is entered, set from date to a very early date
      effectiveFromDate = '1900-01-01'
    }
    
    try {
      // Fetch collections for all selected groups
      const allCollections: any[] = []
      
      for (const groupId of selectedGroupIds.value) {
        try {
          const collectionsResponse = await collectionsStore.fetchCollectionsByCustomerAndDateRange(
            String(selectedCustomerId.value),
            groupId,
            effectiveFromDate,
            effectiveToDate
          )
          
          // Add group information to each collection
          const groupCollections = collectionsResponse.map((collection: any) => ({
            ...collection,
            group_id: groupId,
            group_name: groups.value.find(g => g.id === groupId)?.name || 'Unknown Group'
          }))
          
          allCollections.push(...groupCollections)
        } catch (groupError) {
          console.warn(`Error fetching collections for group ${groupId}:`, groupError)
        }
      }
      
      // Fetch monthly subscription data for all groups
      const allMonthlySubscriptions: any[] = []
      for (const groupId of selectedGroupIds.value) {
        try {
          const monthlySubscriptions = await collectionsStore.fetchMonthlySubscriptions(groupId)
          const groupSubscriptions = monthlySubscriptions.map((sub: any) => ({
            ...sub,
            group_id: groupId
          }))
          allMonthlySubscriptions.push(...groupSubscriptions)
        } catch (subscriptionError) {
          console.warn(`Could not fetch monthly subscriptions for group ${groupId}:`, subscriptionError)
        }
      }
      
      // Enhance collections with monthly subscription data if not already present
      if (allMonthlySubscriptions.length > 0) {
        // Create a map for quick lookup by group and installment
        const subscriptionsMap = new Map()
        allMonthlySubscriptions.forEach((sub: any) => {
          const key = `${sub.group_id}-${sub.installment_number}`
          subscriptionsMap.set(key, sub.monthly_subscription)
        })
        
        // Enhance each collection with the corresponding monthly_subscription if not already present
        const enhancedCollections = allCollections.map((collection: any) => {
          const key = `${collection.group_id}-${collection.installment_number}`
          if (collection.monthly_subscription === undefined && subscriptionsMap.has(key)) {
            return {
              ...collection,
              monthly_subscription: subscriptionsMap.get(key)
            }
          }
          return collection
        })
        
        collections.value = enhancedCollections
      } else {
        // Set the original collections data
        collections.value = allCollections
      }
      
      collectionBalances.value = [] // Clear any old balance data
    } catch (err: any) {
      console.error('Error in onSubmit:', err)
      errorMessage.value = err?.response?.data?.message || 'No data found or server error.'
      collections.value = []
      collectionBalances.value = []
    }
  } else {
    collections.value = []
    collectionBalances.value = []
  }
}

async function loadGroups() {
  await groupsStore.fetchGroups()
  groups.value = groupsStore.groups.map(g => ({ 
    id: g.id, 
    name: g.name, 
    start_date: g.start_date,
    total_amount: g.total_amount,
    member_count: g.member_count,
    status: g.status || 'active'
  }))
}
async function loadCustomers() {
  await membersStore.fetchMembers()
  customers.value = membersStore.members.map(m => ({ id: m.id, name: m.name }))
}
onMounted(() => {
  loadGroups()
  loadCustomers()
})
watch(selectedGroupIds, () => {
  if (fromChitStart.value) handleFromChitStart()
}, { deep: true })

function handleGroupSelectionChange(simpleGroups: { id: number; name: string }[]) {
  if (simpleGroups.length > 0) {
    selectedGroupIds.value = simpleGroups.map(g => g.id)
    selectedGroupId.value = simpleGroups[0].id // For backward compatibility
    // Update the group search to show the selected group name
    groupSearch.value = simpleGroups[0].name
    if (fromChitStart.value) handleFromChitStart()
  } else {
    selectedGroupIds.value = []
    selectedGroupId.value = null
    groupSearch.value = ''
  }
}

function handleStatusSelectionChange(selectedStatuses: { id: string; name: string }[]) {
  selectedStatusIds.value = selectedStatuses.map(s => s.id)
}
</script>

<style scoped>
.customerwise-bg {
  min-height: 100vh;
  padding: 2rem 0;
}
.customerwise-container {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2.5rem 2rem;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  background: #fff;
}
.card-header {
  text-align: center;
  margin-bottom: 2.5rem;
}
.card-header h3 {
  margin: 0 0 0.5rem 0;
  color: #1a237e;
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 1px;
}
.header-description {
  color: #6c757d;
  font-size: 1.1rem;
  margin: 0;
}
.filters {
  margin-bottom: 2.5rem;
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 15px;
  border: 1px solid #e9ecef;
}

.filter-row {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.form-group {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
}
label {
  display: block;
  margin-bottom: 0.75rem;
  color: #2c3e50;
  font-weight: 600;
  font-size: 1rem;
}
input[type="date"], input[type="text"], select {
  width: 100%;
  padding: 0.875rem;
  border: 2px solid #e3f2fd;
  border-radius: 10px;
  font-size: 1rem;
  background: #fff;
  transition: all 0.3s ease;
}
input[type="date"]:focus, input[type="text"]:focus, select:focus {
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
  outline: none;
}
.submit-btn {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #5ec2f0 0%, #69aece 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 25px rgba(129, 212, 250, 0.3);
  transition: all 0.3s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.submit-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  box-shadow: none;
}
.submit-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 35px rgba(129, 212, 250, 0.4);
}
.cs-dropdown {
  position: relative;
}
.cs-dropdown-selected {
  padding: 0.875rem;
  border: 2px solid #e3f2fd;
  border-radius: 10px;
  background: #fff;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
}
.cs-dropdown-selected:hover {
  border-color: #2196f3;
}
.cs-dropdown-arrow {
  margin-left: 0.5rem;
  font-size: 1.1em;
  transition: transform 0.2s ease;
}
.cs-dropdown-list {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background: #fff;
  border: 2px solid #e3f2fd;
  border-radius: 10px;
  max-height: 250px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
.cs-dropdown-search {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-bottom: 1px solid #e3f2fd;
  font-size: 1rem;
  background: #f8f9fa;
  outline: none;
}
.cs-dropdown-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f8f9fa;
}
.cs-dropdown-item:last-child {
  border-bottom: none;
}
.cs-dropdown-item:hover {
  background: #e3f2fd;
}
.cs-dropdown-noresult {
  padding: 1rem;
  text-align: center;
  color: #6c757d;
  font-style: italic;
}
.error-message {
  color: #b71c1c;
  background: #ffebee;
  border: 1px solid #ffcdd2;
  padding: 0.7rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 600;
}
.from-chit-start {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Group-wise Data Display */
.groups-data-section {
  margin-top: 2rem;
}

.group-data-container {
  margin-bottom: 3rem;
  border: 2px solid #e3f2fd;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  background: #fff;
}

.group-header {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  padding: 1.5rem 2rem;
  border-bottom: 2px solid #e3f2fd;
}

.group-title {
  margin: 0;
  color: #1565c0;
  font-size: 1.8rem;
  font-weight: 700;
  text-align: center;
}

.group-section {
  margin: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 15px;
  border: 1px solid #e9ecef;
}

.section-title {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
  font-size: 1.4rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e3f2fd;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-content {
  background: #fff;
  padding: 1.5rem;
  border-radius: 10px;
  border: 1px solid #e3f2fd;
}

/* Pending Balances Section */
.pending-balances-section {
  margin-top: 2rem;
}

.group-pending-balance {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 15px;
  border: 1px solid #e9ecef;
}

.group-pending-title {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.3rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e3f2fd;
}

/* Responsive Design */
@media (max-width: 900px) {
  .customerwise-container {
    padding: 1.2rem 0.5rem;
    margin: 1rem auto;
  }
  
  .filter-row {
    flex-direction: column;
    gap: 1rem;
  }
  
  .form-group {
    min-width: unset;
  }
}

@media (max-width: 600px) {
  .card-header h3 {
    font-size: 1.8rem;
  }
  
  .submit-btn {
    width: 100%;
    padding: 1rem;
  }
}
</style>
