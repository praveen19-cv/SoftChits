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
      <div v-if="collections.length > 0" class="collection-table">
        <div class="table-responsive">
          <table class="modern-table">
            <thead>
              <tr>
                <th>Installment</th>
                <th>Collection Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Pending Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="collection in collections" :key="collection.id">
                <td>{{ collection.installment_number }}</td>
                <td>{{ collection.collection_date ? (new Date(collection.collection_date).toLocaleDateString('en-GB')) : '-' }}</td>
                <td>₹{{ (collection.collection_amount || 0).toLocaleString() }}</td>
                <td>
                  <span :class="['status', collection.is_completed ? 'completed' : 'pending']">
                    {{ collection.is_completed ? 'Completed' : 'Pending' }}
                  </span>
                </td>
                <td>
                  <span>{{ collection.updated_remaining_balance !== undefined ? '₹' + (collection.updated_remaining_balance || 0).toLocaleString() : '-' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="summary total-amount">
          <span>Total Transactions: <b>{{ totalInstallments }}</b></span>
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
const totalInstallments = ref(0)
const totalAmount = ref(0)
const errorMessage = ref('')

const customers = ref<{ id: number; name: string }[]>([])
const groups = ref<{ id: number; name: string; start_date?: string }[]>([])

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
  if (selectedCustomerId.value && selectedGroupId.value && fromDate.value && toDate.value) {
    try {
      const response = await collectionsStore.fetchCollectionsByCustomerAndDateRange(
        String(selectedCustomerId.value),
        selectedGroupId.value,
        fromDate.value,
        toDate.value
      )
      // Response is an array of collections
      collections.value = response
      totalInstallments.value = response.length
      totalAmount.value = response.reduce((sum: number, c: any) => sum + (c.collection_amount || 0), 0)
    } catch (err: any) {
      errorMessage.value = err?.response?.data?.message || 'No data found or server error.'
      collections.value = []
      totalInstallments.value = 0
      totalAmount.value = 0
    }
  } else {
    collections.value = []
    totalInstallments.value = 0
    totalAmount.value = 0
  }
}

async function loadGroups() {
  await groupsStore.fetchGroups()
  groups.value = groupsStore.groups.map(g => ({ id: g.id, name: g.name, start_date: g.start_date }))
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
</style>
