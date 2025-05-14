<script lang="ts" setup>
import { ref } from 'vue'
import { createGroup } from '@/services/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const error = ref('')

const group = ref({
  name: '',
  total_amount: '',
  member_count: 1, // Default to 1 member
  start_date: '',
  end_date: '',
  status: 'active'
})

async function handleSubmit() {
  try {
    loading.value = true
    error.value = ''
    
    // Convert numeric fields
    const groupData = {
      ...group.value,
      total_amount: Number(group.value.total_amount),
      member_count: Number(group.value.member_count)
    }
    
    await createGroup(groupData)
    router.push('/groups')
  } catch (err: any) {
    console.error('Error creating group:', err)
    error.value = err.response?.data?.message || 'Failed to create group. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="add-group">
    <div class="header">
      <h2>Create New Chit Group</h2>
    </div>

    <form @submit.prevent="handleSubmit" class="group-form">
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div class="form-group">
        <label for="name">Group Name</label>
        <input
          type="text"
          id="name"
          v-model="group.name"
          required
          placeholder="Enter group name"
        />
      </div>

      <div class="form-group">
        <label for="total_amount">Total Amount (₹)</label>
        <input
          type="number"
          id="total_amount"
          v-model="group.total_amount"
          required
          placeholder="Enter total amount"
          min="0"
        />
      </div>

      <div class="form-group">
        <label for="member_count">Number of Members</label>
        <input
          type="number"
          id="member_count"
          v-model="group.member_count"
          required
          placeholder="Enter number of members"
          min="1"
        />
      </div>

      <div class="form-group">
        <label for="start_date">Start Date</label>
        <input
          type="date"
          id="start_date"
          v-model="group.start_date"
          required
        />
      </div>

      <div class="form-group">
        <label for="end_date">End Date</label>
        <input
          type="date"
          id="end_date"
          v-model="group.end_date"
          required
        />
      </div>

      <div class="form-group">
        <label for="status">Status</label>
        <select id="status" v-model="group.status" required>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div class="form-actions">
        <button type="submit" class="submit-button" :disabled="loading">
          {{ loading ? 'Creating...' : 'Create Group' }}
        </button>
        <button type="button" class="cancel-button" @click="router.push('/groups')" :disabled="loading">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.add-group {
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

.group-form {
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

.error-message {
  background-color: #fee2e2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
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

.submit-button:hover:not(:disabled) {
  background-color: #34495e;
}

.cancel-button {
  background-color: #95a5a6;
  color: white;
}

.cancel-button:hover:not(:disabled) {
  background-color: #7f8c8d;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style> 