<template>
  <div class="selection-container">
    <div class="form-group">
      <label for="status-search">Group Status</label>
      <div class="cs-dropdown">
        <div class="cs-dropdown-selected" @click="statusDropdownOpen = !statusDropdownOpen">
          {{ selectedStatusText || statusPlaceholder }}
          <span class="cs-dropdown-arrow">▼</span>
        </div>
        <div v-if="statusDropdownOpen" class="cs-dropdown-list multi-select" @click.stop>
          <input
            id="status-search"
            name="status-search"
            v-model="statusSearch"
            class="cs-dropdown-search"
            placeholder="Search status..."
            @click.stop
          />
          <div class="dropdown-actions">
            <button 
              type="button" 
              class="action-btn select-all-btn" 
              @click="selectAllStatuses"
              :disabled="selectedStatusIds.length === filteredStatuses.length"
            >
              Select All
            </button>
            <button 
              type="button" 
              class="action-btn clear-all-btn" 
              @click="clearAllStatuses"
              :disabled="selectedStatusIds.length === 0"
            >
              Clear All
            </button>
          </div>
          <div
            v-for="status in filteredStatuses"
            :key="status.id"
            class="cs-dropdown-item checkbox-item"
            :class="{ selected: selectedStatusIds.includes(status.id) }"
            @click="toggleStatus(status)"
          >
            <input 
              type="checkbox" 
              :checked="selectedStatusIds.includes(status.id)"
              @change="toggleStatus(status)"
            />
            <span>{{ status.name }}</span>
          </div>
          <div v-if="!filteredStatuses.length" class="cs-dropdown-noresult">No statuses found</div>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label for="group-search">Groups</label>
      <div class="cs-dropdown">
        <div class="cs-dropdown-selected" @click="groupDropdownOpen = !groupDropdownOpen">
          {{ selectedGroupsText || placeholder }}
          <span class="cs-dropdown-arrow">▼</span>
        </div>
        <div v-if="groupDropdownOpen" class="cs-dropdown-list" :class="{ 'multi-select': props.multiSelectGroups }" @click.stop>
          <input
            id="group-search"
            name="group-search"
            v-model="groupSearch"
            class="cs-dropdown-search"
            placeholder="Search groups..."
            @click.stop
          />
          <div v-if="props.multiSelectGroups" class="dropdown-actions">
            <button 
              type="button" 
              class="action-btn select-all-btn" 
              @click="selectAllGroups"
              :disabled="selectedGroupIds.length === filteredGroups.length"
            >
              Select All
            </button>
            <button 
              type="button" 
              class="action-btn clear-all-btn" 
              @click="clearAllGroups"
              :disabled="selectedGroupIds.length === 0"
            >
              Clear All
            </button>
          </div>
          <div
            v-for="group in filteredGroups"
            :key="group.id"
            class="cs-dropdown-item"
            :class="{ 
              'checkbox-item': props.multiSelectGroups,
              'selected': props.multiSelectGroups ? selectedGroupIds.includes(group.id) : selectedGroupIds[0] === group.id
            }"
            @click="props.multiSelectGroups ? toggleGroup(group) : selectSingleGroup(group)"
          >
            <input 
              v-if="props.multiSelectGroups"
              type="checkbox" 
              :checked="selectedGroupIds.includes(group.id)"
              @change="toggleGroup(group)"
            />
            <span>{{ group.name }}</span>
          </div>
          <div v-if="!filteredGroups.length" class="cs-dropdown-noresult">No groups found</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Group {
  id: number
  name: string
}

interface Status {
  id: string
  name: string
}

interface Props {
  groups: Group[]
  modelValue: number[]
  statusOptions?: Status[]
  statusModelValue?: string[]
  placeholder?: string
  statusPlaceholder?: string
  disabled?: boolean
  multiSelectGroups?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: number[]): void
  (e: 'update:statusModelValue', value: string[]): void
  (e: 'change', selectedGroups: Group[]): void
  (e: 'statusChange', selectedStatuses: Status[]): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select Groups',
  statusPlaceholder: 'Select Status',
  statusOptions: () => [
    { id: 'active', name: 'Active' },
    { id: 'inactive', name: 'Inactive' },
    { id: 'completed', name: 'Completed' }
  ],
  statusModelValue: () => [],
  disabled: false,
  multiSelectGroups: true
})

const emit = defineEmits<Emits>()

// Local state
const groupSearch = ref('')
const groupDropdownOpen = ref(false)
const statusSearch = ref('')
const statusDropdownOpen = ref(false)

// Computed properties
const selectedGroupIds = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    const selectedGroups = props.groups.filter(g => value.includes(g.id))
    emit('change', selectedGroups)
  }
})

const selectedStatusIds = computed({
  get: () => props.statusModelValue || [],
  set: (value) => {
    emit('update:statusModelValue', value)
    const selectedStatuses = props.statusOptions.filter(s => value.includes(s.id))
    emit('statusChange', selectedStatuses)
  }
})

