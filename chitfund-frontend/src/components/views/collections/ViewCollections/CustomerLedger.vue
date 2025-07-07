<template>
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
              <td>
                <span v-if="typeof installment.subscriptionAmount === 'number'">
                  ₹{{ installment.subscriptionAmount.toLocaleString() }}
                </span>
                <span v-else-if="installment.isCompleted">
                  ₹{{ installment.totalPaid.toLocaleString() }}
                  <small class="muted-text">(completed)</small>
                </span>
                <span v-else>-</span>
              </td>
              <td>₹{{ installment.totalPaid.toLocaleString() }}</td>
              <td>
                <span :class="['status', getInstallmentStatusClass(installment)]">
                  {{ getInstallmentStatusText(installment) }}
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
                          <span :class="['status', getTransactionStatusClass(transaction)]">
                            {{ getTransactionStatusText(transaction) }}
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
  <div v-else-if="!collections.length && customer && group" class="no-data">
    <img src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png" alt="No Data" class="no-data-img" />
    <div>No collections found for {{ customer.name }} in {{ group.name }}.</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'

// Props
interface Props {
  customer: { id: number; name: string } | null
  group: { id: number; name: string; total_amount?: number; member_count?: number } | null
  collections: any[]
}

const props = defineProps<Props>()

// Reactive data
const expandedInstallments = ref<number[]>([])
const totalInstallments = ref(0)
const totalAmount = ref(0)

