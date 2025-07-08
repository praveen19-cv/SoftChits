<template>
  <div class="installment-calculator">
    <input
      type="text"
      :value="displayValue"
      @input="handleInstallmentInput"
      @blur="handleInstallmentBlur"
      @focus="handleInstallmentFocus"
      :placeholder="placeholderText"
      class="installment-input"
      :class="{ 
        'auto-calculated': isAutoCalculated && !isUserEdited && props.collectionAmount <= 0,
        'auto-filled': isAutoCalculated && !isUserEdited && props.collectionAmount > 0
      }"
      title="Format: '3,4' for installments or '3:3400,4:5500' for specific amounts"
    />
    <small v-if="isAutoCalculated && !isUserEdited && props.collectionAmount <= 0" class="auto-indicator">Auto-calculated</small>
    <small v-else-if="isAutoCalculated && !isUserEdited && props.collectionAmount > 0" class="auto-filled-indicator">Auto-filled</small>
    <small v-else-if="hasSpecificAmounts" class="format-indicator">Specific amounts</small>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import type { CollectionBalance } from '@/stores/CollectionsStore'

interface Props {
  memberId: number
  collectionAmount: number
  memberBalances: CollectionBalance[]
  monthlySubscription: number
  modelValue: string
  isAfterSubmission?: boolean
  submittedCollections?: any[]
  installmentAmounts?: { [key: number]: number } // New prop for specific amounts
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'installment-change', installment: string): void
  (e: 'update:installmentAmounts', amounts: { [key: number]: number }): void // New emit for specific amounts
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isUserEdited = ref(false)
const isAutoCalculated = ref(true)

const displayValue = computed(() => {
  // Always show the current modelValue if user has edited or if there's content
  if (isUserEdited.value || props.modelValue) {
    return props.modelValue
  }
  
  // If auto-calculated and user hasn't edited AND no amount entered, show empty string (so placeholder shows)
  if (isAutoCalculated.value && !isUserEdited.value && props.collectionAmount <= 0) {
    return ''
  }
  
  // If amount is entered and installments are auto-calculated, show the calculated value
  return props.modelValue
})

const hasSpecificAmounts = computed(() => {
  return props.modelValue.includes(':')
})

const placeholderText = computed(() => {
  // If auto-calculated and no amount entered yet, show the calculated value in placeholder
  if (isAutoCalculated.value && !isUserEdited.value && props.collectionAmount <= 0) {
    const currentInstallment = getCurrentInstallmentNumber()
    return currentInstallment ? `Auto: ${currentInstallment}` : 'e.g., 3,4 or 3:3400,4:5500'
  }
  
  // If amount is entered and auto-calculated, just show helpful text
  if (isAutoCalculated.value && !isUserEdited.value && props.collectionAmount > 0) {
    return 'Auto-calculated from amount'
  }
  
  const currentInstallment = getCurrentInstallmentNumber()
  return currentInstallment ? `Current: ${currentInstallment}` : 'e.g., 3,4 or 3:3400,4:5500'
})

function getCurrentInstallmentNumber(): number {
  // Find the first unpaid installment for this specific member
  const memberBalances = props.memberBalances
    .filter(b => b.member_id === props.memberId && !b.is_completed && b.remaining_balance > 0)
    .sort((a, b) => a.installment_number - b.installment_number)
  
  return memberBalances[0]?.installment_number || 1
}

