<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { getAllMembers, deleteMember } from '@/services/api'
import { useRouter } from 'vue-router'
import PromptDialog from '@/components/standards/PromptDialog.vue'

const router = useRouter()
const members = ref([])
const loading = ref(false)
const error = ref('')
const showDeletePrompt = ref(false)
const memberToDelete = ref(null)

interface Member {
  id: number
  name: string
  phone: string
  email: string
  address: string
}

async function loadMembers() {
  try {
    loading.value = true
    error.value = ''
    members.value = await getAllMembers()
  } catch (err: any) {
    console.error('Error loading members:', err)
    error.value = 'Failed to load members. Please try again.'
  } finally {
    loading.value = false
  }
}

function handleEdit(member: Member) {
  router.push(`/members/edit/${member.id}`)
}

function handleDelete(member: Member) {
  memberToDelete.value = member
  showDeletePrompt.value = true
}

async function confirmDelete() {
  if (!memberToDelete.value) return

  try {
    loading.value = true
    error.value = ''
    await deleteMember(memberToDelete.value.id)
    members.value = members.value.filter(m => m.id !== memberToDelete.value.id)
  } catch (err: any) {
    console.error('Error deleting member:', err)
    error.value = 'Failed to delete member. Please try again.'
  } finally {
    loading.value = false
    showDeletePrompt.value = false
    memberToDelete.value = null
  }
}

onMounted(loadMembers)
</script>

<template>
  <div class="member-list">
    <div class="header">
      <h2>Members</h2>
      <button class="add-button" @click="router.push('/members/add')">
        Add Member
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="loading" class="loading">
      Loading members...
    </div>

    <table v-else class="members-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th>Email</th>
          <th>Address</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in members" :key="member.id">
          <td>{{ member.name }}</td>
          <td>{{ member.phone }}</td>
          <td>{{ member.email }}</td>
          <td>{{ member.address }}</td>
          <td class="actions">
            <button class="edit-button" @click="handleEdit(member)">
              Edit
            </button>
            <button class="delete-button" @click="handleDelete(member)">
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <PromptDialog
      v-if="showDeletePrompt"
      :title="'Delete Member'"
      :message="`Are you sure you want to delete ${memberToDelete?.name}?`"
      @confirm="confirmDelete"
      @cancel="showDeletePrompt = false"
    />
  </div>
</template>

<style scoped>
.member-list {
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
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
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

.loading {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.members-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.members-table th,
.members-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.members-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.edit-button,
.delete-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.edit-button {
  background-color: #3498db;
  color: white;
}

.edit-button:hover {
  background-color: #2980b9;
}

.delete-button {
  background-color: #e74c3c;
  color: white;
}

.delete-button:hover {
  background-color: #c0392b;
}
</style> 