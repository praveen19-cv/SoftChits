<template>
  <div>
    <h3>Customer Wise Collections</h3>
    <div class="filters">
      <div class="form-group">
        <label for="customer">Customer</label>
        <input type="text" id="customer" v-model="selectedCustomer" placeholder="Search customer" />
      </div>
      <div class="form-group">
        <label for="group_id">Group</label>
        <select id="group_id" v-model.number="selectedGroupId">
          <option value="">Select a group</option>
          <option v-for="group in groups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label for="from_date">From Date</label>
        <input type="date" id="from_date" v-model="fromDate" />
      </div>
      <div class="form-group">
        <label for="to_date">To Date</label>
        <input type="date" id="to_date" v-model="toDate" />
      </div>
    </div>
    <div v-if="collections.length > 0" class="collection-table">
      <table>
        <thead>
          <tr>
            <th>Installment</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="collection in collections" :key="collection.id">
            <td>{{ collection.installment }}</td>
            <td>{{ collection.amount }}</td>
            <td>{{ collection.status }}</td>
          </tr>
        </tbody>
      </table>
      <div class="summary">
        <p>Total Installments: {{ totalInstallments }}</p>
        <p>Total Amount: {{ totalAmount }}</p>
      </div>
    </div>
    <div v-else>
      No collections found for the selected criteria.
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useCollectionsStore } from '@/stores/CollectionsStore'

const groupsStore = useGroupsStore()
const collectionsStore = useCollectionsStore()

const selectedCustomer = ref('')
const selectedGroupId = ref<number | null>(null)
const fromDate = ref('')
const toDate = ref('')
interface Collection {
  id: number
  installment: string
  amount: number
  status: string
}
const collections = ref<Collection[]>([])
interface Group {
  id: number
  name: string
}
const groups = ref<Group[]>([])
const totalInstallments = ref(0)
const totalAmount = ref(0)

async function loadCollections() {
  if (selectedCustomer.value && selectedGroupId.value && fromDate.value && toDate.value) {
    const response = await collectionsStore.fetchCollectionsByCustomerAndDateRange(
      selectedCustomer.value,
      selectedGroupId.value,
      fromDate.value,
      toDate.value
    )
    collections.value = response.collections
    totalInstallments.value = response.totalInstallments
    totalAmount.value = response.totalAmount
  } else {
    collections.value = []
    totalInstallments.value = 0
    totalAmount.value = 0
  }
}

async function loadGroups() {
  await groupsStore.fetchGroups()
  groups.value = groupsStore.groups
}

watch([selectedCustomer, selectedGroupId, fromDate, toDate], loadCollections)

loadGroups()
</script>

<style scoped>
.filters {
  display: flex;
  gap: 1rem;
}
.form-group {
  flex: 1;
}
.collection-table {
  margin-top: 1rem;
}
.summary {
  margin-top: 1rem;
  font-weight: bold;
}
</style>
