<script lang="ts" setup>
import { ref } from 'vue'
import DateWise from './ViewCollections/DateWise.vue'
import CustomerWise from './ViewCollections/CustomerWise.vue'

const activeTab = ref('dateWise')
</script>

<template>
  <div class="collection-list">
    <div class="header">
      <h2>View Collections</h2>
    </div>

    <div class="tabs">
      <button :class="{ active: activeTab === 'dateWise' }" @click="activeTab = 'dateWise'">Date Wise</button>
      <button :class="{ active: activeTab === 'customerWise' }" @click="activeTab = 'customerWise'">Customer Wise</button>
    </div>

    <div v-if="activeTab === 'dateWise'">
      <DateWise />
    </div>
    <div v-else-if="activeTab === 'customerWise'">
      <CustomerWise />
    </div>
  </div>
</template>

<style scoped>
.collection-list {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

h2 {
  margin: 0;
  color: #2c3e50;
}

.tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  background-color: #3498db;
  color: white;
  cursor: pointer;
  border-radius: 4px;
}

button.active {
  background-color: #2980b9;
}

button:hover {
  background-color: #2980b9;
}
</style>