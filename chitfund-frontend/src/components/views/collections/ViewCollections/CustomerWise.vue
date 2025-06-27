<template>
  <div class="customerwise-bg">
    <div class="customerwise-container card">
      <div class="card-header">
        <h3>Customer Wise Collections</h3>
</div>
<div class="filters">
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
          <label for="group-search">Group</label>
          <div class="cs-dropdown">
            <div class="cs-dropdown-selected" @click="groupDropdownOpen = !groupDropdownOpen">
              {{ selectedGroupName || 'Select Group' }}
              <span class="cs-dropdown-arrow">▼</span>
            </div>
            <div v-if="groupDropdownOpen" class="cs-dropdown-list">
              <input
                id="group-search"
                name="group-search"
                v-model="groupSearch"
                class="cs-dropdown-search"
                placeholder="Search group..."
                @click.stop
              />
              <div
                v-for="group in filteredGroups"
                :key="group.id"
                class="cs-dropdown-item"
                @click="selectGroup(group)"
              >
                {{ group.name }}
              </div>
              <div v-if="!filteredGroups.length" class="cs-dropdown-noresult">No groups found</div>
            </div>
          </div>
        </div>
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
        <button class="submit-btn" @click="onSubmit" :disabled="!selectedCustomerId || !selectedGroupId">Submit</button>
      </div>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      <div v-if="installmentData.length > 0" class="collection-table">
        <div class="table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th style="width: 50px;"></th>
                <th>Installment</th>
                <th>Subscription Amount</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th>Pending Balance</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="installment in installmentData" :key="installment.installmentNumber">
                <!-- Main installment row -->
                <tr class="installment-row" @click="toggleInstallment(installment.installmentNumber)">
                  <td class="expand-cell">
                    <div class="expand-button" :class="{ 'expanded': expandedInstallments.includes(installment.installmentNumber) }">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                  </td>
                  <td>{{ installment.installmentNumber }}</td>
                  <td>₹{{ installment.subscriptionAmount.toLocaleString() }}</td>
                  <td>₹{{ installment.totalPaid.toLocaleString() }}</td>
                  <td>
                    <span :class="['status', installment.isCompleted ? 'completed' : 'pending']">
                      {{ installment.isCompleted ? 'Completed' : 'Pending' }}
                    </span>
                  </td>
                  <td>₹{{ installment.pendingBalance.toLocaleString() }}</td>
                </tr>
                
                <!-- Expanded transaction details -->
                <tr v-if="expandedInstallments.includes(installment.installmentNumber)" class="transaction-details-row">
                  <td colspan="6" class="transaction-details-cell">
                    <div class="transaction-details">
                      <h4>Installment {{ installment.installmentNumber }} Transactions</h4>
                      <table class="transaction-table">
                        <thead>
                          <tr>
                            <th>Collection Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Remaining Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="transaction in installment.transactions" :key="transaction.id">
                            <td>{{ transaction.collection_date ? (new Date(transaction.collection_date).toLocaleDateString('en-GB')) : '-' }}</td>
                            <td>₹{{ (transaction.collection_amount || 0).toLocaleString() }}</td>
                            <td>
                              <span :class="['status', transaction.is_completed ? 'completed' : 'pending']">
                                {{ transaction.is_completed ? 'Completed' : 'Pending' }}
                              </span>
                            </td>
                            <td>₹{{ (transaction.updated_remaining_balance || 0).toLocaleString() }}</td>
                          </tr>
                          <tr v-if="installment.transactions.length === 0">
                            <td colspan="4" class="no-transactions">No transactions yet</td>
                          </tr>
                        </tbody>
                      </table>
                      <div class="transaction-summary">
                        <strong>Total for Installment {{ installment.installmentNumber }}: ₹{{ installment.totalPaid.toLocaleString() }}</strong>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div class="summary total-amount">
          <span>Total Installments: <b>{{ installmentData.length }}</b></span>
          <span style="margin-left:2rem;">Total Amount: <b class="total-value">₹{{ totalAmount.toLocaleString() }}</b></span>
        </div>
      </div>
      <div v-else-if="selectedCustomerId && selectedGroupId && !errorMessage" class="no-data">
        <img src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png" alt="No Data" class="no-data-img" />
        <div>No collections found for the selected criteria.</div>
      </div>
      <PendingBalanceEach :customerId="selectedCustomerId" :groupId="selectedGroupId" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useMembersStore } from '@/stores/MembersStore'
