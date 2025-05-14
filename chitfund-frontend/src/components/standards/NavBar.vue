<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showMembersDropdown = ref(false)
const showGroupsDropdown = ref(false)
const showCollectionsDropdown = ref(false)

function toggleDropdown(dropdown: string) {
  if (dropdown === 'members') {
    showMembersDropdown.value = !showMembersDropdown.value
    showGroupsDropdown.value = false
    showCollectionsDropdown.value = false
  } else if (dropdown === 'groups') {
    showGroupsDropdown.value = !showGroupsDropdown.value
    showMembersDropdown.value = false
    showCollectionsDropdown.value = false
  } else if (dropdown === 'collections') {
    showCollectionsDropdown.value = !showCollectionsDropdown.value
    showMembersDropdown.value = false
    showGroupsDropdown.value = false
  }
}

function handleNavigation() {
  showMembersDropdown.value = false
  showGroupsDropdown.value = false
  showCollectionsDropdown.value = false
}
</script>

<template>
  <nav class="navbar">
    <div class="navbar-brand">
      <router-link to="/" @click="handleNavigation">Chit Fund Management</router-link>
    </div>
    
    <div class="navbar-menu">
      <div class="navbar-item has-dropdown" @click.stop>
        <a class="navbar-link" @click="toggleDropdown('members')">
          Members
        </a>
        <div class="navbar-dropdown" v-show="showMembersDropdown">
          <router-link to="/members" @click="handleNavigation">View Members</router-link>
          <router-link to="/members/add" @click="handleNavigation">Add Member</router-link>
        </div>
      </div>

      <div class="navbar-item has-dropdown" @click.stop>
        <a class="navbar-link" @click="toggleDropdown('groups')">
          Groups
        </a>
        <div class="navbar-dropdown" v-show="showGroupsDropdown">
          <router-link to="/groups" @click="handleNavigation">View Groups</router-link>
          <router-link to="/groups/add" @click="handleNavigation">Add Group</router-link>
        </div>
      </div>

      <div class="navbar-item has-dropdown" @click.stop>
        <a class="navbar-link" @click="toggleDropdown('collections')">
          Collections
        </a>
        <div class="navbar-dropdown" v-show="showCollectionsDropdown">
          <router-link to="/collections" @click="handleNavigation">View Collections</router-link>
          <router-link to="/collections/add" @click="handleNavigation">Add Collection</router-link>
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
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.navbar-brand a {
  color: white;
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: bold;
}

.navbar-menu {
  display: flex;
  gap: 2rem;
}

.navbar-item {
  position: relative;
}

.navbar-link {
  color: white;
  text-decoration: none;
  cursor: pointer;
  padding: 0.5rem;
  display: block;
}

.navbar-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  min-width: 200px;
  z-index: 1000;
}

.navbar-dropdown a {
  color: #2c3e50;
  text-decoration: none;
  padding: 0.75rem 1rem;
  display: block;
}

.navbar-dropdown a:hover {
  background-color: #f8f9fa;
}
</style> 