<script lang="ts" setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="reports-layout">
    <div class="reports-header">
      <h2>Reports</h2>
      <nav class="reports-nav">
        <RouterLink 
          to="/reports/chit-ledger" 
          class="nav-link"
          active-class="active"
        >
          Chit Ledger
        </RouterLink>
        <RouterLink 
          to="/reports/customer-sheet" 
          class="nav-link"
          active-class="active"
        >
          Customer Sheet
        </RouterLink>
      </nav>
    </div>
    
    <div class="reports-content">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.reports-layout {
  padding: 2rem;
}

.reports-header {
  margin-bottom: 2rem;
}

.reports-header h2 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.reports-nav {
  display: flex;
  gap: 1rem;
  border-bottom: 2px solid #eee;
  padding-bottom: 1rem;
}

.nav-link {
  padding: 0.5rem 1rem;
  text-decoration: none;
  color: #666;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.nav-link:hover {
  background: #f8f9fa;
  color: #2c3e50;
}

.nav-link.active {
  background: #3498db;
  color: white;
}

.reports-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 2rem;
}
</style> 