import PendingBalanceEach from './PendingBalanceEach.vue'

const groupsStore = useGroupsStore()
const collectionsStore = useCollectionsStore()
const membersStore = useMembersStore()

const customerSearch = ref('')
const groupSearch = ref('')
const selectedCustomerId = ref<number | null>(null)
const selectedGroupId = ref<number | null>(null)
const fromDate = ref('')
const toDate = ref('')
const fromChitStart = ref(false)
const collections = ref<any[]>([])
const collectionBalances = ref<any[]>([])
const totalInstallments = ref(0)
const totalAmount = ref(0)
const errorMessage = ref('')
const expandedInstallments = ref<number[]>([])

const customers = ref<{ id: number; name: string }[]>([])
const groups = ref<{ id: number; name: string; start_date?: string; total_amount?: number; member_count?: number }[]>([])

const customerDropdownOpen = ref(false)
const groupDropdownOpen = ref(false)

// Computed property to organize collections by installment using collection_balance data
const installmentData = computed(() => {
  if (!collections.value.length || !selectedGroupId.value || !collectionBalances.value.length) return []
  
  // Group collections by installment number
  const installmentMap = new Map<number, any[]>()
  
  // Sort collections by installment number first
  const sortedCollections = [...collections.value].sort((a, b) => {
    return a.installment_number - b.installment_number
  })
  
  sortedCollections.forEach(collection => {
    const instNum = collection.installment_number
    if (!installmentMap.has(instNum)) {
      installmentMap.set(instNum, [])
    }
    installmentMap.get(instNum)!.push(collection)
  })
  
  // Sort transactions within each installment by created_at ascending (oldest created first)
  installmentMap.forEach((transactions, installmentNumber) => {
    transactions.sort((a, b) => {
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    })
  })
  
  // Convert to array of installment data using collection_balance information
  const result = Array.from(installmentMap.entries()).map(([installmentNumber, transactions]) => {
    // Find the corresponding balance record for this installment
    const balanceRecord = collectionBalances.value.find(b => b.installment_number === installmentNumber)
    
    if (balanceRecord) {
      // Use actual data from collection_balance table
      return {
        installmentNumber,
        subscriptionAmount: balanceRecord.total_paid + balanceRecord.remaining_balance, // Original subscription amount
        totalPaid: balanceRecord.total_paid,
        pendingBalance: balanceRecord.remaining_balance,
        isCompleted: balanceRecord.is_completed,
        transactions: transactions // Sorted by created_at ascending (oldest created first)
      }
    } else {
      // Fallback calculation if no balance record found
      const totalPaid = transactions.reduce((sum, t) => sum + (t.collection_amount || 0), 0)
      const selectedGroup = groups.value.find(g => g.id === selectedGroupId.value)
      const subscriptionAmount = selectedGroup?.total_amount && selectedGroup?.member_count
        ? selectedGroup.total_amount / selectedGroup.member_count
        : 10000
      
      return {
        installmentNumber,
        subscriptionAmount,
        totalPaid,
        pendingBalance: Math.max(0, subscriptionAmount - totalPaid),
        isCompleted: totalPaid >= subscriptionAmount,
        transactions
      }
    }
  })
  
  // Sort installments by number
  return result.sort((a, b) => a.installmentNumber - b.installmentNumber)
})

// Update totals based on installment data
watch(installmentData, (newData) => {
  totalInstallments.value = newData.length
  totalAmount.value = newData.reduce((sum, inst) => sum + inst.totalPaid, 0)
})

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

