<template>
  <div class="installment-calculator">
    <input
      type="text"
      :value="displayValue"
      @input="handleInstallmentInput"
      @blur="handleInstallmentBlur"
      :placeholder="placeholderText"
      class="installment-input"
      :class="{ 'auto-calculated': isAutoCalculated }"
    />
    <small v-if="isAutoCalculated" class="auto-indicator">Auto-calculated</small>
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
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'installment-change', installment: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isUserEdited = ref(false)
const isAutoCalculated = ref(true)

const displayValue = computed(() => props.modelValue)

const placeholderText = computed(() => {
  const currentInstallment = getCurrentInstallmentNumber()
  return currentInstallment ? `Current: ${currentInstallment}` : '1'
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
      const installmentString = memberCollections
        .map(c => `${c.installment_number}${c.is_completed ? 'c' : ''}`)
        .join(',')
      return installmentString
    } else {
      // Member has no collections on this date - return empty string
      return ''
    }
  }

  if (props.collectionAmount <= 0 || !props.monthlySubscription) {
    return getCurrentInstallmentNumber().toString()
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
  isUserEdited.value = true
  isAutoCalculated.value = false
  emit('update:modelValue', value)
  emit('installment-change', value)
}

function handleInstallmentBlur() {
  // Validate and format the input
  if (!isUserEdited.value) return
  
  const value = props.modelValue.trim()
  if (!value) {
    // Reset to auto-calculated if empty
    isUserEdited.value = false
    isAutoCalculated.value = true
    const autoValue = calculateAutoInstallment()
    emit('update:modelValue', autoValue)
    emit('installment-change', autoValue)
  }
}

// Watch for collection amount changes to auto-calculate installments
watch([() => props.collectionAmount, () => props.memberBalances, () => props.isAfterSubmission, () => props.submittedCollections], () => {
  if (!isUserEdited.value) {
    // For after submission, always show the submitted data
    if (props.isAfterSubmission && props.submittedCollections) {
      isAutoCalculated.value = false // Don't show "Auto-calculated" for submitted data
      const autoValue = calculateAutoInstallment()
      emit('update:modelValue', autoValue)
      emit('installment-change', autoValue)
    } else if (props.collectionAmount > 0) {
      isAutoCalculated.value = true
      const autoValue = calculateAutoInstallment()
      emit('update:modelValue', autoValue)
      emit('installment-change', autoValue)
    }
  }
}, { immediate: true })

// Reset auto-calculation when member changes
watch(() => props.memberId, () => {
  isUserEdited.value = false
  if (props.isAfterSubmission && props.submittedCollections) {
    isAutoCalculated.value = false // Don't show "Auto-calculated" for submitted data
  } else {
    isAutoCalculated.value = true
  }
  const autoValue = calculateAutoInstallment()
  emit('update:modelValue', autoValue)
  emit('installment-change', autoValue)
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

.auto-indicator {
  position: absolute;
  top: -0.2rem;
  right: 0.25rem;
  font-size: 0.7rem;
  color: #666;
  background: white;
  padding: 0 0.25rem;
}
</style>
