<template>
  <div class="installment-balance-display">
    <div 
      v-for="balance in displayBalances" 
      :key="balance.installmentNumber"
      class="balance-row"
    >
      <div class="installment-label">Inst-{{ balance.installmentNumber }}:</div>
      <div class="balance-values">
        <span class="original-balance">₹{{ balance.originalBalance.toLocaleString() }}</span>
        <span class="arrow">→</span>
        <span 
          class="updated-balance"
          :class="{ 'completed': balance.updatedBalance <= 0, 'partial': balance.updatedBalance > 0 && balance.updatedBalance < balance.originalBalance }"
        >
          ₹{{ balance.updatedBalance.toLocaleString() }}
        </span>
      </div>
    </div>
    <div v-if="!displayBalances.length" class="no-data">
      <span class="placeholder-text">Enter installment to see balance</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { CollectionBalance } from '@/stores/CollectionsStore'

interface Props {
  memberId: number
  installmentNumbers: string // e.g., "1c,2,3"
  collectionAmount: number
  memberBalances: CollectionBalance[]
  monthlySubscription: number
  isAfterSubmission?: boolean // New prop to indicate data source
  submittedCollections?: any[] // Collection records after submission
}

interface BalanceDisplay {
  installmentNumber: number
  originalBalance: number
  updatedBalance: number
  isCompleted: boolean
}

const props = defineProps<Props>()

const displayBalances = computed((): BalanceDisplay[] => {
  if (!props.installmentNumbers || props.collectionAmount <= 0) {
    return []
  }

  // Parse installment numbers from string like "1c,2,3"
  const installmentNums = props.installmentNumbers
    .split(',')
    .map(inst => {
      const cleanInst = inst.trim().replace('c', '')
      return parseInt(cleanInst)
    })
    .filter(num => !isNaN(num))
    .sort((a, b) => a - b)

  if (installmentNums.length === 0) {
    return []
  }

  if (props.isAfterSubmission && props.submittedCollections) {
    // After submission: Use collection table data
    return getBalancesFromCollectionData(installmentNums)
  } else {
    // Before submission: Use collection_balance table data
    return getBalancesFromBalanceData(installmentNums)
  }
})

function getBalancesFromBalanceData(installmentNums: number[]): BalanceDisplay[] {
  const memberBalances = props.memberBalances
    .filter(b => b.member_id === props.memberId)
    .sort((a, b) => a.installment_number - b.installment_number)

  const results: BalanceDisplay[] = []
  let remainingAmount = props.collectionAmount

  for (const instNum of installmentNums) {
    const balance = memberBalances.find(b => b.installment_number === instNum)
    
    if (balance) {
      // Use the actual remaining balance from the database for this specific installment
      const originalBalance = balance.remaining_balance
      let updatedBalance = originalBalance

      if (remainingAmount > 0 && originalBalance > 0) {
        const payAmount = Math.min(remainingAmount, originalBalance)
        updatedBalance = originalBalance - payAmount
        remainingAmount -= payAmount
      }

      results.push({
        installmentNumber: instNum,
        originalBalance,
        updatedBalance,
        isCompleted: updatedBalance <= 0
      })
    } else {
      // If no balance record exists, assume monthly subscription amount
      const originalBalance = props.monthlySubscription
      let updatedBalance = originalBalance

      if (remainingAmount > 0) {
        const payAmount = Math.min(remainingAmount, originalBalance)
        updatedBalance = originalBalance - payAmount
        remainingAmount -= payAmount
      }

      results.push({
        installmentNumber: instNum,
        originalBalance,
        updatedBalance,
        isCompleted: updatedBalance <= 0
      })
    }
  }

  return results
}

function getBalancesFromCollectionData(installmentNums: number[]): BalanceDisplay[] {
  const results: BalanceDisplay[] = []
  const memberCollections = props.submittedCollections?.filter(c => c.member_id === props.memberId) || []

  for (const instNum of installmentNums) {
    const collection = memberCollections.find(c => c.installment_number === instNum)
    
    if (collection) {
      // For submitted collections:
      // - originalBalance is the remaining_balance (what was owed before payment)
      // - updatedBalance is the updated_remaining_balance (what's owed after payment)
      const originalBalance = collection.remaining_balance
      const updatedBalance = collection.updated_remaining_balance || (collection.remaining_balance - collection.collection_amount)

      results.push({
        installmentNumber: instNum,
        originalBalance,
        updatedBalance,
        isCompleted: collection.is_completed || updatedBalance <= 0
      })
    } else {
      // No collection record for this installment
      const originalBalance = props.monthlySubscription
      results.push({
        installmentNumber: instNum,
        originalBalance,
        updatedBalance: originalBalance,
        isCompleted: false
      })
    }
  }

  return results
}
</script>

<style scoped>
.installment-balance-display {
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  min-height: 2rem;
}

.balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
}

.balance-row:last-child {
  margin-bottom: 0;
}

.installment-label {
  font-weight: 600;
  color: #2c3e50;
  min-width: 4rem;
}

.balance-values {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.original-balance {
  color: #e74c3c;
  font-weight: 500;
}

.arrow {
  color: #7f8c8d;
  font-weight: bold;
}

.updated-balance {
  font-weight: 600;
}

.updated-balance.completed {
  color: #27ae60;
}

.updated-balance.partial {
  color: #f39c12;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2rem;
}

.placeholder-text {
  color: #95a5a6;
  font-style: italic;
  font-size: 0.8rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .balance-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .balance-values {
    align-self: flex-end;
  }
}
</style>
