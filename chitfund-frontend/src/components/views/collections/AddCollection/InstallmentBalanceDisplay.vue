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
          :class="{ 
            'completed': balance.status === 'completed', 
            'partial': balance.status === 'pending',
            'excess': balance.status === 'excess'
          }"
        >
          <template v-if="balance.status === 'excess'">
            ₹0 (+₹{{ Math.abs(balance.updatedBalance).toLocaleString() }} excess)
          </template>
          <template v-else>
            ₹{{ Math.abs(balance.updatedBalance).toLocaleString() }}
          </template>
        </span>
        <span class="status-indicator" :class="`status-${balance.status}`">
          {{ balance.status }}
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
  installmentNumbers: string // e.g., "1c,2,3" or "3:3400,4:5500"
  collectionAmount: number
  memberBalances: CollectionBalance[] // Only incomplete balances
  monthlySubscription: number
  isAfterSubmission?: boolean // New prop to indicate data source
  submittedCollections?: any[] // Collection records after submission
  installmentAmounts?: { [key: number]: number } // Specific amounts per installment
  allMemberBalances?: CollectionBalance[] // All balances (including completed) for checking completion status
}

interface BalanceDisplay {
  installmentNumber: number
  originalBalance: number
  updatedBalance: number
  isCompleted: boolean
  status: 'pending' | 'completed' | 'excess'
  collectionAmount?: number
}

const props = defineProps<Props>()

const displayBalances = computed((): BalanceDisplay[] => {
  if (!props.installmentNumbers || props.collectionAmount <= 0) {
    return []
  }

  // Parse installment numbers from string like "1c,2,3" or "3:3400,4:5500"
  const parseResult = parseInstallmentString(props.installmentNumbers)
  
  if (parseResult.installments.length === 0) {
    return []
  }

  if (props.isAfterSubmission && props.submittedCollections) {
    // After submission: Use collection table data
    return getBalancesFromCollectionData(parseResult)
  } else {
    // Before submission: Use collection_balance table data
    return getBalancesFromBalanceData(parseResult)
  }
})

function parseInstallmentString(input: string): { 
  installments: number[], 
  specificAmounts: { [key: number]: number },
  hasSpecificAmounts: boolean 
} {
  const installments: number[] = []
  const specificAmounts: { [key: number]: number } = {}
  let hasSpecificAmounts = false

  if (input.includes(':')) {
    // Format: "3:3400,4:5500"
    hasSpecificAmounts = true
    const parts = input.split(',').map(part => part.trim())
    
    for (const part of parts) {
      if (part.includes(':')) {
        const [instStr, amountStr] = part.split(':')
        const instNum = parseInt(instStr.trim())
        const amount = parseFloat(amountStr.trim())
        
        if (!isNaN(instNum) && !isNaN(amount)) {
          installments.push(instNum)
          specificAmounts[instNum] = amount
        }
      }
    }
  } else {
    // Regular format: "1c,2,3"
    const parts = input.split(',').map(inst => {
      const cleanInst = inst.trim().replace('c', '')
      return parseInt(cleanInst)
    }).filter(num => !isNaN(num))
    
    installments.push(...parts)
  }

  return {
    installments: installments.sort((a, b) => a - b),
    specificAmounts,
    hasSpecificAmounts
  }
}

function getStatus(originalBalance: number, updatedBalance: number, collectionAmount: number): 'pending' | 'completed' | 'excess' {
  if (updatedBalance < 0) {
    // Negative balance means excess payment
    return 'excess'
  } else if (updatedBalance === 0) {
    return 'completed'
  } else {
    return 'pending'
  }
}

