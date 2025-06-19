<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useMembersStore } from '@/stores/MembersStore'
import StandardNotification from '@/components/standards/StandardNotification.vue'

const router = useRouter()
const collectionsStore = useCollectionsStore()
const groupsStore = useGroupsStore()
const membersStore = useMembersStore()

interface Group {
  id: number
  name: string
  total_amount: number
  member_count: number
  start_date: string
  end_date: string
  status: string
  number_of_months: number
  created_at?: string
  updated_at?: string
}
const groups = ref<Group[]>([])

interface Collection {
  id: number
  member_name: string
  installment: number
  amount: number
  status: string
}

const collections = ref<Collection[]>([])
const selectedDate = ref('')
const selectedGroupId = ref<number | null>(null)
const errorMessage = ref('')
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref<'success' | 'error'>('success')

async function loadGroups() {
  try {
    await groupsStore.fetchGroups()
    groups.value = groupsStore.groups
  } catch (error) {
    console.error('Error loading groups:', error)
    showErrorNotification('Failed to load groups')
  }
}

async function loadCollections() {
  try {
    if (!selectedDate.value || !selectedGroupId.value) {
      collections.value = []
      return
    }

    const response = await collectionsStore.fetchCollectionsByDateAndGroup(
      selectedDate.value,
      selectedGroupId.value
    )
    collections.value = response
  } catch (error) {
    console.error('Error loading collections:', error)
    showErrorNotification('Failed to load collections')
  }
}

function showSuccessNotification(message: string) {
  notificationMessage.value = message
  notificationType.value = 'success'
  showNotification.value = true
}

function showErrorNotification(message: string) {
  notificationMessage.value = message
  notificationType.value = 'error'
  showNotification.value = true
}

function handleDateChange() {
  if (selectedDate.value && selectedGroupId.value) {
    loadCollections()
  }
}

function handleGroupChange() {
  if (selectedDate.value && selectedGroupId.value) {
    loadCollections()
  }
}

onMounted(loadGroups)
</script>

<template>
  <div class="collection-list">
    <div class="header">
      <h2>View Collections</h2>
    </div>

    <div class="filters">
      <div class="form-row">
        <div class="form-group">
          <label for="date">Date</label>
          <input
            type="date"
            id="date"
            v-model="selectedDate"
            @change="handleDateChange"
          />
        </div>

        <div class="form-group">
          <label for="group_id">Group</label>
          <select 
            id="group_id" 
            v-model.number="selectedGroupId" 
            @change="handleGroupChange"
          >
            <option value="">Select a group</option>
            <option v-for="group in groups" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="collections.length > 0" class="collection-table">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Serial No</th>
              <th>Member Name</th>
              <th>Installment</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(collection, index) in collections" :key="collection.id">
              <td>{{ index + 1 }}</td>
              <td>{{ collection.member_name }}</td>
              <td>{{ collection.installment }}</td>
              <td>{{ collection.amount }}</td>
              <td>
                <span :class="['status', collection.status]">
                  {{ collection.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="selectedDate && selectedGroupId" class="no-data">
      No collections found for the selected date and group
    </div>

    <StandardNotification
      :show="showNotification"
      :message="notificationMessage"
      :type="notificationType"
      @close="showNotification = false"
    />
  </div>
</template>

<style scoped>
.collection-list {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

h2 {
  margin: 0;
  color: #2c3e50;
}

.filters {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.form-row {
  display: flex;
  gap: 2rem;
}

.form-group {
  flex: 1;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #2c3e50;
  font-weight: 500;
}

input, select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus, select:focus {
  outline: none;
  border-color: #3498db;
}

.table-container {
  overflow-x: auto;
  margin: 1rem 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  border: 1px solid #ddd;
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border: 1px solid #ddd;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status.pending {
  background-color: #fef3c7;
  color: #92400e;
}

.status.completed {
  background-color: #dcfce7;
  color: #166534;
}

.no-data {
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  color: #6b7280;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 1rem;
  }
  
  .collection-list {
    padding: 1rem;
  }
}
</style> 