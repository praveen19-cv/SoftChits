<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMembersStore } from '@/stores/MembersStore'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const error = ref('')

const membersStore = useMembersStore()

const member = ref({
  name: '',
  phone: '',
  email: '',
  address: '',
  status: 'active'
})

async function loadMember() {
  try {
    loading.value = true
    error.value = ''
    const memberId = Number(route.params.id)
    const data = await membersStore.getMemberById(memberId)
    member.value = data
  } catch (err: any) {
    console.error('Error loading member:', err)
    error.value = 'Failed to load member details. Please try again.'
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  try {
    loading.value = true
    error.value = ''
    const memberId = Number(route.params.id)
    await membersStore.updateMember(memberId, member.value)
    router.push('/members')
  } catch (err: any) {
    console.error('Error updating member:', err)
    error.value = err.response?.data?.message || 'Failed to update member. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMember)
</script>

<template>
  <div class="edit-member">
    <div class="header">
      <h2>Edit Member</h2>
    </div>

    <form @submit.prevent="handleSubmit" class="member-form">
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div class="form-group">
        <label for="name">Name</label>
        <input
          type="text"
          id="name"
          v-model="member.name"
          required
          placeholder="Enter member name"
        />
      </div>

      <div class="form-group">
        <label for="phone">Phone</label>
        <input
          type="tel"
          id="phone"
          v-model="member.phone"
          required
          placeholder="Enter phone number"
        />
      </div>

      <div class="form-group">
        <label for="email">Email</label>
        <input
          type="email"
          id="email"
          v-model="member.email"
          required
          placeholder="Enter email address"
        />
      </div>

      <div class="form-group">
        <label for="address">Address</label>
        <textarea
          id="address"
          v-model="member.address"
          required
          placeholder="Enter address"
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="status">Status</label>
        <select
          id="status"
          v-model="member.status"
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
        <button type="button" class="cancel-button" @click="router.push('/members')" :disabled="loading">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.edit-member {
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

.member-form {
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
  border-color: #3498db;
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

.form-select {
  background-color: white;
  cursor: pointer;
}

.form-select:focus {
  border-color: #3498db;
}
</style> 