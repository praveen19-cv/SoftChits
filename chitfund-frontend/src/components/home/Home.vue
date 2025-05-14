<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { getAllMembers, getAllGroups, getAllCollections } from '../../services/api'

const stats = ref({
  totalMembers: 0,
  totalGroups: 0,
  totalCollections: 0
})

async function fetchStats() {
  try {
    const [members, groups, collections] = await Promise.all([
      getAllMembers(),
      getAllGroups(),
      getAllCollections()
    ])
    
    stats.value = {
      totalMembers: members.length,
      totalGroups: groups.length,
      totalCollections: collections.length
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
  }
}

onMounted(fetchStats)
</script>

<template>
  <div class="home">
    <h1>Welcome to Chit Fund Management</h1>
    
    <div class="stats-container">
      <div class="stat-card">
        <h3>Total Members</h3>
        <p class="stat-value">{{ stats.totalMembers }}</p>
      </div>
      
      <div class="stat-card">
        <h3>Total Groups</h3>
        <p class="stat-value">{{ stats.totalGroups }}</p>
      </div>
      
      <div class="stat-card">
        <h3>Total Collections</h3>
        <p class="stat-value">{{ stats.totalCollections }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  padding: 2rem;
}

h1 {
  color: #2c3e50;
  margin-bottom: 2rem;
  text-align: center;
}

.stats-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.stat-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card h3 {
  color: #2c3e50;
  margin: 0 0 1rem 0;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #3498db;
  margin: 0;
}
</style> 