function getBalancesFromBalanceData(parseResult: { 
  installments: number[], 
  specificAmounts: { [key: number]: number },
  hasSpecificAmounts: boolean 
}): BalanceDisplay[] {
  const memberBalances = props.memberBalances
    .filter(b => b.member_id === props.memberId)
    .sort((a, b) => a.installment_number - b.installment_number)

  const results: BalanceDisplay[] = []
  let remainingAmount = props.collectionAmount

  // Check if we have manually specified installments
  // Treat as manual if:
  // 1. Has specific amounts (with :) OR
  // 2. Single installment with 'c' suffix (e.g., "2c") OR  
  // 3. Installments don't follow auto-calculated pattern (not starting from first unpaid)
  const isSingleInstallmentWithC = props.installmentNumbers.includes('c') && parseResult.installments.length === 1
  const hasManualInstallments = parseResult.hasSpecificAmounts || isSingleInstallmentWithC || 
    !isAutoCalculatedPattern(parseResult.installments, memberBalances)
  
  for (const instNum of parseResult.installments) {
    // Check if this installment exists in all balances (complete or incomplete)
    const allBalance = props.allMemberBalances?.find(b => 
      b.member_id === props.memberId && b.installment_number === instNum
    )
    
    // Skip truly completed installments (is_completed = 1 AND remaining_balance = 0)
    // But show installments with excess (is_completed = 0 AND remaining_balance < 0)
    if (allBalance && allBalance.is_completed && allBalance.remaining_balance === 0) {
      continue // Don't show truly completed installments (no excess)
    }
    
    // Find the balance - now excess installments will be in memberBalances since is_completed = 0
    const balance = memberBalances.find(b => b.installment_number === instNum) || allBalance
    const specificAmount = parseResult.specificAmounts[instNum]
    
    if (balance) {
      // Use the actual remaining balance from the database for this specific installment
      const originalBalance = balance.remaining_balance
      let updatedBalance = originalBalance
      let collectionAmount = 0

      if (parseResult.hasSpecificAmounts && specificAmount !== undefined) {
        // Use specific amount for this installment - apply exactly what user specified
        collectionAmount = specificAmount
        updatedBalance = originalBalance - collectionAmount
      } else if (isSingleInstallmentWithC) {
        // Single installment with 'c' - apply ALL amount to this installment (allow excess)
        collectionAmount = props.collectionAmount
        updatedBalance = originalBalance - collectionAmount
      } else if (hasManualInstallments) {
        // Manual installments specified - handle based on count
        if (parseResult.installments.length === 1) {
          // Single manual installment - apply full amount to this installment
          collectionAmount = props.collectionAmount
          updatedBalance = originalBalance - collectionAmount
        } else {
          // Multiple manual installments - distribute proportionally based on their remaining balances
          const totalOriginalBalance = parseResult.installments.reduce((sum, instNum) => {
            const bal = memberBalances.find(b => b.installment_number === instNum)
            return sum + (bal ? Math.max(bal.remaining_balance, 0) : 0) // Changed from props.monthlySubscription to 0
          }, 0)
          
          if (totalOriginalBalance > 0) {
            collectionAmount = (Math.max(originalBalance, 0) / totalOriginalBalance) * props.collectionAmount
          } else {
            collectionAmount = props.collectionAmount / parseResult.installments.length
          }
          updatedBalance = originalBalance - collectionAmount
        }
      } else if (remainingAmount > 0) {
        // Auto-distribute amount (sequential distribution)
        // For auto-distribution, follow backend logic: fill each installment exactly, put excess only in last
        if (originalBalance > 0) {
          const isLastInstallment = instNum === parseResult.installments[parseResult.installments.length - 1]
          
          if (isLastInstallment) {
            // Last installment gets all remaining amount (including excess)
            collectionAmount = remainingAmount
            updatedBalance = originalBalance - collectionAmount
            remainingAmount = 0
          } else {
            // Other installments get only what they need (no excess)
            collectionAmount = Math.min(remainingAmount, originalBalance)
            updatedBalance = originalBalance - collectionAmount
            remainingAmount -= collectionAmount
          }
        }
      }

      const status = getStatus(originalBalance, updatedBalance, collectionAmount)

      results.push({
        installmentNumber: instNum,
        originalBalance,
        updatedBalance: Math.round(updatedBalance * 100) / 100, // Round to 2 decimal places
        isCompleted: updatedBalance <= 0,
        status,
        collectionAmount: Math.round(collectionAmount * 100) / 100 // Round to 2 decimal places
      })
    } else if (!allBalance) {
      // Only show if no balance record exists at all (new installment)
      // If balance exists and is completed, we already handled it above
      // For manually entered installments without balance records, use 0 as default instead of monthly subscription
      
      const originalBalance = 0 // Changed from props.monthlySubscription to 0
      let updatedBalance = originalBalance
      let collectionAmount = 0

      if (parseResult.hasSpecificAmounts && specificAmount !== undefined) {
        collectionAmount = specificAmount
        updatedBalance = originalBalance - collectionAmount
      } else if (hasManualInstallments) {
        if (parseResult.installments.length === 1) {
          collectionAmount = props.collectionAmount
        } else {
          collectionAmount = props.collectionAmount / parseResult.installments.length
        }
        updatedBalance = originalBalance - collectionAmount
      } else if (remainingAmount > 0) {
        // Auto-distribute amount (sequential distribution)
        // For auto-distribution, follow backend logic: fill each installment exactly, put excess only in last
        const isLastInstallment = instNum === parseResult.installments[parseResult.installments.length - 1]
        
        if (isLastInstallment) {
          // Last installment gets all remaining amount (including excess)
          collectionAmount = remainingAmount
          updatedBalance = originalBalance - collectionAmount
          remainingAmount = 0
        } else {
          // Other installments get only what they need (no excess)
          collectionAmount = Math.min(remainingAmount, originalBalance || props.collectionAmount)
          updatedBalance = originalBalance - collectionAmount
          remainingAmount -= collectionAmount
        }
      }

      const status = getStatus(originalBalance, updatedBalance, collectionAmount)

      results.push({
        installmentNumber: instNum,
        originalBalance,
        updatedBalance: Math.round(updatedBalance * 100) / 100,
        isCompleted: updatedBalance <= 0,
        status,
        collectionAmount: Math.round(collectionAmount * 100) / 100
      })
    }
  }

  return results
}

