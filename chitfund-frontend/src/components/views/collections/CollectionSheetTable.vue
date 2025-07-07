<script lang="ts" setup>
import { defineProps, defineEmits } from 'vue'
import type { CollectionSheetRow } from './CollectionSheetRow.ts'
import type { CollectionBalance } from '@/stores/CollectionsStore'
import InstallmentCalculator from './InstallmentCalculator.vue'
import InstallmentBalanceDisplay from './InstallmentBalanceDisplay.vue'

const props = defineProps<{
  collectionSheet: CollectionSheetRow[]
  memberBalances: CollectionBalance[]
  monthlySubscription: number
  onInstallmentChange: (row: CollectionSheetRow) => void
  onAmountChange: (row: CollectionSheetRow) => void
  isMonthlySubscriptionComplete: (row: CollectionSheetRow) => boolean
  isAfterSubmission?: boolean
  submittedCollections?: any[]
}>()

const emit = defineEmits<{
  updateInstallmentAmounts: [memberId: number, amounts: { [key: number]: number }]
  addDynamicRow: [memberId: number]
  removeDynamicRow: [rowIndex: number]
}>()

function handleInstallmentAmountsUpdate(row: CollectionSheetRow, amounts: { [key: number]: number }) {
  // Update the row's installment amounts
  row.installmentAmounts = amounts
  
  // Calculate total amount from specific amounts
  const totalAmount = Object.values(amounts).reduce((sum, amount) => sum + amount, 0)
  if (totalAmount > 0) {
    row.amount = totalAmount.toString()
  }
  
  // Emit the update
  emit('updateInstallmentAmounts', row.memberId, amounts)
  
  // Trigger amount change to update other calculations
  props.onAmountChange(row)
}

function handleAmountInput(row: CollectionSheetRow) {
  // Trigger the amount change handler
  props.onAmountChange(row)
  
  // Also check if this might be a "2,3" + "200,300" pattern
  checkAndConvertMultipleInstallmentPattern(row)
}

function handleInstallmentInput(row: CollectionSheetRow) {
  // Trigger the installment change handler
  props.onInstallmentChange(row)
  
  // Also check if this might be a "2,3" + "200,300" pattern
  checkAndConvertMultipleInstallmentPattern(row)
}

function checkAndConvertMultipleInstallmentPattern(row: CollectionSheetRow) {
  // Check if we have "2,3" pattern in installment and "200,300" pattern in amount
  if (row.installment && row.amount && 
      row.installment.includes(',') && !row.installment.includes(':') && 
      row.amount.includes(',')) {
    
    const installments = row.installment.split(',').map(inst => {
      const cleanInst = inst.trim().replace('c', '')
      return parseInt(cleanInst)
    }).filter(num => !isNaN(num))
    
    const amounts = row.amount.split(',').map(a => parseFloat(a.trim())).filter(a => !isNaN(a))
    
    if (installments.length === amounts.length && installments.length > 0) {
      console.log('Detected multiple installment pattern:', installments, amounts)
      
      // Create specific installment amounts mapping
      const installmentAmounts: { [key: number]: number } = {}
      for (let i = 0; i < installments.length; i++) {
        installmentAmounts[installments[i]] = amounts[i]
      }
      
      // Update the row
      row.installmentAmounts = installmentAmounts
      
      // Update the amount to be the total
      const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0)
      row.amount = totalAmount.toString()
      
      // Convert installment format to specific amounts format
      const specificFormat = installments.map((inst, i) => `${inst}:${amounts[i]}`).join(',')
      row.installment = specificFormat
      
      console.log('Converted to specific format:', specificFormat, installmentAmounts)
    }
  }
}

function showInstallmentHelper(row: CollectionSheetRow) {
  // Create a new row for the same member
  emit('addDynamicRow', row.memberId)
}

function removeDynamicRow(row: CollectionSheetRow) {
  if (row.isAdditionalRow && row.rowIndex !== undefined) {
    emit('removeDynamicRow', row.rowIndex)
  }
}

function handleAmountFocus(row: CollectionSheetRow) {
  // When user focuses on amount field, we can show a tooltip or help text
  // For now, if they have specific amounts set, we'll just allow editing
  // The onAmountChange handler will clear the specific amounts if needed
}
</script>

