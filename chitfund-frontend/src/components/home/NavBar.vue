<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeMenu = ref('')
const isMobileMenuOpen = ref(false)

function toggleDropdown(menu: string) {
  activeMenu.value = activeMenu.value === menu ? '' : menu
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown') && !target.closest('.mobile-menu-toggle')) {
    activeMenu.value = ''
  }
}

function handleNavigation() {
  activeMenu.value = ''
  isMobileMenuOpen.value = false
}

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
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
    
    <button class="mobile-menu-toggle" @click="toggleMobileMenu">
      <span class="hamburger"></span>
    </button>

    <div class="nav-menu" :class="{ 'mobile-open': isMobileMenuOpen }">
      <router-link to="/" class="nav-item" @click="handleNavigation">
        <i class="fas fa-home"></i> Home
      </router-link>
      
      <div class="dropdown">
        <button class="nav-item" @click.stop="toggleDropdown('members')">
          <i class="fas fa-users"></i> Members
          <span class="arrow">▼</span>
        </button>
        <div v-show="activeMenu === 'members'" class="dropdown-menu">
          <router-link to="/members" class="dropdown-item" @click="handleNavigation">View Members</router-link>
          <router-link to="/members/add" class="dropdown-item" @click="handleNavigation">Add Member</router-link>
        </div>
      </div>
      
      <div class="dropdown">
        <button class="nav-item" @click.stop="toggleDropdown('groups')">
          <i class="fas fa-layer-group"></i> Groups
          <span class="arrow">▼</span>
        </button>
        <div v-show="activeMenu === 'groups'" class="dropdown-menu">
          <router-link to="/groups" class="dropdown-item" @click="handleNavigation">View Groups</router-link>
          <router-link to="/groups/add" class="dropdown-item" @click="handleNavigation">Add Group</router-link>
        </div>
      </div>
      
      <div class="dropdown">
        <button class="nav-item" @click.stop="toggleDropdown('collections')">
          <i class="fas fa-money-bill-wave"></i> Collections
          <span class="arrow">▼</span>
        </button>
        <div v-show="activeMenu === 'collections'" class="dropdown-menu">
          <router-link to="/collections" class="dropdown-item" @click="handleNavigation">View Collections</router-link>
          <router-link to="/collections/add" class="dropdown-item" @click="handleNavigation">Add Collection</router-link>
        </div>
      </div>

      <div class="dropdown">
        <button class="nav-item" @click.stop="toggleDropdown('reports')">
          <i class="fas fa-chart-bar"></i> Reports
          <span class="arrow">▼</span>
        </button>
        <div v-show="activeMenu === 'reports'" class="dropdown-menu">
          <router-link to="/reports/chit-ledger" class="dropdown-item" @click="handleNavigation">Chit Ledger</router-link>
          <router-link to="/reports/customer-sheet" class="dropdown-item" @click="handleNavigation">Customer Sheet</router-link>
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
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.nav-brand {
  cursor: pointer;
  z-index: 1001;
}

.nav-brand h1 {
  color: white;
  margin: 0;
  font-size: 1.5rem;
  white-space: nowrap;
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
  white-space: nowrap;
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
  white-space: nowrap;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
  color: #3498db;
}

.mobile-menu-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  z-index: 1001;
}

.hamburger {
  display: block;
  width: 24px;
  height: 2px;
  background: white;
  position: relative;
  transition: background 0.3s;
}

.hamburger::before,
.hamburger::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 2px;
  background: white;
  transition: transform 0.3s;
}

.hamburger::before {
  top: -8px;
}

.hamburger::after {
  bottom: -8px;
}

/* Tablet breakpoint */
@media (max-width: 1024px) {
  .navbar {
    padding: 1rem;
  }

  .nav-brand h1 {
    font-size: 1.25rem;
  }

  .nav-item {
    padding: 0.5rem;
    font-size: 0.9rem;
  }
}

/* Mobile breakpoint */
@media (max-width: 768px) {
  .mobile-menu-toggle {
    display: block;
  }

  .nav-menu {
    position: fixed;
    top: 0;
    right: -100%;
    width: 80%;
    max-width: 300px;
    height: 100vh;
    background: #2c3e50;
    flex-direction: column;
    padding: 5rem 1rem 1rem;
    transition: right 0.3s ease;
    z-index: 1000;
  }

  .nav-menu.mobile-open {
    right: 0;
  }

  .dropdown-menu {
    position: static;
    background: transparent;
    box-shadow: none;
    margin-top: 0.5rem;
    margin-left: 1rem;
  }

  .dropdown-item {
    color: white;
    padding: 0.5rem 1rem;
  }

  .dropdown-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .nav-item {
    width: 100%;
    justify-content: space-between;
  }
}

/* Small mobile breakpoint */
@media (max-width: 480px) {
  .navbar {
    padding: 0.75rem;
  }

  .nav-brand h1 {
    font-size: 1.1rem;
  }
}
</style> 