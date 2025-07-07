<template>
  <div class="adjust-collections-bg">
    <div class="adjust-collections-container card">
      <div class="card-header">
        <h3>Adjust Collections</h3>
        <p class="header-description">Transfer excess amounts between installments for specific customers</p>
      </div>

      <!-- Customer and Group Selection -->
      <div class="selection-section">
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
          <label for="group-search">Groups (Multi-select)</label>
          <div class="cs-dropdown">
            <div class="cs-dropdown-selected" @click="groupDropdownOpen = !groupDropdownOpen">
              {{ selectedGroupsText || 'Select Groups' }}
              <span class="cs-dropdown-arrow">▼</span>
            </div>
            <div v-if="groupDropdownOpen" class="cs-dropdown-list multi-select" @click.stop>
              <input
                id="group-search"
                name="group-search"
                v-model="groupSearch"
                class="cs-dropdown-search"
                placeholder="Search groups..."
                @click.stop
              />
              <div class="dropdown-actions">
                <button 
                  type="button" 
                  class="action-btn select-all-btn" 
                  @click="selectAllGroups"
                  :disabled="selectedGroupIds.length === filteredGroups.length"
                >
                  Select All
                </button>
                <button 
                  type="button" 
                  class="action-btn clear-all-btn" 
                  @click="clearAllGroups"
                  :disabled="selectedGroupIds.length === 0"
                >
                  Clear All
                </button>
              </div>
              <div
                v-for="group in filteredGroups"
                :key="group.id"
                class="cs-dropdown-item checkbox-item"
                :class="{ selected: selectedGroupIds.includes(group.id) }"
                @click="toggleGroup(group)"
              >
                <input 
                  type="checkbox" 
                  :checked="selectedGroupIds.includes(group.id)"
                  @change="toggleGroup(group)"
                />
                <span>{{ group.name }}</span>
              </div>
              <div v-if="!filteredGroups.length" class="cs-dropdown-noresult">No groups found</div>
            </div>
          </div>
        </div>

        <button 
          class="submit-btn" 
          @click="loadCustomerData" 
          :disabled="!selectedCustomerId || selectedGroupIds.length === 0"
        >
          Load Data
        </button>
      </div>

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <!-- Customer Data Display -->
      <div v-if="selectedCustomer && selectedGroups.length > 0 && collectionsData.length > 0" class="customer-data-section">
        <h4>Customer Collection Ledgers</h4>
        
        <!-- Display one CustomerLedger for each selected group -->
        <div v-for="group in selectedGroups" :key="group.id" class="group-ledger-section">
          <h5 class="group-ledger-title">{{ group.name }}</h5>
          <CustomerLedger 
            :customer="selectedCustomer"
            :group="group"
            :collections="getCollectionsForGroup(group.id)"
          />
        </div>
      </div>
      
      <!-- Show message if no data found -->
      <div v-else-if="selectedCustomer && selectedGroups.length > 0 && collectionsData.length === 0" class="no-data-message">
        <p>No collection data found for {{ selectedCustomer.name }} in the selected groups.</p>
      </div>

      <!-- Adjustment Form - only show when customer data is loaded -->
      <div v-if="selectedCustomer && selectedGroups.length > 0 && collectionsData.length > 0" class="adjustment-form">
          <h4>Make Adjustment</h4>
          <div class="adjustment-controls">
            <div class="form-group">
              <label>From Group</label>
              <select v-model="adjustmentForm.fromGroupId" @change="updateFromInstallments">
                <option value="">Select Group</option>
                <option 
                  v-for="group in availableFromGroups" 
                  :key="group.id" 
                  :value="group.id"
                >
                  {{ group.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>From Installment</label>
              <div class="cs-dropdown">
                <div class="cs-dropdown-selected" @click="fromInstallmentDropdownOpen = !fromInstallmentDropdownOpen">
                  {{ getFromInstallmentText() || 'Select Installment' }}
                  <span class="cs-dropdown-arrow">▼</span>
                </div>
                <div v-if="fromInstallmentDropdownOpen" class="cs-dropdown-list">
                  <input
                    v-model="fromInstallmentSearch"
                    class="cs-dropdown-search"
                    placeholder="Search installment..."
                    @click.stop
                  />
                  <div
                    v-for="installment in filteredFromInstallments"
                    :key="installment.installmentNumber"
                    class="cs-dropdown-item"
                    @click="selectFromInstallment(installment)"
                  >
                    Installment {{ installment.installmentNumber }} 
                    (Excess: ₹{{ installment.excessShortage.toLocaleString() }})
                  </div>
                  <div v-if="!filteredFromInstallments.length" class="cs-dropdown-noresult">
                    No installments with excess found. 
                    <br><small>Excess occurs when remaining_balance is negative (overpayment).</small>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>To Group</label>
              <select v-model="adjustmentForm.toGroupId" @change="updateToInstallments">
                <option value="">Select Group</option>
                <option 
                  v-for="group in availableToGroups" 
                  :key="group.id" 
                  :value="group.id"
                >
                  {{ group.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>To Installment</label>
              <div class="cs-dropdown">
                <div class="cs-dropdown-selected" @click="toInstallmentDropdownOpen = !toInstallmentDropdownOpen">
                  {{ getToInstallmentText() || 'Select Installment' }}
                  <span class="cs-dropdown-arrow">▼</span>
                </div>
                <div v-if="toInstallmentDropdownOpen" class="cs-dropdown-list">
                  <input
                    v-model="toInstallmentSearch"
                    class="cs-dropdown-search"
                    placeholder="Search installment..."
                    @click.stop
                  />
                  <div
                    v-for="installment in filteredToInstallments"
                    :key="installment.installmentNumber"
                    class="cs-dropdown-item"
                    @click="selectToInstallment(installment)"
                  >
                    Installment {{ installment.installmentNumber }} 
                    (Shortage: ₹{{ Math.abs(installment.excessShortage).toLocaleString() }})
                  </div>
                  <div v-if="!filteredToInstallments.length" class="cs-dropdown-noresult">
                    No installments with shortage found.
                    <br><small>Shortage occurs when remaining_balance is positive (underpayment).</small>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>Transfer Amount</label>
              <input 
                type="number" 
                v-model="adjustmentForm.amount" 
                placeholder="Enter amount to transfer"
                :max="maxTransferAmount"
                min="0"
                step="0.01"
              />
              <div v-if="maxTransferAmount > 0" class="amount-hint">
                Max available: ₹{{ maxTransferAmount.toLocaleString() }}
              </div>
            </div>

            <div class="form-group">
              <label>Adjustment Date</label>
              <input 
                type="date" 
                v-model="adjustmentForm.adjustmentDate" 
                placeholder="Adjustment date"
              />
              <div class="date-hint">
                <small>Defaults to today if not specified</small>
              </div>
            </div>

            <button 
              class="transfer-btn" 
              @click="performTransfer" 
              :disabled="!canPerformTransfer"
            >
              Transfer Amount
            </button>
          </div>
        </div>

    </div>
    
    <StandardNotification
      :message="notificationMessage"
      :type="notificationType"
      :show="showNotification"
      :duration="4000"
      @close="showNotification = false"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useMembersStore } from '@/stores/MembersStore'
import StandardNotification from '@/components/standards/StandardNotification.vue'
import CustomerLedger from './ViewCollections/CustomerLedger.vue'

const groupsStore = useGroupsStore()
const collectionsStore = useCollectionsStore()
const membersStore = useMembersStore()

// Selection state
const customerSearch = ref('')
const groupSearch = ref('')
const selectedCustomerId = ref<number | null>(null)
const selectedGroupIds = ref<number[]>([])
const customerDropdownOpen = ref(false)
const groupDropdownOpen = ref(false)

// Data
const customers = ref<{ id: number; name: string }[]>([])
const groups = ref<{ id: number; name: string }[]>([])
const customerInstallmentData = ref<any[]>([])
const collectionsData = ref<any[]>([])
const errorMessage = ref('')

// Notification state
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref<'success' | 'error'>('success')

function showSuccessNotification(message: string) {
  notificationMessage.value = message
  notificationType.value = 'success'
  showNotification.value = true
}

function showErrorNotification(message: string) {
  notificationMessage.value = message
  notificationType.value = 'error'
  showNotification.value = true
}

// Adjustment form state
const adjustmentForm = ref({
  fromGroupId: '',
  fromInstallmentNumber: '',
  toGroupId: '',
  toInstallmentNumber: '',
  amount: '',
  adjustmentDate: ''
})

const fromInstallmentDropdownOpen = ref(false)
const toInstallmentDropdownOpen = ref(false)
const fromInstallmentSearch = ref('')
const toInstallmentSearch = ref('')

// Computed properties
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

const selectedGroupsText = computed(() => {
  if (selectedGroupIds.value.length === 0) return ''
  if (selectedGroupIds.value.length === 1) {
    const group = groups.value.find(g => g.id === selectedGroupIds.value[0])
    return group ? group.name : ''
  }
  return `${selectedGroupIds.value.length} groups selected`
})

const availableFromGroups = computed(() => {
  return groups.value.filter(g => selectedGroupIds.value.includes(g.id))
})

const availableToGroups = computed(() => {
  return groups.value.filter(g => selectedGroupIds.value.includes(g.id))
})

const fromInstallments = computed(() => {
  if (!adjustmentForm.value.fromGroupId) return []
  return customerInstallmentData.value.filter(
    installment => installment.groupId === parseInt(adjustmentForm.value.fromGroupId) && 
                  installment.excessShortage > 0 // Only installments with actual excess (positive excessShortage)
  )
})

const toInstallments = computed(() => {
  if (!adjustmentForm.value.toGroupId) return []
  return customerInstallmentData.value.filter(
    installment => installment.groupId === parseInt(adjustmentForm.value.toGroupId) && 
                  installment.excessShortage < 0 // Only installments with shortage (negative excessShortage)
  )
})

const filteredFromInstallments = computed(() => {
  const search = fromInstallmentSearch.value.toLowerCase()
  return fromInstallments.value.filter(inst => 
    inst.installmentNumber.toString().includes(search)
  )
})

const filteredToInstallments = computed(() => {
  const search = toInstallmentSearch.value.toLowerCase()
  return toInstallments.value.filter(inst => 
    inst.installmentNumber.toString().includes(search)
  )
})

const maxTransferAmount = computed(() => {
  if (!adjustmentForm.value.fromGroupId || !adjustmentForm.value.fromInstallmentNumber) return 0
  
  const fromInstallment = customerInstallmentData.value.find(
    inst => inst.groupId === parseInt(adjustmentForm.value.fromGroupId) && 
            inst.installmentNumber === parseInt(adjustmentForm.value.fromInstallmentNumber)
  )
  
  // Return the actual excess amount (should be positive for excess installments)
  return fromInstallment && fromInstallment.excessShortage > 0 ? fromInstallment.excessShortage : 0
})

const canPerformTransfer = computed(() => {
  return adjustmentForm.value.fromGroupId &&
         adjustmentForm.value.fromInstallmentNumber &&
         adjustmentForm.value.toGroupId &&
         adjustmentForm.value.toInstallmentNumber &&
         adjustmentForm.value.amount &&
         parseFloat(adjustmentForm.value.amount) > 0 &&
         parseFloat(adjustmentForm.value.amount) <= maxTransferAmount.value
})

const selectedCustomer = computed(() => {
  return customers.value.find(c => c.id === selectedCustomerId.value) || null
})

const selectedGroups = computed(() => {
  return groups.value.filter(g => selectedGroupIds.value.includes(g.id))
})

function getCollectionsForGroup(groupId: number) {
  return collectionsData.value.filter(collection => collection.group_id === groupId)
}

// Methods
function selectCustomer(customer: { id: number; name: string }) {
  selectedCustomerId.value = customer.id
  customerSearch.value = customer.name
  customerDropdownOpen.value = false
  
  // Reset data when customer changes
  customerInstallmentData.value = []
  collectionsData.value = []
  resetAdjustmentForm()
}

function toggleGroup(group: { id: number; name: string }) {
  const index = selectedGroupIds.value.indexOf(group.id)
  if (index > -1) {
    selectedGroupIds.value.splice(index, 1)
  } else {
    selectedGroupIds.value.push(group.id)
  }
  
  // Reset data when groups change
  customerInstallmentData.value = []
  collectionsData.value = []
  resetAdjustmentForm()
}

function selectAllGroups() {
  const allFilteredIds = filteredGroups.value.map(g => g.id)
  selectedGroupIds.value = [...new Set([...selectedGroupIds.value, ...allFilteredIds])]
  
  // Reset data when groups change
  customerInstallmentData.value = []
  collectionsData.value = []
  resetAdjustmentForm()
}

function clearAllGroups() {
  selectedGroupIds.value = []
  
  // Reset data when groups change
  customerInstallmentData.value = []
  collectionsData.value = []
  resetAdjustmentForm()
}

function resetAdjustmentForm() {
  adjustmentForm.value = {
    fromGroupId: '',
    fromInstallmentNumber: '',
    toGroupId: '',
    toInstallmentNumber: '',
    amount: '',
    adjustmentDate: ''
  }
}

function updateFromInstallments() {
  adjustmentForm.value.fromInstallmentNumber = ''
  fromInstallmentDropdownOpen.value = false
}

function updateToInstallments() {
  adjustmentForm.value.toInstallmentNumber = ''
  toInstallmentDropdownOpen.value = false
}

function selectFromInstallment(installment: any) {
  adjustmentForm.value.fromInstallmentNumber = installment.installmentNumber.toString()
  fromInstallmentDropdownOpen.value = false
  fromInstallmentSearch.value = ''
  
  // Auto-populate adjustment date with the latest collection date for this installment
  autoPopulateAdjustmentDate()
}

async function autoPopulateAdjustmentDate() {
  if (!adjustmentForm.value.fromGroupId || !adjustmentForm.value.fromInstallmentNumber || !selectedCustomerId.value) {
    return
  }
  
  try {
    // Find the latest collection date for this customer, group, and installment
    const groupId = parseInt(adjustmentForm.value.fromGroupId)
    const installmentNumber = parseInt(adjustmentForm.value.fromInstallmentNumber)
    
    // Get collections for this specific installment to find the latest date
    const collections = await collectionsStore.fetchCollectionsByCustomerAndDateRange(
      String(selectedCustomerId.value),
      groupId,
      '1900-01-01',
      new Date().toISOString().slice(0, 10)
    )
    
    // Filter for the specific installment and find the latest date
    const installmentCollections = collections.filter((c: any) => 
      c.installment_number === installmentNumber
    )
    
    if (installmentCollections.length > 0) {
      // Sort by collection date and get the latest
      installmentCollections.sort((a: any, b: any) => 
        new Date(b.collection_date).getTime() - new Date(a.collection_date).getTime()
      )
      adjustmentForm.value.adjustmentDate = installmentCollections[0].collection_date
    } else {
      // Default to today if no collections found
      adjustmentForm.value.adjustmentDate = new Date().toISOString().slice(0, 10)
    }
  } catch (error) {
    console.warn('Could not auto-populate adjustment date:', error)
    // Default to today on error
    adjustmentForm.value.adjustmentDate = new Date().toISOString().slice(0, 10)
  }
}

function selectToInstallment(installment: any) {
  adjustmentForm.value.toInstallmentNumber = installment.installmentNumber.toString()
  toInstallmentDropdownOpen.value = false
  toInstallmentSearch.value = ''
}

function getFromInstallmentText() {
  if (!adjustmentForm.value.fromInstallmentNumber) return ''
  const installment = fromInstallments.value.find(
    inst => inst.installmentNumber === parseInt(adjustmentForm.value.fromInstallmentNumber)
  )
  return installment ? 
    `Installment ${installment.installmentNumber} (Excess: ₹${installment.excessShortage.toLocaleString()})` : 
    `Installment ${adjustmentForm.value.fromInstallmentNumber}`
}

function getToInstallmentText() {
  if (!adjustmentForm.value.toInstallmentNumber) return ''
  const installment = toInstallments.value.find(
    inst => inst.installmentNumber === parseInt(adjustmentForm.value.toInstallmentNumber)
  )
  return installment ? 
    `Installment ${installment.installmentNumber} (Shortage: ₹${Math.abs(installment.excessShortage).toLocaleString()})` : 
    `Installment ${adjustmentForm.value.toInstallmentNumber}`
}

function getStatusClass(installment: any) {
  if (installment.excessShortage > 0) return 'excess'
  if (installment.excessShortage < 0) return 'pending'
  return 'completed'
}

function getStatusText(installment: any) {
  if (installment.excessShortage > 0) return 'Excess'
  if (installment.excessShortage < 0) return 'Shortage'
  return 'Exact'
}

function getAmountClass(installment: any) {
  if (installment.excessShortage > 0) return 'excess-amount'
  if (installment.excessShortage < 0) return 'shortage-amount'
  return 'exact-amount'
}

async function loadCustomerData() {
  if (!selectedCustomerId.value || selectedGroupIds.value.length === 0) {
    showErrorNotification('Please select a customer and at least one group')
    return
  }

  try {
    errorMessage.value = ''
    customerInstallmentData.value = []
    collectionsData.value = []

    // Fetch collection balances for each selected group
    const allInstallmentData: any[] = []
    const allCollections: any[] = []

    for (const groupId of selectedGroupIds.value) {
      try {
        // Use the same approach as CustomerWise - fetch collections and balances separately
        const [collectionsResponse, balancesResponse] = await Promise.all([
          collectionsStore.fetchCollectionsByCustomerAndDateRange(
            String(selectedCustomerId.value),
            groupId,
            '1900-01-01', // Get all historical data
            new Date().toISOString().slice(0, 10) // Until today
          ),
          collectionsStore.fetchCollectionBalances(groupId) // Get all balances for this group
        ])

        // Store all collections for CustomerLedger components
        allCollections.push(...collectionsResponse)

        const groupName = groups.value.find(g => g.id === groupId)?.name || `Group ${groupId}`

        // Filter balances for this specific customer
        const customerBalances = balancesResponse.filter((balance: any) => balance.member_id === selectedCustomerId.value)

        console.log(`Group ${groupId} - Customer balances:`, customerBalances.map((b: any) => ({
          installment: b.installment_number,
          total_paid: b.total_paid,
          remaining_balance: b.remaining_balance,
          monthly_subscription: b.monthly_subscription,
          subscription_amount: b.subscription_amount
        })))

        customerBalances.forEach((balance: any) => {
          // Get subscription amount for this installment
          const subscriptionAmount = balance.monthly_subscription || balance.subscription_amount
          
          // Calculate excess/shortage properly:
          // - If remaining_balance is negative, it means there's excess payment (overpaid)
          // - If remaining_balance is positive, it means there's shortage (underpaid)
          // - Only consider it as transferable excess if remaining_balance is actually negative
          let excessShortage = 0
          
          if (balance.remaining_balance < 0) {
            // Negative remaining balance = excess payment that can be transferred
            excessShortage = Math.abs(balance.remaining_balance)
          } else if (balance.remaining_balance > 0) {
            // Positive remaining balance = shortage that needs payment
            excessShortage = -balance.remaining_balance
          }
          // If remaining_balance is exactly 0, then excessShortage stays 0 (exact payment)

          allInstallmentData.push({
            groupId: groupId,
            groupName: groupName,
            installmentNumber: balance.installment_number,
            subscriptionAmount: subscriptionAmount || (balance.total_paid + Math.abs(balance.remaining_balance)),
            totalPaid: balance.total_paid,
            remainingBalance: balance.remaining_balance,
            excessShortage: excessShortage,
            isCompleted: balance.is_completed
          })
        })
      } catch (groupError) {
        console.warn(`Failed to load data for group ${groupId}:`, groupError)
      }
    }

    // Store collections data for CustomerLedger components
    collectionsData.value = allCollections

    if (allInstallmentData.length === 0) {
      showErrorNotification('No installment data found for the selected customer and groups')
      return
    }

    // Sort by group and installment number
    allInstallmentData.sort((a, b) => {
      if (a.groupId !== b.groupId) return a.groupId - b.groupId
      return a.installmentNumber - b.installmentNumber
    })

    customerInstallmentData.value = allInstallmentData
    
    // Debug: Log the calculated excess/shortage data
    console.log('Final installment data with excess/shortage:', allInstallmentData.map((inst: any) => ({
      group: inst.groupName,
      installment: inst.installmentNumber,
      totalPaid: inst.totalPaid,
      remainingBalance: inst.remainingBalance,
      excessShortage: inst.excessShortage,
      status: inst.excessShortage > 0 ? 'excess' : inst.excessShortage < 0 ? 'shortage' : 'exact'
    })))
    
    const excessInstallments = allInstallmentData.filter((inst: any) => inst.excessShortage > 0)
    const shortageInstallments = allInstallmentData.filter((inst: any) => inst.excessShortage < 0)
    
    console.log(`Found ${excessInstallments.length} installments with excess and ${shortageInstallments.length} with shortage`)
    
    if (excessInstallments.length === 0) {
      showErrorNotification('No installments with excess payment found for this customer. Excess payments occur when the remaining_balance is negative (customer has overpaid).')
    }
    
    resetAdjustmentForm()

  } catch (error: any) {
    console.error('Error loading customer data:', error)
    showErrorNotification(error?.response?.data?.message || 'Failed to load customer data')
  }
}

async function performTransfer() {
  if (!canPerformTransfer.value) {
    showErrorNotification('Please fill in all transfer details correctly')
    return
  }

  try {
    const transferAmount = parseFloat(adjustmentForm.value.amount)
    
    // Use the specified date or default to today
    const adjustmentDate = adjustmentForm.value.adjustmentDate || new Date().toISOString().slice(0, 10)
    
    // Call the backend API to perform the adjustment
    await collectionsStore.performCollectionAdjustment({
      customerId: selectedCustomerId.value!,
      fromGroupId: parseInt(adjustmentForm.value.fromGroupId),
      fromInstallmentNumber: parseInt(adjustmentForm.value.fromInstallmentNumber),
      toGroupId: parseInt(adjustmentForm.value.toGroupId),
      toInstallmentNumber: parseInt(adjustmentForm.value.toInstallmentNumber),
      amount: transferAmount,
      adjustmentDate: adjustmentDate
    })

    const fromGroup = groups.value.find(g => g.id === parseInt(adjustmentForm.value.fromGroupId))?.name
    const toGroup = groups.value.find(g => g.id === parseInt(adjustmentForm.value.toGroupId))?.name
    
    showSuccessNotification(`Successfully transferred ₹${transferAmount.toLocaleString()} from ${fromGroup} Installment ${adjustmentForm.value.fromInstallmentNumber} to ${toGroup} Installment ${adjustmentForm.value.toInstallmentNumber} on ${adjustmentDate}`)

    // Reload customer data to reflect the changes
    await loadCustomerData()

    // Reset form
    resetAdjustmentForm()

  } catch (error: any) {
    console.error('Error performing transfer:', error)
    if (error.message?.includes('not yet implemented')) {
      showErrorNotification('Collection adjustment feature requires backend API implementation. Please contact the developer to implement the /api/collections/adjust endpoint.')
    } else {
      showErrorNotification(error?.response?.data?.details || error?.response?.data?.message || 'Failed to perform transfer')
    }
  }
}

async function loadInitialData() {
  try {
    await Promise.all([
      groupsStore.fetchGroups(),
      membersStore.fetchMembers()
    ])
    
    groups.value = groupsStore.groups.map(g => ({ id: g.id, name: g.name }))
    customers.value = membersStore.members.map(m => ({ id: m.id, name: m.name }))
  } catch (error) {
    console.error('Error loading initial data:', error)
    showErrorNotification('Failed to load initial data')
  }
}

function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  if (!target.closest('.cs-dropdown')) {
    customerDropdownOpen.value = false
    groupDropdownOpen.value = false
    fromInstallmentDropdownOpen.value = false
    toInstallmentDropdownOpen.value = false
  }
}

onMounted(() => {
  loadInitialData()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.adjust-collections-bg {
  min-height: 100vh;
  padding: 2rem 0;
  background-color: #f8fafc;
}

.adjust-collections-container {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2.5rem 2rem;
  border-radius: 18px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
  background: #fff;
}

.card-header {
  text-align: center;
  margin-bottom: 2rem;
}

h3 {
  margin: 0 0 0.5rem 0;
  color: #1a237e;
  font-size: 2rem;
  letter-spacing: 1px;
}

.header-description {
  color: #666;
  font-size: 1rem;
  margin: 0;
}

.selection-section {
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
  position: relative;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #34495e;
  font-weight: 600;
}

input[type="number"], input[type="date"], select {
  width: 100%;
  padding: 0.7rem;
  border: 1.5px solid #b2bec3;
  border-radius: 6px;
  font-size: 1.05rem;
  background: #f8fafc;
  transition: border 0.2s;
}

input[type="number"]:focus, input[type="date"]:focus, select:focus {
  border-color: #2980b9;
  outline: none;
}

.submit-btn, .transfer-btn {
  padding: 0.8rem 2rem;
  background: linear-gradient(90deg, #2980b9 0%, #6dd5fa 100%);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(44, 62, 80, 0.08);
  transition: all 0.2s;
  white-space: nowrap;
}

.submit-btn:disabled, .transfer-btn:disabled {
  background: #b2bec3;
  cursor: not-allowed;
  box-shadow: none;
}

.submit-btn:not(:disabled):hover, .transfer-btn:not(:disabled):hover {
  background: linear-gradient(90deg, #1565c0 0%, #2196f3 100%);
  transform: translateY(-1px);
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
  transition: border 0.2s;
}

.cs-dropdown-selected:hover {
  border-color: #2980b9;
}

.cs-dropdown-arrow {
  margin-left: 0.5rem;
  font-size: 1.1em;
  transition: transform 0.2s;
}

.cs-dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #b2bec3;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 8px rgba(44, 62, 80, 0.1);
  margin-top: 2px;
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

.dropdown-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.action-btn {
  flex: 1;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.select-all-btn {
  background: #e3f2fd;
  color: #1976d2;
}

.select-all-btn:hover:not(:disabled) {
  background: #bbdefb;
}

.clear-all-btn {
  background: #fce4ec;
  color: #c2185b;
}

.clear-all-btn:hover:not(:disabled) {
  background: #f8bbd9;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cs-dropdown-item {
  padding: 0.7rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.cs-dropdown-item:hover {
  background: #e3f2fd;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-item input[type="checkbox"] {
  width: auto;
  margin: 0;
  cursor: pointer;
  transform: scale(1.1);
}

.checkbox-item.selected {
  background: #e8f5e8;
  font-weight: 600;
}

.checkbox-item:hover {
  background: #e3f2fd;
}

.checkbox-item.selected:hover {
  background: #d4edda;
}

.cs-dropdown-noresult {
  padding: 0.7rem 1rem;
  color: #888;
  font-style: italic;
}

.customer-data-section {
  margin-top: 2rem;
}

.customer-data-section h4 {
  margin-bottom: 1rem;
  color: #2c3e50;
  font-size: 1.3rem;
}

.table-responsive {
  overflow-x: auto;
  margin-bottom: 2rem;
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

.status.excess {
  background: #f3e5f5;
  color: #7b1fa2;
}

.excess-amount {
  color: #7b1fa2;
  font-weight: 600;
}

.shortage-amount {
  color: #d32f2f;
  font-weight: 600;
}

.exact-amount {
  color: #388e3c;
  font-weight: 600;
}

.adjustment-form {
  background: #f8f9fa;
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.adjustment-form h4 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
  font-size: 1.3rem;
}

.adjustment-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  align-items: end;
}

.amount-hint {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
}

.date-hint {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
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

.group-ledger-section {
  margin-bottom: 2rem;
}

.group-ledger-title {
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  background: #e3f2fd;
  border-radius: 8px;
  border-left: 4px solid #2196f3;
}

.no-data-message {
  text-align: center;
  color: #666;
  font-size: 1.1rem;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

@media (max-width: 900px) {
  .adjust-collections-container {
    padding: 1.2rem 0.5rem;
  }
  
  .selection-section {
    flex-direction: column;
    gap: 1rem;
  }
  
  .adjustment-controls {
    grid-template-columns: 1fr;
  }
  
  th, td {
    padding: 0.7rem 0.5rem;
  }
}
</style>