function getBalancesFromCollectionData(parseResult: { 
  installments: number[], 
  specificAmounts: { [key: number]: number },
  hasSpecificAmounts: boolean 
}): BalanceDisplay[] {
  const results: BalanceDisplay[] = []
  const memberCollections = props.submittedCollections?.filter(c => c.member_id === props.memberId) || []

  for (const instNum of parseResult.installments) {
    const collection = memberCollections.find(c => c.installment_number === instNum)
    
    if (collection) {
      // For submitted collections:
      // - originalBalance is the remaining_balance (what was owed before payment)
      // - updatedBalance is the updated_remaining_balance (what's owed after payment)
      const originalBalance = collection.remaining_balance
      const updatedBalance = collection.updated_remaining_balance || (collection.remaining_balance - collection.collection_amount)
      const collectionAmount = collection.collection_amount
      const status = getStatus(originalBalance, updatedBalance, collectionAmount)

      results.push({
        installmentNumber: instNum,
        originalBalance,
        updatedBalance,
        isCompleted: collection.is_completed || updatedBalance <= 0,
        status,
        collectionAmount
      })
    } else {
      // No collection record for this installment
      const originalBalance = 0 // Changed from props.monthlySubscription to 0
      const status = 'pending'

      results.push({
        installmentNumber: instNum,
        originalBalance,
        updatedBalance: originalBalance,
        isCompleted: false,
        status,
        collectionAmount: 0
      })
    }
  }

  return results
}

// Helper function to detect if installments follow auto-calculated pattern
function isAutoCalculatedPattern(installments: number[], memberBalances: CollectionBalance[]): boolean {
  if (installments.length === 0) return false
  
  // Find the first unpaid installment for this member
  const unpaidBalances = memberBalances
    .filter(b => b.member_id === props.memberId && !b.is_completed && b.remaining_balance > 0)
    .sort((a, b) => a.installment_number - b.installment_number)
  
  if (unpaidBalances.length === 0) return false
  
  const firstUnpaid = unpaidBalances[0].installment_number
  const sortedInstallments = [...installments].sort((a, b) => a - b)
  
  // Auto-calculated pattern should start from the first unpaid installment
  if (sortedInstallments[0] !== firstUnpaid) return false
  
  // And should be consecutive
  for (let i = 1; i < sortedInstallments.length; i++) {
    if (sortedInstallments[i] !== sortedInstallments[i-1] + 1) {
      return false
    }
  }
  
  return true
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

.updated-balance.excess {
  color: #8e44ad;
  font-weight: 700;
}

.status-indicator {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  margin-left: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-pending {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-completed {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-excess {
  background-color: #e2d1f3;
  color: #6f42c1;
  border: 1px solid #d1b3ff;
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
    flex-wrap: wrap;
  }
  
  .status-indicator {
    font-size: 0.65rem;
    padding: 0.1rem 0.3rem;
  }
}
</style>
