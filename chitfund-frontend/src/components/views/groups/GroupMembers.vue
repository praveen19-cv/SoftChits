<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { getAllMembers, getGroupById, getGroupMembers, updateGroupMembers } from '@/services/api'
import { useRouter, useRoute } from 'vue-router'
import StandardNotification from '@/components/standards/StandardNotification.vue'

interface Member {
  id: number
  name: string
  phone: string
  email: string
  address: string
  status: 'active' | 'inactive'
  group_member_id?: string
}

interface Group {
  id: number
  name: string
  total_amount: number
  member_count: number
  start_date: string
  end_date: string
  status: string
}

const router = useRouter()
const route = useRoute()
const groupId = computed(() => Number(route.params.id))
const group = ref<Group | null>(null)
const allMembers = ref<Member[]>([])
const selectedMembers = ref<Member[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('active')
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

// Sort selected members by their group member ID number
const sortedSelectedMembers = computed(() => {
  return [...selectedMembers.value].sort((a, b) => {
    const numA = parseInt(a.group_member_id?.split('#')[1] || '0')
    const numB = parseInt(b.group_member_id?.split('#')[1] || '0')
    return numA - numB
  })
})

// Filter members based on search query and status
const filteredMembers = computed(() => {
  let filtered = allMembers.value

  // Apply status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(member => member.status === statusFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(member => 
      member.name.toLowerCase().includes(query) ||
      member.phone.includes(query) ||
      member.email.toLowerCase().includes(query)
    )
  }

  return filtered
})

// Add computed property for member limit status
const memberLimitStatus = computed(() => {
  if (!group.value) return { isAtLimit: false, isExceeded: false }
  const isAtLimit = selectedMembers.value.length === group.value.member_count
  const isExceeded = selectedMembers.value.length > group.value.member_count
  return { isAtLimit, isExceeded }
})

async function loadData() {
  if (!groupId.value) {
    error.value = 'Invalid group ID'
    return
  }

  try {
    loading.value = true
    error.value = ''
    
    // Load group details
    const groupData = await getGroupById(groupId.value)
    group.value = groupData
    
    // Load all members
    const membersData = await getAllMembers()
    allMembers.value = membersData
    
    // Load existing group members
    const groupMembersData = await getGroupMembers(groupId.value)
    selectedMembers.value = groupMembersData
  } catch (err: any) {
    console.error('Error loading data:', err)
    error.value = 'Failed to load data. Please try again.'
  } finally {
    loading.value = false
  }
}

function generateGroupMemberId(member: Member, index: number) {
  if (!group.value) return ''
  return `${group.value.name}#${String(index + 1).padStart(2, '0')}`
}

async function toggleMember(member: Member) {
  const index = selectedMembers.value.findIndex(m => m.id === member.id)
  
  // If trying to add a new member
  if (index === -1) {
    // Check if adding would exceed the limit
    if (!group.value || selectedMembers.value.length >= group.value.member_count) {
      notificationMessage.value = `Cannot add more members. Group limit is ${group.value?.member_count || 0} members.`
      notificationType.value = 'error'
      showNotification.value = true
      return
    }
    
    // Add member with generated ID
    const newMember = {
      ...member,
      group_member_id: generateGroupMemberId(member, selectedMembers.value.length)
    }
    selectedMembers.value.push(newMember)
  } else {
    selectedMembers.value.splice(index, 1)
  }
  
  // Save changes to the backend
  try {
    // First, regenerate all group member IDs to ensure they are sequential
    const updatedMembers = selectedMembers.value.map((m, index) => ({
      ...m,
      group_member_id: generateGroupMemberId(m, index)
    }))
    selectedMembers.value = updatedMembers

    // Then update the backend
    await updateGroupMembers(groupId.value, updatedMembers.map(m => ({
      id: m.id,
      groupMemberId: m.group_member_id || ''
    })))
    notificationMessage.value = 'Group members updated successfully!'
    notificationType.value = 'success'
    showNotification.value = true
  } catch (err: any) {
    console.error('Error updating group members:', err)
    error.value = 'Failed to update group members. Please try again.'
    notificationMessage.value = error.value
    notificationType.value = 'error'
    showNotification.value = true
    // Reload data to ensure consistency
    await loadData()
  }
}

