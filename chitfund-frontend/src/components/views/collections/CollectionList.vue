<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useRouter } from 'vue-router'

const router = useRouter()
const collectionsStore = useCollectionsStore()

const collections = ref([])
const loading = ref(false)
const error = ref('')

async function loadCollections() {
  try {
    loading.value = true
    error.value = ''
    await collectionsStore.fetchCollections()
    collections.value = collectionsStore.collections
  } catch (err: any) {
    error.value = 'Failed to load collections. Please try again.'
  } finally {
    loading.value = false
  }
}

async function handleDelete(collectionId) {
  try {
    loading.value = true
    error.value = ''
    await collectionsStore.deleteCollection(collectionId)
    collections.value = collections.value.filter(c => c.id !== collectionId)
  } catch (err: any) {
    error.value = 'Failed to delete collection. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadCollections)
</script>

<template>
  <div class="collection-list">
    <div class="header">
      <h2>Collections</h2>
      <router-link to="/collections/add" class="add-button">Add New Collection</router-link>
    </div>

    <div v-if="loading" class="loading">
      Loading...
    </div>

    <div v-else class="collections-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Group</th>
            <th>Member</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="collection in collections" :key="collection.id">
            <td>{{ new Date(collection.date).toLocaleDateString() }}</td>
            <td>{{ collection.group_name }}</td>
            <td>{{ collection.member_name }}</td>
            <td>₹{{ collection.amount }}</td>
            <td>
              <span :class="['status', collection.status]">{{ collection.status }}</span>
            </td>
            <td class="actions">
              <button class="edit-button" @click="router.push(`/collections/${collection.id}/edit`)">Edit</button>
              <button class="delete-button" @click="handleDelete(collection.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.collection-list {
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

.collections-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status.paid {
  background-color: #2ecc71;
  color: white;
}

.status.pending {
  background-color: #f1c40f;
  color: white;
}

.status.overdue {
  background-color: #e74c3c;
  color: white;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.edit-button, .delete-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
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

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-size: 1.1rem;
}
</style> 