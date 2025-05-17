<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useReportsStore } from '@/stores/ReportsStore'

const store = useReportsStore()
const loading = ref(false)

onMounted(async () => {
  try {
    loading.value = true
    await store.fetchCustomerSheet()
  } catch (error) {
    console.error('Error loading customer sheet:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="customer-sheet">
    <h3>Customer Sheet</h3>
    <div v-if="loading" class="loading">
      Loading...
    </div>
    <div v-else-if="store.error" class="error">
      {{ store.error }}
    </div>
    <div v-else>
      <!-- Content will be added based on your requirements -->
      <p>Customer Sheet content will be implemented here.</p>
    </div>
  </div>
</template>

<style scoped>
.customer-sheet {
  min-height: 400px;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  color: #e74c3c;
}
</style> 