function calculateAutoInstallment(): string {
  // If after submission, only show data for members who actually have submitted collections
  if (props.isAfterSubmission && props.submittedCollections) {
    const memberCollections = props.submittedCollections.filter(c => c.member_id === props.memberId)
    if (memberCollections.length > 0) {
      // IMPORTANT: Since we now create separate rows for each collection,
      // we should only return the installment for THIS specific row's collection
      // The row should already have the correct installment number set by AddCollection.vue
      // So we should not be auto-calculating here for after submission mode
      // Return the current modelValue as-is if it exists
      if (props.modelValue && props.modelValue.trim()) {
        return props.modelValue
      }
      
      // Fallback: if no modelValue, return the first collection's installment
      const firstCollection = memberCollections[0]
      return `${firstCollection.installment_number}${firstCollection.is_completed ? 'c' : ''}`
    } else {
      // Member has no collections on this date - return empty string
      return ''
    }
  }

  if (props.collectionAmount <= 0 || !props.monthlySubscription) {
    return getCurrentInstallmentNumber().toString()
  }

  // Check if we have specific amounts set
  if (props.installmentAmounts && Object.keys(props.installmentAmounts).length > 0) {
    // Return the installments with specific amounts
    return Object.keys(props.installmentAmounts)
      .map(inst => `${inst}:${props.installmentAmounts![parseInt(inst)]}`)
      .join(',')
  }

  // Use only incomplete balances (which are already filtered)
  const memberBalances = props.memberBalances
    .filter(b => b.member_id === props.memberId && !b.is_completed && b.remaining_balance > 0)
    .sort((a, b) => a.installment_number - b.installment_number)

  if (memberBalances.length === 0) {
    // No incomplete balances exist, start from installment 1
    const numCompleteInstallments = Math.floor(props.collectionAmount / props.monthlySubscription)
    const remainder = props.collectionAmount % props.monthlySubscription
    
    const installments = []
    for (let i = 1; i <= numCompleteInstallments; i++) {
      installments.push(`${i}c`)
    }
    if (remainder > 0) {
      installments.push(`${numCompleteInstallments + 1}`)
    }
    
    return installments.join(',')
  }

  // Use existing incomplete balances to calculate installments
  let remainingAmount = props.collectionAmount
  const installments = []

  for (const balance of memberBalances) {
    if (remainingAmount <= 0) break
    
    // Process only incomplete installments with remaining balance
    const payAmount = Math.min(remainingAmount, balance.remaining_balance)
    const newBalance = balance.remaining_balance - payAmount
    
    if (newBalance <= 0) {
      installments.push(`${balance.installment_number}c`)
    } else {
      installments.push(`${balance.installment_number}`)
    }
    
    remainingAmount -= payAmount
  }
  
  return installments.join(',')
}

function handleInstallmentInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value
  
  // Mark as user-edited whenever user types anything (including clearing the field)
  isUserEdited.value = true
  isAutoCalculated.value = false
  
  // Parse and handle specific amounts format
  parseAndEmitInstallmentData(value)
  
  emit('update:modelValue', value)
  emit('installment-change', value)
}

function parseAndEmitInstallmentData(value: string) {
  const installmentAmounts: { [key: number]: number } = {}
  
  // Only treat as specific amounts if it contains ':' (e.g., "3:3400,4:5500")
  // Do NOT treat "2c,3" or "2,3" as specific amounts
  if (value.includes(':')) {
    // Parse format like "3:3400,4:5500"
    const parts = value.split(',').map(part => part.trim())
    let totalAmount = 0
    
    for (const part of parts) {
      if (part.includes(':')) {
        const [instStr, amountStr] = part.split(':')
        const instNum = parseInt(instStr.trim())
        const amount = parseFloat(amountStr.trim())
        
        if (!isNaN(instNum) && !isNaN(amount)) {
          installmentAmounts[instNum] = amount
          totalAmount += amount
        }
      }
    }
    
    // Update the total amount in the parent component
    if (totalAmount > 0) {
      // We'll need to emit this to update the amount field
      emit('update:installmentAmounts', installmentAmounts)
    }
  } else {
    // Regular format (including "2c,3" and "2,3"), clear specific amounts
    emit('update:installmentAmounts', {})
  }
}

function handleInstallmentBlur() {
  // Don't reset to auto-calculated on blur - preserve user input
  // Only reset if the field is completely empty
  const value = props.modelValue.trim()
  
  if (!value) {
    // Only reset to auto-calculated if truly empty
    isUserEdited.value = false
    isAutoCalculated.value = true
    const autoValue = calculateAutoInstallment()
    emit('update:modelValue', autoValue)
    emit('installment-change', autoValue)
  }
  // If there's any value, keep it as user-edited
}

