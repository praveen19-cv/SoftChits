<template>
  <div class="add-member-modal">
    <div class="modal-content">
      <h3>Add Member to Group</h3>
      
      <div v-if="loading" class="loading">
        Loading...
      </div>
      
      <div v-else-if="error" class="error-message">
        {{ error }}
      </div>
      
      <div v-else>
        <div class="form-group">
          <label for="member">Select Member:</label>
          <select 
            id="member" 
            v-model="selectedMemberId" 
            class="form-control"
            :disabled="loading"
          >
            <option value="">Select a member</option>
            <option 
              v-for="member in members" 
              :key="member.id" 
              :value="member.id"
            >
              {{ member.name }} ({{ member.phone }})
            </option>
          </select>
        </div>

        <div class="group-info" v-if="groupDetails">
          <p><strong>Group:</strong> {{ groupDetails.name }}</p>
          <p><strong>Current Members:</strong> {{ groupDetails.member_count }} / {{ groupDetails.member_count }}</p>
        </div>

        <div class="modal-actions">
          <button 
            class="btn btn-secondary" 
            @click="emit('close')"
            :disabled="loading"
          >
            Cancel
          </button>
          <button 
            class="btn btn-primary" 
            @click="handleSubmit"
            :disabled="loading || !selectedMemberId"
          >
            Add Member
          </button>
        </div>
      </div>
    </div>

    <StandardNotification
      :show="notification.show"
      :message="notification.message"
      :type="notification.type"
      @close="notification.show = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import StandardNotification from '@/components/standards/StandardNotification.vue'

const props = defineProps({
  groupId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['close', 'member-added'])

const store = useGroupsStore()
const loading = ref(false)
const error = ref('')
const members = ref([])
const selectedMemberId = ref('')
const groupDetails = ref(null)
const notification = ref({
  show: false,
  message: '',
  type: 'success'
})

const showNotification = (message, type = 'success') => {
  notification.value = {
    show: true,
    message,
    type
  }
}

async function loadMembers() {
  try {
    loading.value = true
    error.value = ''
    
    // Fetch group details
    groupDetails.value = await store.fetchGroupById(props.groupId)
    
    // Fetch available members
    const response = await fetch('/api/members/available')
    if (!response.ok) {
      throw new Error('Failed to fetch available members')
    }
    members.value = await response.json()
    
  } catch (err) {
    console.error('Error loading data:', err)
    error.value = 'Failed to load data. Please try again.'
    showNotification('Failed to load data', 'error')
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  try {
    if (!selectedMemberId.value) {
      error.value = 'Please select a member'
      return
    }

    // Check if adding this member would exceed the group's member limit
    if (groupDetails.value && groupDetails.value.member_count >= groupDetails.value.member_count) {
      error.value = `Cannot add more members. Group limit (${groupDetails.value.member_count}) reached.`
      showNotification(error.value, 'error')
      return
    }

    loading.value = true
    error.value = ''
    
    // Add member to group
    await store.addMemberToGroup(props.groupId, Number(selectedMemberId.value))
    
    showNotification('Member added successfully')
    emit('member-added')
    emit('close')
  } catch (err) {
    console.error('Error adding member to group:', err)
    error.value = err.response?.data?.message || 'Failed to add member to group. Please try again.'
    showNotification(error.value, 'error')
  } finally {
    loading.value = false
  }
}

onMounted(loadMembers)
</script>

<style scoped>
.add-member-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h3 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #4b5563;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 1rem;
}

.form-control:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.group-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 4px;
}

.group-info p {
  margin: 0.5rem 0;
  color: #4b5563;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-secondary {
  background-color: #e5e7eb;
  color: #4b5563;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #d1d5db;
}

.loading {
  text-align: center;
  padding: 1rem;
  color: #6b7280;
}

.error-message {
  color: #dc2626;
  padding: 1rem;
  background-color: #fee2e2;
  border-radius: 4px;
  margin-bottom: 1rem;
}
</style> 