// Computed property to organize collections by installment
const installmentData = computed(() => {
  if (!props.collections.length || !props.group) return []

  // Group collections by installment number
  const installmentMap = new Map<number, any[]>()
  
  // Sort collections by installment number first
  const sortedCollections = [...props.collections].sort((a, b) => {
    return a.installment_number - b.installment_number
  })
  
  sortedCollections.forEach(collection => {
    const instNum = collection.installment_number
    if (!installmentMap.has(instNum)) {
      installmentMap.set(instNum, [])
    }
    installmentMap.get(instNum)!.push(collection)
  })
  
  // Sort transactions within each installment by collection_date descending (most recent first for finding latest)
  installmentMap.forEach((transactions, installmentNumber) => {
    transactions.sort((a, b) => {
      // First sort by collection_date (most recent first), then by created_at if dates are the same
      const dateA = new Date(a.collection_date || a.created_at || 0)
      const dateB = new Date(b.collection_date || b.created_at || 0)
      return dateB.getTime() - dateA.getTime()
    })
  })
  
  // Convert to array of installment data
  const result = Array.from(installmentMap.entries()).map(([installmentNumber, transactions]) => {
    // Calculate totals for this installment
    const totalPaid = transactions.reduce((sum, t) => sum + (t.collection_amount || 0), 0)

    // Find the transaction with the latest collection_date to get the most current remaining balance
    const latestTransaction = transactions.reduce((latest, current) => {
      const latestDate = new Date(latest.collection_date || latest.created_at || 0)
      const currentDate = new Date(current.collection_date || current.created_at || 0)
      return currentDate > latestDate ? current : latest
    })

    // Get the subscription amount with improved hierarchy of sources
    let subscriptionAmount;
    
    // 1. First, check if any transaction has monthly_subscription
    const transWithMonthlySubscription = transactions.find(t => typeof t.monthly_subscription === 'number');
    
    // 2. Then check if any transaction has subscription_amount
    const transWithSubscriptionAmount = transactions.find(t => typeof t.subscription_amount === 'number');
    
    // 3. Try to get monthly_subscription from any transaction in this installment
    if (transWithMonthlySubscription) {
      subscriptionAmount = transWithMonthlySubscription.monthly_subscription;
    }
    // 4. Fallback to subscription_amount if monthly_subscription is not available
    else if (transWithSubscriptionAmount) {
      subscriptionAmount = transWithSubscriptionAmount.subscription_amount;
    
    }
    // 5. Try from latestTransaction as a last resort
    else if (latestTransaction && typeof latestTransaction.monthly_subscription === 'number') {
      subscriptionAmount = latestTransaction.monthly_subscription;
      
    }
    else if (latestTransaction && typeof latestTransaction.subscription_amount === 'number') {
      subscriptionAmount = latestTransaction.subscription_amount;
      
    }
    // Otherwise undefined
    else {
      subscriptionAmount = undefined;
     
      if (latestTransaction) {
        console.log(`Available fields:`, Object.keys(latestTransaction));
      }
    }

    let pendingBalance = 0
    let isCompleted = false

    if (latestTransaction && typeof latestTransaction.updated_remaining_balance === 'number') {
      // Use the remaining balance from the transaction with the latest date
      pendingBalance = latestTransaction.updated_remaining_balance
      // If latest transaction is completed OR remaining balance is 0, then installment is completed
      isCompleted = latestTransaction.is_completed === true || pendingBalance === 0
    } else {
      // Fallback: calculate pending based on subscription amount if available
      pendingBalance = subscriptionAmount ? Math.max(0, subscriptionAmount - totalPaid) : 0
      isCompleted = pendingBalance === 0
    }

    // Sort transactions for display (oldest first based on created_at for chronological order)
    const displayTransactions = [...transactions].sort((a, b) => {
      const dateA = new Date(a.created_at || a.collection_date || 0)
      const dateB = new Date(b.created_at || b.collection_date || 0)
      return dateA.getTime() - dateB.getTime() // Oldest first (ascending)
    })

    return {
      installmentNumber,
      subscriptionAmount, // Use per-installment subscription amount or undefined
      totalPaid,
      pendingBalance,
      isCompleted, // Use the calculated isCompleted variable
      transactions: displayTransactions
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

// Functions
function toggleInstallment(installmentNumber: number) {
  const index = expandedInstallments.value.indexOf(installmentNumber)
  if (index > -1) {
    expandedInstallments.value.splice(index, 1)
  } else {
    expandedInstallments.value.push(installmentNumber)
  }
}

// Status helper functions for installments
function getInstallmentStatusClass(installment: any): string {
  // Check if installment is completed first
  if (installment.isCompleted) {
    return 'completed'
  }
  
  // Check for excess payment (negative pending balance)
  if (installment.pendingBalance < 0) {
    return 'excess'
  }
  
  const hasExcess = installment.totalPaid > installment.subscriptionAmount
  
  if (hasExcess) {
    return 'excess'
  } else {
    return 'pending'
  }
}

function getInstallmentStatusText(installment: any): string {
  // Check if installment is completed first
  if (installment.isCompleted) {
    return 'Completed'
  }
  
  // Check for excess payment (negative pending balance)
  if (installment.pendingBalance < 0) {
    const excessAmount = Math.abs(installment.pendingBalance)
    return `Excess: ₹${excessAmount.toLocaleString()}`
  }
  
  const hasExcess = installment.totalPaid > installment.subscriptionAmount
  
  if (hasExcess) {
    const excessAmount = installment.totalPaid - installment.subscriptionAmount
    return `Excess: ₹${excessAmount.toLocaleString()}`
  } else {
    return `Pending: ₹${installment.pendingBalance.toLocaleString()}`
  }
}

// Status helper functions for individual transactions
function getTransactionStatusClass(transaction: any): string {
  if (transaction.is_completed) {
    return 'completed'
  }
  
  // Check if remaining balance is negative (excess payment)
  if (transaction.updated_remaining_balance < 0) {
    return 'excess'
  }
  
  return 'pending'
}

function getTransactionStatusText(transaction: any): string {
  if (transaction.is_completed) {
    return 'Completed'
  }
  
  // Check if remaining balance is negative (excess payment)
  if (transaction.updated_remaining_balance < 0) {
    return 'Excess'
  }
  
  return 'Pending'
}
</script>

<style scoped>
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
.status.excess {
  background: #f3e8ff;
  color: #7c3aed;
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

@media (max-width: 900px) {
  th, td {
    padding: 0.7rem 0.5rem;
  }
}
</style>
