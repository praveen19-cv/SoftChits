<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { getGroupById, updateGroup } from '@/services/api'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const error = ref('')

const group = ref({
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  totalAmount: 0,
  memberCount: 0,
  status: 'active'
})

async function loadGroup() {
  try {
    loading.value = true
    error.value = ''
    const groupId = Number(route.params.id)
    const data = await getGroupById(groupId)
    group.value = data
  } catch (err: any) {
    console.error('Error loading group:', err)
    error.value = 'Failed to load group details. Please try again.'
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  try {
    loading.value = true
    error.value = ''
    const groupId = Number(route.params.id)
    await updateGroup(groupId, group.value)
    router.push('/groups')
  } catch (err: any) {
    console.error('Error updating group:', err)
    error.value = err.response?.data?.message || 'Failed to update group. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadGroup)
</script>

<template>
  <div class="edit-group">
    <div class="header">
      <h2>Edit Group</h2>
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
        >
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea 
          id="description" 
          v-model="group.description" 
          required
          placeholder="Enter group description"
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="startDate">Start Date</label>
        <input 
          type="date" 
          id="startDate" 
          v-model="group.startDate" 
          required
        >
      </div>

      <div class="form-group">
        <label for="endDate">End Date</label>
        <input 
          type="date" 
          id="endDate" 
          v-model="group.endDate" 
          required
        >
      </div>

      <div class="form-group">
        <label for="totalAmount">Total Amount</label>
        <input 
          type="number" 
          id="totalAmount" 
          v-model="group.totalAmount" 
          required
          min="0"
          step="0.01"
        >
      </div>

      <div class="form-group">
        <label for="memberCount">Number of Members</label>
        <input 
          type="number" 
          id="memberCount" 
          v-model="group.memberCount" 
          required
          min="1"
        >
      </div>

      <div class="form-group">
        <label for="status">Status</label>
        <select
          id="status"
          v-model="group.status"
          required
          class="form-select"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div class="form-actions">
        <button type="submit" class="submit-button" :disabled="loading">
          {{ loading ? 'Saving...' : 'Save Changes' }}
        </button>
        <button type="button" class="cancel-button" @click="router.push('/groups')" :disabled="loading">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.edit-group {
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

input, textarea, select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: #2c3e50;
}

.error-message {
  background-color: #fee2e2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
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
  font-size: 1rem;
  cursor: pointer;
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