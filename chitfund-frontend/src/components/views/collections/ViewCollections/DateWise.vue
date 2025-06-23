<template>
  <div class="datewise-bg">
    <div class="datewise-container card">
      <div class="card-header">
        <h3>Date Wise Collections</h3>
      </div>
      <div class="filters">
        <div class="form-group">
          <label for="date">Date</label>
          <input type="date" id="date" v-model="selectedDate" />
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
        <button class="submit-btn" @click="onSubmit" :disabled="!selectedDate || !selectedGroupId">Submit</button>
      </div>
      <div v-if="collections.length > 0" class="collection-table">
        <div class="table-responsive">
          <table class="modern-table">
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
                <td>{{ collection.installment_number }}</td>
                <td>₹{{ collection.collection_amount.toLocaleString() }}</td>
                <td>
                  <span :class="['status', collection.is_completed ? 'completed' : 'pending']">
                    {{ collection.is_completed ? 'Completed' : 'Pending' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="total-amount">
          Total Amount: <span class="total-value">₹{{ calculateTotalAmount().toLocaleString() }}</span>
        </div>
      </div>
      <div v-else-if="selectedDate && selectedGroupId" class="no-data">
        <img src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png" alt="No Data" class="no-data-img" />
        <div>No collections found for the selected date and group.</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useMembersStore } from '@/stores/MembersStore'

const groupsStore = useGroupsStore()
const collectionsStore = useCollectionsStore()
const membersStore = useMembersStore()

const selectedDate = ref('')
const selectedGroupId = ref<number | null>(null)
const collections = ref<Collection[]>([])
const groups = ref<Group[]>([])

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

interface Collection {
  id: number
  member_id: number
  member_name: string
  installment_number: number
  collection_amount: number
  remaining_balance: number
  is_completed: boolean
  created_at: string
  updated_remaining_balance: number
}

async function onSubmit() {
  if (selectedDate.value && selectedGroupId.value) {
    await loadMembers()
    try {
      const response = await collectionsStore.fetchCollectionsByDateAndGroup(
        selectedDate.value,
        selectedGroupId.value
      )
      collections.value = response.map((collection: any) => {
        const memberName = membersStore.members.find((m) => m.id === collection.member_id)?.name || 'Unknown Member'
        return {
          ...collection,
          member_name: memberName,
          is_completed: Boolean(collection.is_completed),
        }
      })
    } catch (error) {
      console.error('Error fetching collections:', error)
    }
  }
}

async function loadGroups() {
  await groupsStore.fetchGroups()
  groups.value = groupsStore.groups
}

async function loadMembers() {
  if (membersStore.members.length === 0) {
    await membersStore.fetchMembers()
  }
}

function calculateTotalAmount() {
  return collections.value.reduce((sum, collection) => sum + (collection.collection_amount || 0), 0)
}

onMounted(() => {
  loadGroups()
  loadMembers()
})
</script>

<style scoped>
.datewise-bg {
  min-height: 100vh;
  padding: 2rem 0;
}
.datewise-container {
  max-width: 950px;
  margin: 2rem auto;
  padding: 2.5rem 2rem 2rem 2rem;
  border-radius: 18px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
  background: #fff;
}
.card-header {
  text-align: center;
  margin-bottom: 2rem;
}
h3 {
  margin: 0;
  color: #1a237e;
  font-size: 2rem;
  letter-spacing: 1px;
}
.filters {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  align-items: flex-end;
  flex-wrap: wrap;
  justify-content: center;
}
.form-group {
  flex: 1;
  min-width: 200px;
}
label {
  display: block;
  margin-bottom: 0.5rem;
  color: #34495e;
  font-weight: 600;
}
input[type="date"], select {
  width: 100%;
  padding: 0.7rem;
  border: 1.5px solid #b2bec3;
  border-radius: 6px;
  font-size: 1.05rem;
  background: #f8fafc;
  transition: border 0.2s;
}
input[type="date"]:focus, select:focus {
  border-color: #2980b9;
  outline: none;
}
.submit-btn {
  padding: 0.8rem 2rem;
  background: linear-gradient(90deg, #2980b9 0%, #6dd5fa 100%);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(44, 62, 80, 0.08);
  transition: background 0.2s, box-shadow 0.2s;
}
.submit-btn:disabled {
  background: #b2bec3;
  cursor: not-allowed;
  box-shadow: none;
}
.submit-btn:not(:disabled):hover {
  background: linear-gradient(90deg, #1565c0 0%, #2196f3 100%);
}
.collection-table {
  margin-top: 1rem;
}
.table-responsive {
  overflow-x: auto;
}
.modern-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(44, 62, 80, 0.06);
}
th, td {
  padding: 1rem 1.2rem;
  text-align: left;
  border-bottom: 1px solid #eaeaea;
}
th {
  background: #e3f2fd;
  color: #1a237e;
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
.status {
  padding: 0.4rem 1.1rem;
  border-radius: 16px;
  font-size: 1rem;
  font-weight: 600;
  display: inline-block;
}
.status.completed {
  background: #dcfce7;
  color: #166534;
}
.status.pending {
  background: #fef3c7;
  color: #92400e;
}
.total-amount {
  font-weight: bold;
  margin-top: 1rem;
  text-align: right;
  font-size: 1.15em;
}
.total-value {
  color: #1565c0;
  font-size: 1.15em;
  font-weight: 700;
}
.no-data {
  text-align: center;
  color: #888;
  font-size: 1.15em;
  padding: 2.5rem 0 1rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.no-data-img {
  width: 80px;
  margin-bottom: 1rem;
  opacity: 0.7;
}
@media (max-width: 900px) {
  .datewise-container {
    padding: 1.2rem 0.5rem;
  }
  .filters {
    flex-direction: column;
    gap: 1rem;
  }
  th, td {
    padding: 0.7rem 0.5rem;
  }
}
</style>
