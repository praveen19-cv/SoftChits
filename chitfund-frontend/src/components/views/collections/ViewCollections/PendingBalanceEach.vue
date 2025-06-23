<template>
  <div class="pending-balance-section">
    <h4>Pending Installments</h4>
    <div v-if="loading" class="pending-loading">Loading...</div>
    <div v-else-if="errorMessage" class="pending-error">{{ errorMessage }}</div>
    <div v-else-if="pendingInstallments.length > 0" class="pending-table-wrapper">
      <table class="modern-table">
        <thead>
          <tr>
            <th>Installment</th>
            <th>Pending Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in pendingInstallments" :key="item.installment_number">
            <td>{{ item.installment_number }}</td>
            <td>₹{{ (item.pending_amount || 0).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
      <div class="pending-summary">
        <span>Total Pending Balance: <b>₹{{ totalPendingBalance.toLocaleString() }}</b></span>
      </div>
    </div>
    <div v-else class="pending-no-data">No pending installments found.</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue'
import { useCollectionsStore } from '@/stores/CollectionsStore'

const props = defineProps<{
  customerId: number | null
  groupId: number | null
}>()

const collectionsStore = useCollectionsStore()
const pendingInstallments = ref<any[]>([])
const totalPendingBalance = ref(0)
const loading = ref(false)
const errorMessage = ref('')

async function fetchPendingInstallments() {
  pendingInstallments.value = []
  totalPendingBalance.value = 0
  errorMessage.value = ''
  if (!props.customerId || !props.groupId) return
  loading.value = true
  try {
    // This assumes you have a store method for fetching pending installments for a customer in a group
    const response = await collectionsStore.fetchPendingInstallmentsForCustomer(props.customerId, props.groupId)
    pendingInstallments.value = response
    totalPendingBalance.value = response.reduce((sum: number, item: any) => sum + (item.pending_amount || 0), 0)
  } catch (err: any) {
    errorMessage.value = err?.response?.data?.message || 'No pending data found or server error.'
  } finally {
    loading.value = false
  }
}

watch(() => [props.customerId, props.groupId], fetchPendingInstallments, { immediate: true })
</script>

<style scoped>
.pending-balance-section {
  margin-top: 2.5rem;
  background: linear-gradient(90deg, #e3f2fd 0%, #f8fafc 100%);
  border-radius: 16px;
  box-shadow: 0 4px 18px 0 rgba(31, 38, 135, 0.10);
  padding: 2rem 1.5rem 2rem 1.5rem;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}
.pending-balance-section h4 {
  color: #1976d2;
  margin-bottom: 1.5rem;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-align: center;
}
.pending-table-wrapper {
  margin-bottom: 1.2rem;
}
.modern-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(44, 62, 80, 0.08);
}
th, td {
  padding: 1rem 1.2rem;
  text-align: left;
  border-bottom: 1px solid #eaeaea;
}
th {
  background: #e3f2fd;
  color: #1976d2;
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
.pending-summary {
  font-weight: bold;
  margin-top: 1.2rem;
  text-align: right;
  font-size: 1.12em;
  color: #1976d2;
}
.pending-summary b {
  color: #1565c0;
  font-size: 1.13em;
  font-weight: 700;
}
.pending-no-data, .pending-error, .pending-loading {
  text-align: center;
  color: #888;
  font-size: 1.08em;
  padding: 1.2rem 0 0.5rem 0;
}
@media (max-width: 800px) {
  .pending-balance-section {
    padding: 1.2rem 0.5rem;
  }
  th, td {
    padding: 0.7rem 0.5rem;
  }
}
</style>