function toggleInstallment(installmentNumber: number) {
  const index = expandedInstallments.value.indexOf(installmentNumber)
  if (index > -1) {
    expandedInstallments.value.splice(index, 1)
  } else {
    expandedInstallments.value.push(installmentNumber)
  }
}

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
  if (fromChitStart.value && selectedGroupId.value) {
    const group = groups.value.find(g => g.id === selectedGroupId.value)
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
  if (selectedCustomerId.value && selectedGroupId.value) {
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
      // Fetch both collections and collection balances
      const [collectionsResponse, balancesResponse] = await Promise.all([
        collectionsStore.fetchCollectionsByCustomerAndDateRange(
          String(selectedCustomerId.value),
          selectedGroupId.value,
          effectiveFromDate,
          effectiveToDate
        ),
        collectionsStore.fetchCollectionBalancesForCustomer(
          selectedCustomerId.value,
          selectedGroupId.value
        )
      ])
      
      // Set the data
      collections.value = collectionsResponse
      collectionBalances.value = balancesResponse
      
      // Update totals (will be recalculated by watcher)
      totalInstallments.value = collectionsResponse.length
      totalAmount.value = collectionsResponse.reduce((sum: number, c: any) => sum + (c.collection_amount || 0), 0)
    } catch (err: any) {
      errorMessage.value = err?.response?.data?.message || 'No data found or server error.'
      collections.value = []
      collectionBalances.value = []
      totalInstallments.value = 0
      totalAmount.value = 0
    }
  } else {
    collections.value = []
    collectionBalances.value = []
    totalInstallments.value = 0
    totalAmount.value = 0
  }
}

