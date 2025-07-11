<template>
  <div class="selection-container">
    <div v-if="shouldShowStatusFilter" class="form-group">
      <label for="status-search">Group Status</label>
      <div class="cs-dropdown">
        <div class="cs-dropdown-selected" @click="statusDropdownOpen = !statusDropdownOpen">
          {{ selectedStatusText || statusPlaceholder }}
          <span class="cs-dropdown-arrow">▼</span>
        </div>
        <div v-if="statusDropdownOpen" class="cs-dropdown-list multi-select" @mousedown.prevent>
          <input
            id="status-search"
            name="status-search"
            v-model="statusSearch"
            class="cs-dropdown-search"
            placeholder="Search status..."
            @mousedown.stop
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
            @click="handleStatusClick(status)"
            style="cursor:pointer;"
          >
            <input 
              type="checkbox" 
              :checked="selectedStatusIds.includes(status.id)"
              readonly
              tabindex="-1"
              style="pointer-events:none;"
            />
            <span>{{ status.name }}</span>
          </div>
          <div v-if="!filteredStatuses.length" class="cs-dropdown-noresult">No statuses found</div>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label for="group-search">
        Groups 
        <span v-if="shouldShowStatusFilter && selectedStatusIds.length === 0" class="group-count-indicator warning">
          (Select status first)
        </span>
        <span v-else-if="shouldShowStatusFilter && selectedStatusIds.length > 0" class="group-count-indicator">
          ({{ filteredGroups.length }} available)
        </span>
      </label>
      <div class="cs-dropdown">
        <div 
          class="cs-dropdown-selected" 
          :class="{ 'disabled': shouldShowStatusFilter && selectedStatusIds.length === 0 }"
          @click="shouldShowStatusFilter && selectedStatusIds.length === 0 ? null : (groupDropdownOpen = !groupDropdownOpen)"
        >
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
              @click.stop="selectAllGroups"
              :disabled="selectedGroupIds.length === filteredGroups.length"
            >
              Select All
            </button>
            <button 
              type="button" 
              class="action-btn clear-all-btn" 
              @click.stop="clearAllGroups"
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
            @click="handleGroupClick(group)"
          >
            <input 
              v-if="props.multiSelectGroups"
              type="checkbox" 
              :checked="selectedGroupIds.includes(group.id)"
              readonly
            />
            <span>{{ group.name }}</span>
          </div>
          <div v-if="!filteredGroups.length" class="cs-dropdown-noresult">{{ noGroupsMessage }}</div>
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
  status?: string
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
  enableStatusFilter?: boolean
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
  statusModelValue: () => ['active'], // Default to active status for backward compatibility
  disabled: false,
  multiSelectGroups: true,
  enableStatusFilter: undefined // Auto-detect if not specified
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
  
  // If status filter is enabled but no status is selected, show no groups
  if (shouldShowStatusFilter.value && selectedStatusIds.value.length === 0) {
    return []
  }
  
  // First filter by status - only apply status filtering if it's enabled and we have status selections
  let groups = props.groups
  if (shouldShowStatusFilter.value && selectedStatusIds.value.length > 0) {
    groups = props.groups.filter(g => {
      // If group doesn't have status property, assume it matches 'active' status for backward compatibility
      if (!g.status) {
        return selectedStatusIds.value.includes('active')
      }
      // Include group if its status is in the selected statuses
      return selectedStatusIds.value.includes(g.status.toLowerCase())
    })
  }
  
  // Then filter by search text
  return groups.filter(g => g.name.toLowerCase().includes(search))
})

const filteredStatuses = computed(() => {
  const search = statusSearch.value.toLowerCase()
  return props.statusOptions.filter(s => s.name.toLowerCase().includes(search))
})

const hasStatusProperty = computed(() => {
  // Check if any group has a status property
  return props.groups.some(g => g.status !== undefined)
})

const shouldShowStatusFilter = computed(() => {
  // If enableStatusFilter is explicitly set, use that value
  if (props.enableStatusFilter !== undefined) {
    return props.enableStatusFilter
  }
  
  // Auto-detect: Show status filter if groups have status property or if statusModelValue is provided
  return hasStatusProperty.value || props.statusModelValue
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

const noGroupsMessage = computed(() => {
  // If status filter is shown but no status is selected
  if (shouldShowStatusFilter.value && selectedStatusIds.value.length === 0) {
    return 'Please select a status first to view groups'
  }
  
  if (groupSearch.value && filteredGroups.value.length === 0) {
    return 'No groups found matching search'
  }
  if (shouldShowStatusFilter.value && selectedStatusIds.value.length > 0 && filteredGroups.value.length === 0) {
    return 'No groups available for selected status'
  }
  return 'No groups found'
})

// Methods
function isStatusFilteringEffective(): boolean {
  // Returns true if status filtering will actually filter groups
  return shouldShowStatusFilter.value && hasStatusProperty.value && selectedStatusIds.value.length > 0
}

function clearStatusSelection() {
  // Public method that can be called by parent components to clear status
  selectedStatusIds.value = []
}

function handleGroupClick(group: Group) {
  if (props.disabled) return
  
  if (props.multiSelectGroups) {
    toggleGroup(group)
  } else {
    selectSingleGroup(group)
  }
}

function handleStatusClick(status: Status) {
  if (props.disabled) return
  toggleStatus(status)
}

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
  selectedGroupIds.value = allFilteredIds
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
  
  // Clear selected groups when status changes to avoid invalid selections
  clearSelectedGroupsIfNotMatchingStatus()
}

function selectAllStatuses() {
  if (props.disabled) return
  
  const allFilteredIds = filteredStatuses.value.map(s => s.id)
  selectedStatusIds.value = allFilteredIds
  
  // Clear selected groups when status changes
  clearSelectedGroupsIfNotMatchingStatus()
}

function clearAllStatuses() {
  if (props.disabled) return
  selectedStatusIds.value = []
  
  // Clear selected groups when status is cleared
  clearSelectedGroupsIfNotMatchingStatus()
}

function clearSelectedGroupsIfNotMatchingStatus() {
  // Only clear groups if status filtering is enabled
  if (!shouldShowStatusFilter.value) return
  
  // Check if any selected groups don't match the current status filter
  const validGroupIds = filteredGroups.value.map(g => g.id)
  const currentSelectedIds = selectedGroupIds.value.filter(id => validGroupIds.includes(id))
  
  // If some groups are no longer valid, update the selection
  if (currentSelectedIds.length !== selectedGroupIds.value.length) {
    selectedGroupIds.value = currentSelectedIds
  }
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

// Expose methods for parent components
defineExpose({
  clearStatusSelection,
  isStatusFilteringEffective
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

.group-count-indicator {
  font-size: 0.85rem;
  color: #2980b9;
  font-weight: 500;
  background: #e3f2fd;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  margin-left: 0.5rem;
}

.group-count-indicator.warning {
  color: #d68910;
  background: #fef9e7;
  border: 1px solid #f39c12;
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

.cs-dropdown-selected.disabled {
  background: #f5f6fa;
  color: #a4a4a4;
  cursor: not-allowed;
  border-color: #ddd;
}

.cs-dropdown-selected.disabled:hover {
  border-color: #ddd;
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
