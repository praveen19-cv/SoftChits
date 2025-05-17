<template>
  <div class="chit-dates-table">
    <h4>Chit Date Settings</h4>
    <div v-if="store.loading" class="loading">
      Loading...
    </div>
    <div v-else class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 80px">Sr. No.</th>
            <th>Chit Date</th>
            <th>Minimum Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(date, index) in chitDates" :key="index">
            <td class="text-center">{{ index + 1 }}</td>
            <td class="text-center">
              <input 
                type="date" 
                v-model="date.chit_date" 
                class="form-control"
                :min="startDate"
                :max="endDate"
                @change="validateDate(date)"
              />
            </td>
            <td>
              <input 
                type="number" 
                v-model.number="date.amount" 
                class="form-control"
                :class="{ 'is-invalid': !isValidAmount(date.amount) }"
                @input="validateAmount(date)"
                placeholder="Enter minimum amount"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-3 d-flex justify-content-end">
      <button
        class="btn btn-primary export-btn"
        @click="exportAsBidAmounts"
        :disabled="store.loading"
      >
        Export as Bid Amount
      </button>
      <button 
        class="btn btn-primary" 
        @click="saveChitDates"
        :disabled="!hasModifiedRows || !hasValidDates || store.loading"
      >
        <span v-if="store.loading">Saving...</span>
        <span v-else>Save Changes</span>
      </button>
    </div>

    <!-- Standard Notification -->
    <StandardNotification
      :show="notification.show"
      :message="notification.message"
      :type="notification.type"
      @close="notification.show = false"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { format as formatDateFns, addMonths, parseISO, isAfter, isValid as isDateValid } from 'date-fns'
import { useGroupsStore } from '@/stores/GroupsStore'
import StandardNotification from '@/components/standards/StandardNotification.vue'

const props = defineProps<{
  groupId: string | number
  startDate: string
  endDate: string
  numberOfMonths: number
}>()

const store = useGroupsStore()
const chitDates = ref<{ chit_date: string; amount: number }[]>([])
const originalChitDates = ref<{ chit_date: string; amount: number }[]>([])
const hasChanges = ref(false)
const notification = ref({ show: false, message: '', type: 'success' })

function generateChitDates() {
  const dates: { chit_date: string; amount: number }[] = []
  let currentDate = parseISO(props.startDate)
  const endDate = parseISO(props.endDate)
  while (!isAfter(currentDate, endDate)) {
    dates.push({ chit_date: formatDateFns(currentDate, 'yyyy-MM-dd'), amount: 0 })
    currentDate = addMonths(currentDate, 1)
  }
  return dates
}

async function loadChitDates() {
  try {
    const data = await store.fetchChitDates(Number(props.groupId))
    if (Array.isArray(data) && data.length) {
      chitDates.value = data.map(d => ({ chit_date: d.chit_date, amount: Number(d.amount) || 0 }))
    } else {
      chitDates.value = generateChitDates()
    }
    originalChitDates.value = JSON.parse(JSON.stringify(chitDates.value))
    hasChanges.value = false
  } catch {
    chitDates.value = generateChitDates()
    originalChitDates.value = JSON.parse(JSON.stringify(chitDates.value))
    hasChanges.value = false
  }
}

function showNotification(message: string, type: 'success' | 'error' = 'success') {
  notification.value = { show: true, message, type }
}

async function saveChitDates() {
  try {
    const datesToSave = chitDates.value.map(d => {
      const parsed = parseISO(d.chit_date)
      if (!isDateValid(parsed)) throw new Error(`Invalid date: ${d.chit_date}`)
      return { chit_date: formatDateFns(parsed, 'yyyy-MM-dd'), amount: Number(d.amount) || 0 }
    })
    datesToSave.sort((a, b) => parseISO(a.chit_date).getTime() - parseISO(b.chit_date).getTime())
    await store.updateChitDates(Number(props.groupId), datesToSave)
    await loadChitDates()
    showNotification('Chit dates saved successfully')
  } catch (error: any) {
    chitDates.value = JSON.parse(JSON.stringify(originalChitDates.value))
    showNotification(error.message || 'Failed to save chit dates', 'error')
  }
}

// New: export chitDates as monthly bid_amounts
async function exportAsBidAmounts() {
  try {
    // Fetch existing monthly subscriptions
    const subs = await store.fetchMonthlySubscriptions(Number(props.groupId))
    // Map chitDates to subscription bid_amount, starting from month 2
    const updated = subs.map(sub => {
      if (sub.month_number === 1) {
        // Month 1 should have 0 bid amount
        return {
          ...sub,
          bid_amount: 0,
          total_dividend: 0,
          distributed_dividend: 0
        }
      } else {
        // For months 2 onwards, use chitDates array
        const chitDateIndex = sub.month_number - 2
        const chitDate = chitDates.value[chitDateIndex]
        const bidAmount = chitDate?.amount || 0
        return {
          ...sub,
          bid_amount: bidAmount
        }
      }
    })
    // Update backend
    await store.updateMonthlySubscriptions(Number(props.groupId), updated)
    showNotification('Bid amounts exported to monthly subscriptions')
  } catch (error: any) {
    showNotification(error.message || 'Failed to export bid amounts', 'error')
  }
}

const hasModifiedRows = computed(
  () => chitDates.value.some((d, i) => {
    const orig = originalChitDates.value[i]
    return !!orig && (orig.chit_date !== d.chit_date || orig.amount !== d.amount)
  })
)

const hasValidDates = computed(
  () => chitDates.value.every(d => {
    try { return isDateValid(parseISO(d.chit_date)) } catch { return false }
  })
)

function validateAmount(d: { chit_date: string; amount: number }) {
  d.amount = Math.max(0, Number(d.amount) || 0)
  hasChanges.value = true
}

function validateDate(d: { chit_date: string; amount: number }) {
  try {
    const parsed = parseISO(d.chit_date)
    const start = parseISO(props.startDate)
    const end = parseISO(props.endDate)
    if (!isDateValid(parsed) || isAfter(parsed, end) || isAfter(start, parsed)) {
      d.chit_date = formatDateFns(start, 'yyyy-MM-dd')
    }
    hasChanges.value = true
  } catch {
    d.chit_date = formatDateFns(parseISO(props.startDate), 'yyyy-MM-dd')
    hasChanges.value = true
  }
}

function isValidAmount(amount: number): boolean {
  return amount >= 0;
}

watch(() => props.startDate, loadChitDates)
watch(() => props.endDate, loadChitDates)
onMounted(loadChitDates)
</script>

<style scoped>
.chit-dates-table {
  margin: 20px 0;
}

/* Custom spacing for Export button */
.export-btn {
  margin-right: 2rem;
}

h4 {
  margin-bottom: 15px;
  color: #333;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.table-container {
  overflow-x: auto;
  margin-bottom: 20px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
}

.table th,
.table td {
  padding: 12px 8px;
  border: 1px solid #dee2e6;
}

.table th {
  background-color: #f8f9fa;
  font-weight: bold;
  text-align: center;
}

.text-center {
  text-align: center;
}

.form-control {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  text-align: center;
}

.form-control:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.form-control.is-invalid {
  border-color: #dc3545;
}

.form-control.is-invalid:focus {
  border-color: #dc3545;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
}

.btn {
  padding: 8px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #007bff;
  border: 1px solid #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
}

.btn-primary:disabled {
  background-color: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.65;
}

.d-flex {
  display: flex;
}

.justify-content-end {
  justify-content: flex-end;
}

.form-control[type="date"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
}

.form-control[type="date"]:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style> 