<template>
  <div class="collection-sheet">
    <h3>Collection Sheet</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Serial No</th>
            <th>Member Name</th>
            <th>Installment</th>
            <th>Amount</th>
            <th>Installment Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in collectionSheet" :key="`${row.memberId}-${row.rowIndex || 0}`" 
              :class="{ 'additional-row': row.isAdditionalRow }">
            <td>
              <span v-if="!row.isAdditionalRow">{{ row.serialNo }}</span>
              <span v-else class="additional-row-indicator">{{ row.serialNo }}+</span>
            </td>
            <td>
              <span v-if="!row.isAdditionalRow">{{ row.memberName }}</span>
              <span v-else class="additional-row-name">{{ row.memberName }} (additional)</span>
            </td>
            <td>
              <div class="installment-input-container">
                <InstallmentCalculator
                  :member-id="row.memberId"
                  :collection-amount="parseFloat(row.amount) || 0"
                  :member-balances="props.memberBalances"
                  :monthly-subscription="props.monthlySubscription"
                  :is-after-submission="props.isAfterSubmission"
                  :submitted-collections="props.submittedCollections"
                  :installment-amounts="row.installmentAmounts"
                  v-model="row.installment"
                  @installment-change="handleInstallmentInput(row)"
                  @update:installmentAmounts="(amounts) => handleInstallmentAmountsUpdate(row, amounts)"
                />
                <button 
                  v-if="!row.isAdditionalRow"
                  type="button" 
                  class="add-installment-btn" 
                  title="Add another row for this member"
                  @click="showInstallmentHelper(row)"
                >
                  +
                </button>
                <button 
                  v-else
                  type="button" 
                  class="remove-installment-btn" 
                  title="Remove this additional row"
                  @click="removeDynamicRow(row)"
                >
                  −
                </button>
              </div>
            </td>
            <td>
              <input
                type="text"
                v-model="row.amount"
                :class="{ 
                  'completed': props.isMonthlySubscriptionComplete(row), 
                  'invalid': isNaN(parseFloat(row.amount)) && row.amount.length > 0,
                  'specific-amounts': row.installmentAmounts && Object.keys(row.installmentAmounts).length > 0
                }"
                :placeholder="row.installmentAmounts && Object.keys(row.installmentAmounts).length > 0 ? 'Auto-calculated from installments' : 'Enter amount'"
                @input="handleAmountInput(row)"
                @focus="handleAmountFocus(row)"
              />
              <small v-if="row.installmentAmounts && Object.keys(row.installmentAmounts).length > 0" class="auto-amount-indicator">
                Amount set by installment breakdown (editable)
              </small>
            </td>
            <td>
              <InstallmentBalanceDisplay
                :member-id="row.memberId"
                :installment-numbers="row.installment"
                :collection-amount="parseFloat(row.amount) || 0"
                :member-balances="props.memberBalances"
                :monthly-subscription="props.monthlySubscription"
                :is-after-submission="props.isAfterSubmission"
                :submitted-collections="props.submittedCollections"
                :installment-amounts="row.installmentAmounts"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.collection-sheet {
  margin-top: 2rem;
}
.collection-sheet h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}
.table-container {
  overflow-x: auto;
  margin: 1rem 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  border: none;
}
th, td {
  padding: 0.75rem;
  text-align: left;
  border: none;
  border-bottom: 1px solid #eee;
}
th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #ddd;
}
td input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}
td input:focus {
  outline: none;
  border-color: #3498db;
}
td input[readonly] {
  background-color: #f8f9fa;
  cursor: not-allowed;
}
td input.completed {
  background-color: #dcfce7;
  border-color: #059669;
}
.invalid {
  border: 1px solid #e74c3c !important;
  background: #fdecea;
}
.installment-balance {
  padding: 4px 0;
  font-size: 0.9em;
  color: #2c3e50;
}
.installment-balance:not(:last-child) {
  border-bottom: 1px solid #eee;
}
.installment-balance .completed {
  color: #059669;
  font-weight: 500;
}

td input.specific-amounts {
  background-color: #f0f8ff;
  border-color: #87ceeb;
  /* Removed cursor: not-allowed to make it clear it's editable */
}

td input.specific-amounts:focus {
  background-color: #ffffff;
  border-color: #3498db;
}

.auto-amount-indicator {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.7rem;
  color: #666;
  font-style: italic;
}

/* Installment input container with + button */
.installment-input-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.add-installment-btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: bold;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.add-installment-btn:hover {
  background: #0056b3;
}

.add-installment-btn:active {
  background: #004494;
}

.remove-installment-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.4rem;
  font-weight: bold;
  flex-shrink: 0;
  transition: background-color 0.2s;
  line-height: 1;
}

.remove-installment-btn:hover {
  background: #c82333;
}

.remove-installment-btn:active {
  background: #b21e2b;
}

/* Additional row styling */
.additional-row {
  background-color: #f8f9ff;
  border-left: 3px solid #007bff;
}

.additional-row-indicator {
  color: #007bff;
  font-weight: 600;
}

.additional-row-name {
  color: #6c757d;
  font-style: italic;
  font-size: 0.9em;
}
</style>