function handleInstallmentFocus() {
  // When user focuses on the field, mark it as user-edited to prevent auto-override
  // Only populate auto-value if the field is currently empty
  if (!props.modelValue || props.modelValue.trim() === '') {
    if (isAutoCalculated.value && !isUserEdited.value) {
      const autoValue = calculateAutoInstallment()
      if (autoValue) {
        emit('update:modelValue', autoValue)
        emit('installment-change', autoValue)
      }
    }
  }
  
  // Mark as user-edited once focused to prevent auto-override
  isUserEdited.value = true
  isAutoCalculated.value = false
}

// Watch for collection amount changes to auto-calculate installments
watch([() => props.collectionAmount, () => props.memberBalances, () => props.isAfterSubmission, () => props.submittedCollections, () => props.installmentAmounts], ([newAmount, _, isAfterSub, __, ____], [oldAmount]) => {
  // Skip auto-calculation entirely when in after submission mode
  // The installment values are already correctly set by the parent component
  if (isAfterSub) {
    // In after submission mode, do not auto-calculate anything
    // The installment values are pre-set and should remain as they are
    isAutoCalculated.value = false
    isUserEdited.value = false
    return
  }
  
  // If user has manually edited the installment field, never override it
  if (isUserEdited.value) {
    return
  }
  
  // If amount changed from external source (not user editing), reset auto-calculation
  if (newAmount !== oldAmount) {
    // If amount is cleared or set to 0, clear installment and reset state
    if (newAmount <= 0) {
      isUserEdited.value = false
      isAutoCalculated.value = true
      emit('update:modelValue', '')
      emit('installment-change', '')
      return
    }
    
    // If amount is set to a positive value, reset to auto-calculation mode ONLY if user hasn't edited
    if (newAmount > 0 && !isUserEdited.value) {
      isAutoCalculated.value = true
    }
  }
  
  // Only auto-calculate if user hasn't manually edited the field
  if (!isUserEdited.value) {
    isAutoCalculated.value = true
    const autoValue = calculateAutoInstallment()
    emit('update:modelValue', autoValue)
    emit('installment-change', autoValue)
  }
}, { immediate: true })

// Reset auto-calculation when member changes or when we're viewing after submission
watch(() => props.memberId, () => {
  // Skip auto-calculation entirely when in after submission mode
  if (props.isAfterSubmission) {
    isUserEdited.value = false
    isAutoCalculated.value = false
    return
  }
  
  isUserEdited.value = false
  isAutoCalculated.value = true
  const autoValue = calculateAutoInstallment()
  emit('update:modelValue', autoValue)
  emit('installment-change', autoValue)
})

// Reset user editing state when switching to after submission mode
watch(() => props.isAfterSubmission, (newValue) => {
  if (newValue) {
    isUserEdited.value = false // Allow editing of submitted data
    isAutoCalculated.value = false // Don't auto-calculate in after submission mode
  }
})
</script>

<style scoped>
.installment-calculator {
  position: relative;
}

.installment-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.installment-input:focus {
  outline: none;
  border-color: #3498db;
}

.installment-input.auto-calculated {
  background-color: #f0f8ff;
  border-color: #87ceeb;
}

.installment-input.auto-calculated::placeholder {
  color: #3498db;
  font-weight: 500;
}

.installment-input.auto-filled {
  background-color: #f0f8ff;
  border-color: #87ceeb;
  color: #2c3e50;
  font-weight: 500;
}

.auto-indicator {
  position: absolute;
  top: -0.2rem;
  right: 0.25rem;
  font-size: 0.7rem;
  color: #666;
  background: white;
  padding: 0 0.25rem;
}

.auto-filled-indicator {
  position: absolute;
  top: -0.2rem;
  right: 0.25rem;
  font-size: 0.7rem;
  color: #2c3e50;
  background: white;
  padding: 0 0.25rem;
  font-weight: 600;
}

.format-indicator {
  position: absolute;
  top: -0.2rem;
  right: 0.25rem;
  font-size: 0.7rem;
  color: #e67e22;
  background: white;
  padding: 0 0.25rem;
  font-weight: 600;
}
</style>