const filteredGroups = computed(() => {
  const search = groupSearch.value.toLowerCase()
  return props.groups.filter(g => g.name.toLowerCase().includes(search))
})

const filteredStatuses = computed(() => {
  const search = statusSearch.value.toLowerCase()
  return props.statusOptions.filter(s => s.name.toLowerCase().includes(search))
})

const selectedGroupsText = computed(() => {
  if (selectedGroupIds.value.length === 0) return ''
  if (!props.multiSelectGroups || selectedGroupIds.value.length === 1) {
    const group = props.groups.find(g => g.id === selectedGroupIds.value[0])
    return group ? group.name : ''
  }
  return `${selectedGroupIds.value.length} groups selected`
})

const selectedStatusText = computed(() => {
  if (selectedStatusIds.value.length === 0) return ''
  if (selectedStatusIds.value.length === 1) {
    const status = props.statusOptions.find(s => s.id === selectedStatusIds.value[0])
    return status ? status.name : ''
  }
  return `${selectedStatusIds.value.length} statuses selected`
})

// Methods
function toggleGroup(group: Group) {
  if (props.disabled) return
  
  const currentIds = [...selectedGroupIds.value]
  const index = currentIds.indexOf(group.id)
  
  if (index > -1) {
    currentIds.splice(index, 1)
  } else {
    currentIds.push(group.id)
  }
  
  selectedGroupIds.value = currentIds
}

function selectSingleGroup(group: Group) {
  if (props.disabled) return
  
  selectedGroupIds.value = [group.id]
  groupDropdownOpen.value = false
  groupSearch.value = ''
}

function selectAllGroups() {
  if (props.disabled) return
  
  const allFilteredIds = filteredGroups.value.map(g => g.id)
  const newIds = [...new Set([...selectedGroupIds.value, ...allFilteredIds])]
  selectedGroupIds.value = newIds
}

function clearAllGroups() {
  if (props.disabled) return
  selectedGroupIds.value = []
}

function toggleStatus(status: Status) {
  if (props.disabled) return
  
  const currentIds = [...selectedStatusIds.value]
  const index = currentIds.indexOf(status.id)
  
  if (index > -1) {
    currentIds.splice(index, 1)
  } else {
    currentIds.push(status.id)
  }
  
  selectedStatusIds.value = currentIds
}

function selectAllStatuses() {
  if (props.disabled) return
  
  const allFilteredIds = filteredStatuses.value.map(s => s.id)
  const newIds = [...new Set([...selectedStatusIds.value, ...allFilteredIds])]
  selectedStatusIds.value = newIds
}

function clearAllStatuses() {
  if (props.disabled) return
  selectedStatusIds.value = []
}

function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  if (!target.closest('.cs-dropdown')) {
    groupDropdownOpen.value = false
    statusDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.selection-container {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.form-group {
  flex: 1;
  min-width: 200px;
  position: relative;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #34495e;
  font-weight: 600;
}

.cs-dropdown {
  position: relative;
}

.cs-dropdown-selected {
  padding: 0.7rem;
  border: 1.5px solid #b2bec3;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 1.05rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: border 0.2s;
}

.cs-dropdown-selected:hover {
  border-color: #2980b9;
}

.cs-dropdown-arrow {
  margin-left: 0.5rem;
  font-size: 1.1em;
  transition: transform 0.2s;
}

.cs-dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #b2bec3;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 8px rgba(44, 62, 80, 0.1);
  margin-top: 2px;
}

.cs-dropdown-search {
  width: 100%;
  padding: 0.5rem;
  border: none;
  border-bottom: 1px solid #b2bec3;
  font-size: 1rem;
  background: #f8fafc;
  outline: none;
}

.dropdown-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.action-btn {
  flex: 1;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.select-all-btn {
  background: #e3f2fd;
  color: #1976d2;
}

.select-all-btn:hover:not(:disabled) {
  background: #bbdefb;
}

.clear-all-btn {
  background: #fce4ec;
  color: #c2185b;
}

.clear-all-btn:hover:not(:disabled) {
  background: #f8bbd9;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cs-dropdown-item {
  padding: 0.7rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.cs-dropdown-item:hover {
  background: #e3f2fd;
}

.cs-dropdown-item.selected {
  background: #e8f5e8;
  font-weight: 600;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-item input[type="checkbox"] {
  width: auto;
  margin: 0;
  cursor: pointer;
  transform: scale(1.1);
}

.checkbox-item.selected {
  background: #e8f5e8;
  font-weight: 600;
}

.checkbox-item:hover {
  background: #e3f2fd;
}

.checkbox-item.selected:hover {
  background: #d4edda;
}

.cs-dropdown-noresult {
  padding: 0.7rem 1rem;
  color: #888;
  font-style: italic;
}
</style>
