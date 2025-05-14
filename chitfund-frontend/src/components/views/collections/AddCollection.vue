<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { createCollection, getAllGroups, getAllMembers } from '@/services/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const groups = ref([])
const members = ref([])

const collection = ref({
  date: '',
  group_id: '',
  member_id: '',
  amount: '',
  status: 'pending'
})

function loadGroups() {
  getAllGroups()
    .then(response => {
      groups.value = response.data
    })
    .catch(error => {
      console.error('Error loading groups:', error)
    })
}

function loadMembers() {
  getAllMembers()
    .then(response => {
      members.value = response.data
    })
    .catch(error => {
      console.error('Error loading members:', error)
    })
}

function handleSubmit() {
  createCollection(collection.value)
    .then(() => {
      router.push('/collections')
    })
    .catch(error => {
      console.error('Error creating collection:', error)
    })
}

onMounted(() => {
  loadGroups()
  loadMembers()
})
</script>

<template>
  <div class="add-collection">
    <div class="header">
      <h2>Add New Collection</h2>
    </div>

    <form @submit.prevent="handleSubmit" class="collection-form">
      <div class="form-group">
        <label for="date">Date</label>
        <input
          type="date"
          id="date"
          v-model="collection.date"
          required
        />
      </div>

      <div class="form-group">
        <label for="group_id">Group</label>
        <select id="group_id" v-model="collection.group_id" required>
          <option value="">Select a group</option>
          <option v-for="group in groups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="member_id">Member</label>
        <select id="member_id" v-model="collection.member_id" required>
          <option value="">Select a member</option>
          <option v-for="member in members" :key="member.id" :value="member.id">
            {{ member.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="amount">Amount (₹)</label>
        <input
          type="number"
          id="amount"
          v-model="collection.amount"
          required
          placeholder="Enter amount"
        />
      </div>

      <div class="form-group">
        <label for="status">Status</label>
        <select id="status" v-model="collection.status" required>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div class="form-actions">
        <button type="submit" class="submit-button">Add Collection</button>
        <button type="button" class="cancel-button" @click="router.push('/collections')">Cancel</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.add-collection {
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

h2 {
  margin: 0;
  color: #2c3e50;
}

.collection-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 1.5rem;
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

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.submit-button, .cancel-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.submit-button {
  background-color: #2c3e50;
  color: white;
}

.submit-button:hover {
  background-color: #34495e;
}

.cancel-button {
  background-color: #95a5a6;
  color: white;
}

.cancel-button:hover {
  background-color: #7f8c8d;
}
</style> 