async function loadGroups() {
  await groupsStore.fetchGroups()
  groups.value = groupsStore.groups.map(g => ({ 
    id: g.id, 
    name: g.name, 
    start_date: g.start_date,
    total_amount: g.total_amount,
    member_count: g.member_count
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
watch(selectedGroupId, () => {
  if (fromChitStart.value) handleFromChitStart()
})
</script>

<style scoped>
.customerwise-bg {
  min-height: 100vh;
  padding: 2rem 0;
}
.customerwise-container {
  max-width: 950px;
  margin: 2rem auto;
  padding: 2.5rem 2rem 2rem 2rem;
  border-radius: 18px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
  background: #fff;
}
.card-header {
  text-align: center;
  margin-bottom: 2rem;
}
h3 {
  margin: 0;
  color: #1a237e;
  font-size: 2rem;
  letter-spacing: 1px;
}
.filters {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  align-items: flex-end;
  flex-wrap: wrap;
  justify-content: center;
}
.form-group {
  flex: 1;
  min-width: 200px;
}
label {
  display: block;
  margin-bottom: 0.5rem;
  color: #34495e;
  font-weight: 600;
}
input[type="date"], input[type="text"], select {
  width: 100%;
  padding: 0.7rem;
  border: 1.5px solid #b2bec3;
  border-radius: 6px;
  font-size: 1.05rem;
  background: #f8fafc;
  transition: border 0.2s;
}
input[type="date"]:focus, input[type="text"]:focus, select:focus {
  border-color: #2980b9;
  outline: none;
}
.submit-btn {
  padding: 0.8rem 2rem;
  background: linear-gradient(90deg, #2980b9 0%, #6dd5fa 100%);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(44, 62, 80, 0.08);
  transition: background 0.2s, box-shadow 0.2s;
}
.submit-btn:disabled {
  background: #b2bec3;
  cursor: not-allowed;
  box-shadow: none;
}
.submit-btn:not(:disabled):hover {
  background: linear-gradient(90deg, #1565c0 0%, #2196f3 100%);
}
.collection-table {
  margin-top: 1rem;
}
.table-responsive {
  overflow-x: auto;
}
.modern-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(44, 62, 80, 0.06);
}
th, td {
  padding: 1rem 1.2rem;
  text-align: left;
  border-bottom: 1px solid #eaeaea;
}
th {
  background: #e3f2fd;
  color: #1a237e;
  font-weight: 700;
  font-size: 1.08rem;
}
tr:last-child td {
  border-bottom: none;
}
tr:hover {
  background: #e3f2fd44;
  transition: background 0.2s;
}
.status {
  padding: 0.4rem 1.1rem;
  border-radius: 16px;
  font-size: 1rem;
  font-weight: 600;
  display: inline-block;
}
.status.completed {
  background: #dcfce7;
  color: #166534;
}
.status.pending {
  background: #fef3c7;
  color: #92400e;
}
.summary.total-amount {
  font-weight: bold;
  margin-top: 1.2rem;
  text-align: right;
  font-size: 1.15em;
  display: flex;
  justify-content: flex-end;
  gap: 2rem;
}
.total-value {
  color: #1565c0;
  font-size: 1.15em;
  font-weight: 700;
}
.no-data {
  text-align: center;
  color: #888;
  font-size: 1.15em;
  padding: 2.5rem 0 1rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.no-data-img {
  width: 80px;
  margin-bottom: 1rem;
  opacity: 0.7;
}
.cs-dropdown {
  position: relative;
}
.cs-dropdown-selected {
  padding: 0.7rem;
  border: 1.5px solid #b2bec3;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 1.05rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cs-dropdown-arrow {
  margin-left: 0.5rem;
  font-size: 1.1em;
}
.cs-dropdown-list {
  position: absolute;
  top: 2.7rem;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #b2bec3;
  border-radius: 6px;
  max-height: 180px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(44, 62, 80, 0.08);
}
.cs-dropdown-search {
  width: 100%;
  padding: 0.5rem;
  border: none;
  border-bottom: 1px solid #b2bec3;
  font-size: 1rem;
  background: #f8fafc;
  outline: none;
}
.cs-dropdown-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.cs-dropdown-item:hover {
  background: #e3f2fd;
}
.cs-dropdown-noresult {
  padding: 0.5rem 1rem;
  color: #888;
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
@media (max-width: 900px) {
  .customerwise-container {
    padding: 1.2rem 0.5rem;
  }
  .filters {
    flex-direction: column;
    gap: 1rem;
  }
  th, td {
    padding: 0.7rem 0.5rem;
  }
}

/* Expandable installment styles */
.installment-row {
  cursor: pointer;
  transition: background-color 0.2s;
}
.installment-row:hover {
  background-color: #f0f7ff !important;
}

.expand-cell {
  text-align: center;
  padding: 0.5rem !important;
}

.expand-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.expand-button:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.expand-button svg {
  transition: transform 0.3s ease;
}

.expand-button.expanded {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.expand-button.expanded svg {
  transform: rotate(180deg);
}

.expand-icon {
  display: inline-block;
  transition: transform 0.2s;
  font-size: 0.8rem;
  color: #666;
}
.expand-icon.expanded {
  transform: rotate(180deg);
}
.transaction-details-row {
  background-color: #fafbfc !important;
}
.transaction-details-cell {
  padding: 0 !important;
}
.transaction-details {
  padding: 1rem 2rem;
  border-left: 3px solid #2980b9;
  background: linear-gradient(to right, #f8f9fa, #ffffff);
}
.transaction-details h4 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.1rem;
  font-weight: 600;
}
.transaction-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  margin-bottom: 1rem;
}
.transaction-table th {
  background: #e8f4f8;
  color: #2c3e50;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.7rem 1rem;
}
.transaction-table td {
  padding: 0.7rem 1rem;
  border-bottom: 1px solid #eee;
}
.transaction-table tr:last-child td {
  border-bottom: none;
}
.transaction-table tr:hover {
  background-color: #f8f9fa;
}
.no-transactions {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 1.5rem;
}
.transaction-summary {
  text-align: right;
  padding: 0.5rem 0;
  color: #2c3e50;
  font-size: 1rem;
  border-top: 2px solid #e9ecef;
  margin-top: 0.5rem;
}
</style>
