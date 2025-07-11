<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import StandardNotification from '@/components/standards/StandardNotification.vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import api from '@/services/api'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const error = ref('')
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const groupsStore = useGroupsStore()

// Track original values to detect changes
const originalGroup = ref({
  start_date: '',
  end_date: '',
  total_amount: 0,
  is_ten_dates_chit: false
})

const group = ref({
  id: 0,
  name: '',
  start_date: '',
  end_date: '',
  total_amount: 0,
  member_count: 0,
  status: 'active',
  commission_percentage: 4,
  is_ten_dates_chit: false,
  number_of_months: 0
})

async function loadGroup() {
  try {
    loading.value = true
    error.value = ''
    const groupId = Number(route.params.id)
    const data = await groupsStore.getGroupById(groupId)
    group.value = data
    
    // Store original values to detect changes later
    originalGroup.value = {
      start_date: data.start_date,
      end_date: data.end_date,
      total_amount: data.total_amount,
      is_ten_dates_chit: data.is_ten_dates_chit
    }
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
    
    // Check if fields that affect chit dates have changed
    const chitDatesNeedRegeneration = 
      originalGroup.value.start_date !== group.value.start_date ||
      originalGroup.value.end_date !== group.value.end_date ||
      originalGroup.value.total_amount !== group.value.total_amount ||
      originalGroup.value.is_ten_dates_chit !== group.value.is_ten_dates_chit
    
    // Update the group first
    await groupsStore.updateGroup(groupId, group.value)
    
    // If chit dates need regeneration, call the backend endpoint
    if (chitDatesNeedRegeneration) {
      try {
        const response = await api.post(`/groups/${groupId}/regenerate-chit-dates`)
        
        notificationMessage.value = `Group updated successfully! ${response.data.count} chit dates were regenerated.`
      } catch (chitError) {
        console.error('Error regenerating chit dates:', chitError)
        notificationMessage.value = 'Group updated successfully, but there was an issue regenerating chit dates. Please check the chit dates manually.'
      }
    } else {
      notificationMessage.value = 'Group updated successfully!'
    }
    
    notificationType.value = 'success'
    showNotification.value = true
    setTimeout(() => {
      router.push('/groups')
    }, 2000)
  } catch (err: any) {
    console.error('Error updating group:', err)
    error.value = err.response?.data?.message || 'Failed to update group. Please try again.'
    notificationMessage.value = error.value
    notificationType.value = 'error'
    showNotification.value = true
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
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="is_ten_dates_chit"
            v-model="group.is_ten_dates_chit"
            class="checkbox-input"
          />
          <label for="is_ten_dates_chit" class="checkbox-label">
            Ten Dates Chit (10th, 20th, 30th of each month instead of monthly)
          </label>
        </div>
        <small class="helper-text">⚠️ Changing this will regenerate all chit dates</small>
      </div>

      <div class="form-group">
        <label for="startDate">Start Date</label>
        <input 
          type="date" 
          id="startDate" 
          v-model="group.start_date" 
          required
        >
        <small class="helper-text">⚠️ Changing this will regenerate all chit dates</small>
      </div>

      <div class="form-group">
        <label for="endDate">End Date</label>
        <input 
          type="date" 
          id="endDate" 
          v-model="group.end_date" 
          required
        >
        <small class="helper-text">⚠️ Changing this will regenerate all chit dates</small>
      </div>

      <div class="form-group">
        <label for="totalAmount">Total Amount (₹)</label>
        <input 
          type="number" 
          id="totalAmount" 
          v-model="group.total_amount" 
          required
          min="0"
          step="0.01"
        >
        <small class="helper-text">⚠️ Changing this will recalculate minimum amounts</small>
      </div>

      <div class="form-group">
        <label for="memberCount">Number of Members</label>
        <input 
          type="number" 
          id="memberCount" 
          v-model="group.member_count" 
          required
          min="1"
        >
      </div>

      <div class="form-group">
        <label for="commission_percentage">Commission Percentage (%)</label>
        <input
          type="number"
          id="commission_percentage"
          v-model="group.commission_percentage"
          required
          min="0"
          max="100"
          step="0.1"
        />
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
          <option value="completed">Completed</option>
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

    <StandardNotification
      :message="notificationMessage"
      :type="notificationType"
      :show="showNotification"
      :duration="3000"
      @close="showNotification = false"
    />
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

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-input {
  width: auto;
  margin: 0;
}

.checkbox-label {
  margin: 0;
  font-weight: normal;
  cursor: pointer;
}

.helper-text {
  color: #6c757d;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
}
</style> 