<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import PromptDialog from '@/components/standards/PromptDialog.vue'
import StandardNotification from '@/components/standards/StandardNotification.vue'

interface Group {
  id: number
  name: string
  total_amount: number
  member_count: number
  start_date: string
  end_date: string
  status: string
}

const groupsStore = useGroupsStore()

const groups = ref<Group[]>([])
const loading = ref(false)
const error = ref('')

// Prompt dialog state
const showDeletePrompt = ref(false)
const groupToDelete = ref<Group | null>(null)

const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

async function loadGroups() {
  try {
    loading.value = true;
    error.value = '';
    const fetchedGroups = await groupsStore.fetchGroups();
    
    // Ensure fetchedGroups is an array
    if (!Array.isArray(fetchedGroups)) {
      console.error('Invalid groups data received:', fetchedGroups);
      error.value = 'Unable to connect to the server. Please check if the backend server is running.';
      groups.value = [];
      return;
    }

    // Set groups directly since store already filters invalid groups
    groups.value = fetchedGroups;
    
    if (groups.value.length === 0) {
      error.value = 'No groups found. Add your first group!';
    }
  } catch (err: any) {
    console.error('Error loading groups:', err);
    if (err.message?.includes('Network Error')) {
      error.value = 'Unable to connect to the server. Please check if the backend server is running.';
    } else {
      error.value = err.message || 'Failed to load groups. Please try again.';
    }
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function handleDeleteClick(group: Group) {
  groupToDelete.value = group
  showDeletePrompt.value = true
}

async function handleDeleteConfirm() {
  if (!groupToDelete.value) return

  try {
    loading.value = true
    error.value = ''
    await groupsStore.deleteGroup(groupToDelete.value.id)
    groups.value = groups.value.filter(g => g.id !== groupToDelete.value?.id)
    notificationMessage.value = 'Group deleted successfully!'
    notificationType.value = 'success'
    showNotification.value = true
  } catch (err: any) {
    console.error('Error deleting group:', err)
    error.value = 'Failed to delete group. Please try again.'
    notificationMessage.value = error.value
    notificationType.value = 'error'
    showNotification.value = true
  } finally {
    loading.value = false
    showDeletePrompt.value = false
    groupToDelete.value = null
  }
}

function handleDeleteCancel() {
  showDeletePrompt.value = false
  groupToDelete.value = null
}

onMounted(loadGroups)
</script>

<template>
  <div class="group-list">
    <div class="header">
      <h2>Chit Groups</h2>
      <router-link to="/groups/add" class="add-button">
        Add Group
      </router-link>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="loading" class="loading-message">
      Loading groups...
    </div>

    <div v-else-if="!groups || groups.length === 0" class="empty-message">
      No groups found. Add your first group!
    </div>

    <div v-else class="groups-grid">
      <div v-for="(group, index) in groups" :key="group?.id || index" class="group-card">
        <div class="group-info">
          <h3>{{ group?.name || 'Unnamed Group' }}</h3>
          <p><strong>Total Amount:</strong> ₹{{ (group?.total_amount || 0).toLocaleString() }}</p>
          <p><strong>Members:</strong> {{ group?.member_count || 0 }}</p>
          <p><strong>Start Date:</strong> {{ group?.start_date ? new Date(group.start_date).toLocaleDateString() : 'Not set' }}</p>
          <p><strong>End Date:</strong> {{ group?.end_date ? new Date(group.end_date).toLocaleDateString() : 'Not set' }}</p>
          <p>
            <strong>Status:</strong>
            <span :class="['status', group?.status || 'unknown']">{{ group?.status || 'Unknown' }}</span>
          </p>
        </div>
        <div class="group-actions">
          <router-link :to="`/groups/edit/${group?.id}`" class="edit-button">
            Edit
          </router-link>
          <router-link :to="`/groups/${group?.id}/members`" class="members-button">
            Add/Edit Members
          </router-link>
          <router-link :to="`/groups/${group?.id}/more`" class="more-button">
            More
          </router-link>
          <button class="delete-button" @click="handleDeleteClick(group)">
            Delete
          </button>
        </div>
      </div>
    </div>

    <PromptDialog
      v-if="showDeletePrompt"
      title="Delete Group"
      :message="groupToDelete ? `Are you sure you want to delete ${groupToDelete.name}?` : ''"
      confirm-text="Delete"
      cancel-text="Cancel"
      type="danger"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />

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
.group-list {
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h2 {
  margin: 0;
  color: #2c3e50;
}

.add-button {
  background-color: #2c3e50;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  text-decoration: none;
  transition: background-color 0.2s;
}

.add-button:hover {
  background-color: #34495e;
}

.error-message {
  background-color: #fee2e2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.loading-message, .empty-message {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.group-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.group-info h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.group-info p {
  margin: 0.5rem 0;
  color: #4b5563;
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  text-transform: capitalize;
}

.status.active {
  background-color: #dcfce7;
  color: #166534;
}

.status.completed {
  background-color: #dbeafe;
  color: #1e40af;
}

.status.cancelled {
  background-color: #fee2e2;
  color: #991b1b;
}

.group-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.edit-button, .delete-button, .members-button, .more-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.edit-button {
  background-color: #2c3e50;
  color: white;
}

.members-button {
  background-color: #059669;
  color: white;
}

.more-button {
  background-color: #6366f1;
  color: white;
}

.delete-button {
  background-color: #dc2626;
  color: white;
}

.edit-button:hover {
  background-color: #34495e;
}

.members-button:hover {
  background-color: #047857;
}

.more-button:hover {
  background-color: #4f46e5;
}

.delete-button:hover {
  background-color: #b91c1c;
}
</style> 