<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeMenu = ref('')

function toggleDropdown(menu: string) {
  activeMenu.value = activeMenu.value === menu ? '' : menu
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown')) {
    activeMenu.value = ''
  }
}

function handleNavigation() {
  activeMenu.value = null
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <nav class="navbar">
    <div class="nav-brand" @click="router.push('/')">
      <h1>Chit Fund Management</h1>
    </div>
    
    <div class="nav-menu">
      <router-link to="/" class="nav-item">Home</router-link>
      
      <div class="dropdown">
        <button class="nav-item" @click.stop="toggleDropdown('members')">
          Members
          <span class="arrow">▼</span>
        </button>
        <div v-show="activeMenu === 'members'" class="dropdown-menu">
          <router-link to="/members" class="dropdown-item" @click="handleNavigation">View Members</router-link>
          <router-link to="/members/add" class="dropdown-item" @click="handleNavigation">Add Member</router-link>
        </div>
      </div>
      
      <div class="dropdown">
        <button class="nav-item" @click.stop="toggleDropdown('groups')">
          Groups
          <span class="arrow">▼</span>
        </button>
        <div v-show="activeMenu === 'groups'" class="dropdown-menu">
          <router-link to="/groups" class="dropdown-item" @click="handleNavigation">View Groups</router-link>
          <router-link to="/groups/add" class="dropdown-item" @click="handleNavigation">Add Group</router-link>
        </div>
      </div>
      
      <div class="dropdown">
        <button class="nav-item" @click.stop="toggleDropdown('collections')">
          Collections
          <span class="arrow">▼</span>
        </button>
        <div v-show="activeMenu === 'collections'" class="dropdown-menu">
          <router-link to="/collections" class="dropdown-item" @click="handleNavigation">View Collections</router-link>
          <router-link to="/collections/add" class="dropdown-item" @click="handleNavigation">Add Collection</router-link>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  background-color: #2c3e50;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand {
  cursor: pointer;
}

.nav-brand h1 {
  color: white;
  margin: 0;
  font-size: 1.5rem;
}

.nav-menu {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.nav-item {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-item:hover {
  color: #3498db;
}

.arrow {
  font-size: 0.75rem;
}

.dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  min-width: 200px;
  z-index: 1000;
}

.dropdown-item {
  display: block;
  padding: 0.75rem 1rem;
  color: #2c3e50;
  text-decoration: none;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
  color: #3498db;
}
</style> 