function isMemberSelected(member: Member) {
  return selectedMembers.value.some(m => m.id === member.id)
}

onMounted(loadData)
</script>

<template>
  <div class="group-members">
    <div class="header">
      <div class="header-top">
        <h2>Manage Group Members</h2>
        <button class="back-button" @click="router.push('/groups')">Back to Groups</button>
      </div>
      <div v-if="group" class="group-info">
        <h3>{{ group.name }}</h3>
        <p>Total Amount: ₹{{ group.total_amount.toLocaleString() }}</p>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="loading" class="loading-message">
      Loading...
    </div>

    <div v-else class="members-container">
      <div class="selected-members">
        <h3>
          Selected Members 
          <span :class="['member-count', { 'at-limit': memberLimitStatus.isAtLimit, 'exceeded': memberLimitStatus.isExceeded }]">
            ({{ selectedMembers.length }}/{{ group?.member_count }})
          </span>
        </h3>
        <div v-if="selectedMembers.length === 0" class="empty-message">
          No members selected
        </div>
        <div v-else class="selected-members-list">
          <div v-for="member in sortedSelectedMembers" :key="member.id" class="selected-member">
            <span class="member-id">{{ member.group_member_id }}</span>
            <span class="member-name">{{ member.name }}</span>
            <span class="member-status" :class="member.status">
              {{ member.status }}
            </span>
            <button class="remove-button" @click="toggleMember(member)">Remove</button>
          </div>
        </div>
      </div>

      <div class="available-members">
        <h3>Available Members</h3>
        <div class="filters">
          <div class="search-box">
            <input 
              type="text" 
              placeholder="Search members..." 
              v-model="searchQuery"
            />
          </div>
          <div class="status-filter">
            <select v-model="statusFilter">
              <option value="all">All Members</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
        <div class="members-list">
          <div 
            v-for="member in filteredMembers" 
            :key="member.id" 
            class="member-item"
            :class="{ selected: isMemberSelected(member) }"
            @click="toggleMember(member)"
          >
            <div class="member-info">
              <span class="member-name">{{ member.name }}</span>
              <div class="member-details">
                <span class="member-phone">{{ member.phone }}</span>
                <span class="member-status" :class="member.status">
                  {{ member.status }}
                </span>
              </div>
            </div>
            <button class="add-button" :class="{ 'remove': isMemberSelected(member) }">
              {{ isMemberSelected(member) ? 'Remove' : 'Add' }}
            </button>
          </div>
        </div>
      </div>
    </div>

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
.group-members {
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.group-info {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.group-info h3 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
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

.members-container {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2rem;
}

.selected-members, .available-members {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.selected-members h3, .available-members h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.search-box {
  margin-bottom: 1rem;
}

.search-box input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.selected-members-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selected-member {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.member-id {
  font-family: monospace;
  color: #3498db;
  font-weight: 500;
}

.member-name {
  flex: 1;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 600px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.member-item:hover {
  background-color: #f8f9fa;
}

.member-item.selected {
  background-color: #e3f2fd;
  border-color: #3498db;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.member-phone {
  font-size: 0.875rem;
  color: #6b7280;
}

.add-button, .remove-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.add-button {
  background-color: #3498db;
  color: white;
}

.add-button:hover {
  background-color: #2980b9;
}

.add-button.remove {
  background-color: #e74c3c;
}

.add-button.remove:hover {
  background-color: #c0392b;
}

.remove-button {
  background-color: #e74c3c;
  color: white;
}

.remove-button:hover {
  background-color: #c0392b;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.back-button {
  background-color: #6b7280;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: #4b5563;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.status-filter select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 150px;
}

.member-status {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: capitalize;
}

.member-status.active {
  background-color: #dcfce7;
  color: #166534;
}

.member-status.inactive {
  background-color: #fee2e2;
  color: #991b1b;
}

.member-details {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.selected-member {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.selected-member .member-status {
  margin-left: auto;
  margin-right: 1rem;
}

.member-count {
  font-size: 0.9em;
  font-weight: normal;
  color: #6b7280;
}

.member-count.at-limit {
  color: #f59e0b; /* Amber */
}

.member-count.exceeded {
  color: #ef4444; /* Red */
}

@media (max-width: 768px) {
  .members-container {
    grid-template-columns: 1fr;
  }
}
</style> 