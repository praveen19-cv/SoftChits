<script lang="ts" setup>
import { defineProps, defineEmits } from 'vue'
import type { CollectionSheetRow } from './CollectionSheetRow.ts'

const props = defineProps<{
  collectionSheet: CollectionSheetRow[]
  onInstallmentChange: (row: CollectionSheetRow) => void
  onAmountChange: (row: CollectionSheetRow) => void
  isMonthlySubscriptionComplete: (row: CollectionSheetRow) => boolean
}>()
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
          <tr v-for="row in collectionSheet" :key="row.memberId">
            <td>{{ row.serialNo }}</td>
            <td>{{ row.memberName }}</td>
            <td>
              <input
                type="text"
                v-model="row.installment"
                @input="props.onInstallmentChange(row)"
                placeholder="e.g., 1c,2,3c"
              />
            </td>
            <td>
              <input
                type="number"
                v-model.number="row.amount"
                min="0"
                step="0.01"
                :class="{ 'completed': props.isMonthlySubscriptionComplete(row), 'invalid': isNaN(parseFloat(row.amount)) }"
                placeholder="Enter amount"
                @input="props.onAmountChange(row)"
              />
            </td>
            <td>
              <div v-if="Object.keys(row.installmentBalances).length === 0">-</div>
              <div v-else v-for="(balance, instNo) in row.installmentBalances" :key="instNo" class="installment-balance">
                <template v-if="typeof balance === 'object' && balance !== null && 'old' in balance && 'updated' in balance">
                  Inst-{{ instNo }}: ₹{{ balance.old }} → ₹{{ balance.updated }}
                </template>
                <template v-else>
                  Inst-{{ instNo }}: ₹{{ balance }}
                </template>
              </div>
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
</style>
