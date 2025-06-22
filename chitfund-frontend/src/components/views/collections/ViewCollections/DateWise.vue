<template>
  <div>
    <h3>Date Wise Collections</h3>
    <div class="filters">
      <div class="form-group">
        <label for="date">Date</label>
        <input type="date" id="date" v-model="selectedDate" @change="handleDateChange" @input="console.log('Date input changed:', selectedDate)" />
      </div>
      <div class="form-group">
        <label for="group_id">Group</label>
        <select id="group_id" v-model.number="selectedGroupId" @change="handleGroupChange">
          <option value="">Select a group</option>
          <option v-for="group in groups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </div>
    </div>
    <div v-if="collections.length > 0" class="collection-table">
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
            <td>{{ collection.installment_number }}</td>
            <td>{{ collection.collection_amount }}</td>
            <td>{{ collection.is_completed ? 'Completed' : 'Pending' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else>
      No collections found for the selected date and group.
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useCollectionsStore } from '@/stores/CollectionsStore'

const groupsStore = useGroupsStore()
const collectionsStore = useCollectionsStore()

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
  member_name: string
  installment_number: number
  collection_amount: number
  remaining_balance: number
  is_completed: number // Add this property to match usage
  created_at: string
  updated_remaining_balance: number
}

async function handleDateChange() {
  if (selectedDate.value && selectedGroupId.value) {
    const groupName = groups.value.find(g => g.id === selectedGroupId.value)?.name;
    const tableName = `collection_${selectedGroupId.value}_${groupName}`;
    console.log('Constructed table name:', tableName);

    try {
      const response = await collectionsStore.fetchCollectionsByTableNameAndDate(
        tableName,
        selectedDate.value
      );
      console.log('Backend response:', response);

      collections.value = response;
      console.log('Mapped collections:', collections.value);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  } else {
    console.warn('Date or Group ID is missing');
  }
}

async function handleGroupChange() {
  if (selectedDate.value && selectedGroupId.value) {
    const groupName = groups.value.find(g => g.id === selectedGroupId.value)?.name;
    const tableName = `collection_${selectedGroupId.value}_${groupName}`;
    console.log('Constructed table name:', tableName);

    const response = await collectionsStore.fetchCollectionsByTableNameAndDate(
      tableName,
      selectedDate.value
    );
    collections.value = response;
    console.log('Mapped collections:', collections.value);
  }
}

async function loadGroups() {
  await groupsStore.fetchGroups()
  groups.value = groupsStore.groups
}

watch(selectedDate, (newDate) => {
  console.log('Date changed:', newDate);
  handleDateChange();
});

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
</style>
