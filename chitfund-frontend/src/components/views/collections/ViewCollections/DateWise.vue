<template>
  <div class="datewise-bg">
    <div class="datewise-container card">
      <div class="card-header">
        <h3>📅 Date Wise Collections</h3>
        <p class="header-description">View collections organized by date with expandable group details</p>
      </div>
      
      <div class="filters">
        <div class="filter-row">
          <div class="filter-item date-filter">
            <label for="date">📅 Date</label>
            <div class="date-input-container">
              <button type="button" @click="navigateDate('prev')" class="date-nav-button" title="Previous day">
                <span>←</span>
              </button>
              <input 
                type="text" 
                id="date" 
                v-model="dateInput" 
                placeholder="dd/mm/yyyy"
                class="date-input-text"
                @blur="() => { const parsed = parseDateInput(dateInput); if (parsed) selectedDate = parsed; }"
              />
              <input 
                type="date" 
                v-model="selectedDate" 
                class="date-input-hidden"
                @change="dateInput = formatDateForDisplay(selectedDate)"
              />
              <button type="button" @click="toggleCalendar" class="calendar-toggle-button" title="Open calendar">
                <span>📅</span>
              </button>
              <button type="button" @click="navigateDate('next')" class="date-nav-button" title="Next day">
                <span>→</span>
              </button>
            </div>

            <!-- Calendar Widget -->
            <div v-if="showCalendar" class="calendar-widget">
              <div class="calendar-header">
                <button type="button" @click="navigateCalendar('prev')" class="calendar-nav-button">
                  <span>‹</span>
                </button>
                <h3 class="calendar-month-year">{{ getCalendarMonthYear() }}</h3>
                <button type="button" @click="navigateCalendar('next')" class="calendar-nav-button">
                  <span>›</span>
                </button>
              </div>
              <div class="calendar-grid">
                <div class="calendar-weekdays">
                  <div class="calendar-weekday">Sun</div>
                  <div class="calendar-weekday">Mon</div>
                  <div class="calendar-weekday">Tue</div>
                  <div class="calendar-weekday">Wed</div>
                  <div class="calendar-weekday">Thu</div>
                  <div class="calendar-weekday">Fri</div>
                  <div class="calendar-weekday">Sat</div>
                </div>
                <div class="calendar-days">
                  <button
                    v-for="day in getCalendarDays()"
                    :key="day.date.getTime()"
                    type="button"
                    @click="selectCalendarDate(day.date)"
                    :class="{
                      'calendar-day': true,
                      'current-month': day.isCurrentMonth,
                      'other-month': !day.isCurrentMonth,
                      'today': day.isToday,
                      'selected': day.isSelected
                    }"
                  >
                    {{ day.date.getDate() }}
                  </button>
                </div>
              </div>
              <div class="calendar-footer">
                <button type="button" @click="showCalendar = false" class="calendar-close-button">
                  Close Calendar
                </button>
              </div>
            </div>
          </div>
          
          <div class="filter-item group-filter">
            <label>🏢 Groups & Status</label>
            <GroupSelection
              :groups="groups.map(g => ({ id: g.id, name: g.name, status: g.status }))"
              v-model="selectedGroupIds"
              v-model:statusModelValue="selectedStatusIds"
              :multiSelectGroups="true"
              placeholder="Select groups"
              @change="handleGroupSelectionChange"
              @statusChange="handleStatusSelectionChange"
            />
          </div>
        </div>
        
        <!-- Centered Load Button -->
        <div class="load-button-container">
          <button class="submit-btn" @click="onSubmit" :disabled="!selectedDate || selectedGroupIds.length === 0">
            🔍 Load Collections
          </button>
        </div>
      </div>

      <!-- Group Summary Cards -->
      <div v-if="groupSummaries.length > 0" class="group-summaries">
        <div 
          v-for="summary in groupSummaries" 
          :key="summary.groupId"
          class="group-summary-card"
          :class="{ 'expanded': expandedGroups.has(summary.groupId) }"
          @click="toggleGroupExpansion(summary.groupId)"
        >
          <div class="group-summary-header">
            <div class="group-info">
              <h4 class="group-name">{{ summary.groupName }}</h4>
              <span class="member-count">{{ summary.memberCount }} members</span>
            </div>
            <div class="group-totals">
              <div class="amount-total">₹{{ summary.totalAmount.toLocaleString() }}</div>
              <div class="collection-count">{{ summary.collectionCount }} collections</div>
            </div>
            <div class="expand-icon">
              <span v-if="expandedGroups.has(summary.groupId)">▼</span>
              <span v-else>▶</span>
            </div>
          </div>

          <!-- Expandable Collection Details -->
          <div v-if="expandedGroups.has(summary.groupId)" class="group-details">
            <div class="table-responsive">
              <table class="collections-table">
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Member Name</th>
                    <th>Installment</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="(collection, index) in summary.collections" 
                    :key="collection.id"
                    class="collection-row"
                  >
                    <td>{{ index + 1 }}</td>
                    <td class="member-name">{{ collection.member_name }}</td>
                    <td class="installment-number">{{ collection.installment_number }}</td>
                    <td class="amount">₹{{ collection.collection_amount.toLocaleString() }}</td>
                    <td>
                      <span :class="['status-badge', getCollectionStatus(collection).class]">
                        {{ getCollectionStatus(collection).status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Overall Total -->
      <div v-if="groupSummaries.length > 0" class="overall-total">
        <div class="total-card">
            <h3>Total Summary - [ {{ formatDate(selectedDate) }} ]</h3>
          <div class="total-stats">
            <div class="stat-item">
              <span class="stat-label">Total Groups:</span>
              <span class="stat-value">{{ groupSummaries.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Collections:</span>
              <span class="stat-value">{{ getTotalCollectionCount() }}</span>
            </div>
            <div class="stat-item grand-total">
              <span class="stat-label">Grand Total Amount:</span>
              <span class="stat-value">₹{{ getGrandTotalAmount().toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else-if="selectedDate && selectedGroupIds.length > 0 && hasSearched" class="no-data">
        <div class="no-data-icon">📭</div>
        <h4>No Collections Found</h4>
        <p>No collections found for the selected date and groups.</p>
      </div>

      <!-- Initial State -->
      <div v-else-if="!hasSearched" class="initial-state">
        <div class="initial-icon">📅</div>
        <h4>Select Date and Groups</h4>
        <p>Choose a date and one or more groups to view collections</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useMembersStore } from '@/stores/MembersStore'
import GroupSelection from '@/components/standards/GroupSelection.vue'

const groupsStore = useGroupsStore()
const collectionsStore = useCollectionsStore()
const membersStore = useMembersStore()

const selectedDate = ref('')
const dateInput = ref('')
const showCalendar = ref(false)
const calendarDate = ref(new Date())
const selectedGroupIds = ref<number[]>([])
const selectedStatusIds = ref<string[]>(['active'])
const collections = ref<Collection[]>([])
const groups = ref<Group[]>([])
const groupSummaries = ref<GroupSummary[]>([])
const expandedGroups = ref<Set<number>>(new Set())
const hasSearched = ref(false)

interface Group {
  id: number
  name: string
  total_amount: number
  member_count: number
  start_date: string
  end_date: string
  status: string
  number_of_months: number
  created_at?: string
  updated_at?: string
}

interface Collection {
  id: number
  group_id: number
  member_id: number
  member_name: string
  installment_number: number
  collection_amount: number
  remaining_balance: number
  is_completed: boolean
  created_at: string
  updated_remaining_balance: number
}

interface GroupSummary {
  groupId: number
  groupName: string
  memberCount: number
  totalAmount: number
  collectionCount: number
  collections: Collection[]
}

function handleGroupSelectionChange(simpleGroups: { id: number; name: string }[]) {
  selectedGroupIds.value = simpleGroups.map(g => g.id)
}

function handleStatusSelectionChange(selectedStatuses: { id: string; name: string }[]) {
  selectedStatusIds.value = selectedStatuses.map(s => s.id)
}

// Date utility functions for enhanced date picker
function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function parseDateInput(input: string): string {
  if (!input) return ''
  
  // Handle dd/mm/yyyy format
  const ddmmyyyy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0')
    const month = ddmmyyyy[2].padStart(2, '0')
    const year = ddmmyyyy[3]
    return `${year}-${month}-${day}`
  }
  
  // Handle yyyy-mm-dd format (from date picker)
  const yyyymmdd = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (yyyymmdd) {
    return input
  }
  
  return ''
}

// Function to determine collection status based on updated_remaining_balance
function getCollectionStatus(collection: Collection): { status: string, class: string } {
  if (collection.updated_remaining_balance === 0) {
    return { status: 'Completed', class: 'completed' }
  } else if (collection.updated_remaining_balance > 0) {
    return { status: 'Pending', class: 'pending' }
  } else {
    return { status: 'Excess', class: 'excess' }
  }
}

function navigateDate(direction: 'prev' | 'next') {
  const currentDate = selectedDate.value ? new Date(selectedDate.value) : new Date()
  
  if (direction === 'prev') {
    currentDate.setDate(currentDate.getDate() - 1)
  } else {
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  const year = currentDate.getFullYear()
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0')
  const day = currentDate.getDate().toString().padStart(2, '0')
  
  selectedDate.value = `${year}-${month}-${day}`
  dateInput.value = formatDateForDisplay(selectedDate.value)
  calendarDate.value = currentDate
}

function toggleCalendar() {
  showCalendar.value = !showCalendar.value
  if (showCalendar.value && selectedDate.value) {
    calendarDate.value = new Date(selectedDate.value)
  }
}

function selectCalendarDate(date: Date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  
  selectedDate.value = `${year}-${month}-${day}`
  dateInput.value = formatDateForDisplay(selectedDate.value)
  calendarDate.value = date
  showCalendar.value = false
}

function navigateCalendar(direction: 'prev' | 'next') {
  const newDate = new Date(calendarDate.value)
  if (direction === 'prev') {
    newDate.setMonth(newDate.getMonth() - 1)
  } else {
    newDate.setMonth(newDate.getMonth() + 1)
  }
  calendarDate.value = newDate
}

function getCalendarDays() {
  const year = calendarDate.value.getFullYear()
  const month = calendarDate.value.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())
  
  const days = []
  const currentDate = new Date(startDate)
  
  for (let i = 0; i < 42; i++) {
    days.push({
      date: new Date(currentDate),
      isCurrentMonth: currentDate.getMonth() === month,
      isToday: currentDate.toDateString() === new Date().toDateString(),
      isSelected: selectedDate.value && currentDate.toDateString() === new Date(selectedDate.value).toDateString()
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return days
}

function getCalendarMonthYear() {
  return calendarDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

async function onSubmit() {
  if (selectedDate.value && selectedGroupIds.value.length > 0) {
    hasSearched.value = true
    await loadMembers()
    
    try {
      // Fetch collections for all selected groups
      const allCollections: Collection[] = []
      
      for (const groupId of selectedGroupIds.value) {
        try {
          const response = await collectionsStore.fetchCollectionsByDateAndGroup(
            selectedDate.value,
            groupId
          )
          const groupCollections = response.map((collection: any) => {
            const memberName = membersStore.members.find((m) => m.id === collection.member_id)?.name || 'Unknown Member'
            return {
              ...collection,
              group_id: groupId,
              member_name: memberName,
              is_completed: Boolean(collection.is_completed),
            }
          })
          allCollections.push(...groupCollections)
        } catch (error) {
          console.error(`Error fetching collections for group ${groupId}:`, error)
        }
      }
      
      collections.value = allCollections
      createGroupSummaries()
      
    } catch (error) {
      console.error('Error fetching collections:', error)
    }
  }
}

function createGroupSummaries() {
  const summariesMap = new Map<number, GroupSummary>()
  
  // Initialize summaries for all selected groups
  for (const groupId of selectedGroupIds.value) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      summariesMap.set(groupId, {
        groupId: groupId,
        groupName: group.name,
        memberCount: group.member_count,
        totalAmount: 0,
        collectionCount: 0,
        collections: []
      })
    }
  }
  
  // Populate with collection data
  for (const collection of collections.value) {
    const summary = summariesMap.get(collection.group_id)
    if (summary) {
      summary.collections.push(collection)
      summary.totalAmount += collection.collection_amount || 0
      summary.collectionCount += 1
    }
  }
  
  // Convert to array and sort by total amount (highest first)
  groupSummaries.value = Array.from(summariesMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
}

function toggleGroupExpansion(groupId: number) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
}

function getTotalCollectionCount(): number {
  return groupSummaries.value.reduce((total, summary) => total + summary.collectionCount, 0)
}

function getGrandTotalAmount(): number {
  return groupSummaries.value.reduce((total, summary) => total + summary.totalAmount, 0)
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch (error) {
    return dateString
  }
}

async function loadGroups() {
  await groupsStore.fetchGroups()
  groups.value = groupsStore.groups
}

async function loadMembers() {
  if (membersStore.members.length === 0) {
    await membersStore.fetchMembers()
  }
}

// Watch for date input changes to sync with selectedDate
watch(() => dateInput.value, (newValue) => {
  const parsedDate = parseDateInput(newValue)
  if (parsedDate) {
    selectedDate.value = parsedDate
  }
})

// Watch for selectedDate changes to update dateInput display
watch(() => selectedDate.value, (newValue) => {
  if (newValue) {
    dateInput.value = formatDateForDisplay(newValue)
    calendarDate.value = new Date(newValue)
  }
})

onMounted(() => {
  loadGroups()
  loadMembers()
  
  // Initialize date input display
  if (selectedDate.value) {
    dateInput.value = formatDateForDisplay(selectedDate.value)
  }
  
  // Close calendar when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.date-group') && showCalendar.value) {
      showCalendar.value = false
    }
  })
})
</script>

<style scoped>


.datewise-container {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2.5rem 2rem;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  background: #fff;
}

.card-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.card-header h3 {
  margin: 0 0 0.5rem 0;
  color: #1a237e;
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 1px;
}

.header-description {
  color: #6c757d;
  font-size: 1.1rem;
  margin: 0;
}

.filters {
  margin-bottom: 2.5rem;
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 15px;
  border: 1px solid #e9ecef;
}

.filter-row {
  display: flex;
  gap: 1.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.filter-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.filter-item.date-filter {
  flex: 0 0 auto;
  min-width: 350px;
  position: relative;
}

.filter-item.group-filter {
  flex: 1;
  min-width: 300px;
}

.load-button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
}



label {
  display: block;
  margin-bottom: 0.75rem;
  color: #2c3e50;
  font-weight: 600;
  font-size: 1rem;
}

input[type="date"] {
  width: 100%;
  padding: 0.875rem;
  border: 2px solid #e3f2fd;
  border-radius: 10px;
  font-size: 1rem;
  background: #fff;
  transition: all 0.3s ease;
}

input[type="date"]:focus {
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
  outline: none;
}

/* Enhanced Date Input Styles */
.date-input-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 2px solid #e3f2fd;
  border-radius: 10px;
  background: white;
  overflow: hidden;
  transition: all 0.3s ease;
}

.date-input-container:focus-within {
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.date-nav-button, .calendar-toggle-button {
  background: #f8f9fa;
  border: none;
  padding: 0.875rem 0.5rem;
  cursor: pointer;
  color: #6c757d;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
}

.date-nav-button:hover, .calendar-toggle-button:hover {
  background: #e9ecef;
  color: #495057;
}

.date-nav-button:active, .calendar-toggle-button:active {
  background: #dee2e6;
}

.date-nav-button span, .calendar-toggle-button span {
  font-size: 1.2rem;
  font-weight: bold;
}

.calendar-toggle-button span {
  font-size: 1rem;
}

.date-input-text {
  flex: 1;
  border: none;
  padding: 0.875rem;
  outline: none;
  font-size: 1rem;
  background: transparent;
}

.date-input-hidden {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 1px;
  height: 1px;
}

/* Calendar Widget Styles */
.calendar-widget {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background: white;
  border: 1px solid #ddd;
  border-radius: 12px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  margin-top: 0.5rem;
  min-width: 300px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #e3f2fd 0%, #f8f9fa 100%);
  border-radius: 12px 12px 0 0;
}

.calendar-nav-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  color: #2196f3;
  transition: all 0.2s ease;
  font-size: 1.5rem;
  line-height: 1;
}

.calendar-nav-button:hover {
  background: rgba(33, 150, 243, 0.1);
  color: #1976d2;
}

.calendar-month-year {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1565c0;
}

.calendar-grid {
  padding: 1rem;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.calendar-weekday {
  padding: 0.5rem;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #2196f3;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
}

.calendar-day {
  padding: 0.75rem 0.5rem;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-day.current-month {
  color: #2c3e50;
}

.calendar-day.other-month {
  color: #bdc3c7;
}

.calendar-day:hover {
  background: #e3f2fd;
  color: #1976d2;
}

.calendar-day.today {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
  font-weight: 600;
}

.calendar-day.selected {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
  font-weight: 600;
}

.calendar-day.selected:hover {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
}

.calendar-footer {
  padding: 1rem;
  border-top: 1px solid #eee;
  text-align: center;
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
}

.calendar-close-button {
  background: #2196f3;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.calendar-close-button:hover {
  background: #1976d2;
}

.submit-btn {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #5ec2f0 0%, #69aece 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 25px rgba(129, 212, 250, 0.3);
  transition: all 0.3s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.submit-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  box-shadow: none;
}

.submit-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 35px rgba(129, 212, 250, 0.4);
}

.group-summaries {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.group-summary-card {
  background: #fff;
  border: 2px solid #e3f2fd;
  border-radius: 15px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

.group-summary-card:hover {
  border-color: #2196f3;
  box-shadow: 0 8px 25px rgba(33, 150, 243, 0.15);
  transform: translateY(-2px);
}

.group-summary-card.expanded {
  border-color: #4caf50;
  box-shadow: 0 8px 25px rgba(76, 175, 80, 0.15);
}

.group-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #e3f2fd 0%, #f8f9fa 100%);
}

.group-info h4 {
  margin: 0 0 0.25rem 0;
  color: #1565c0;
  font-size: 1.3rem;
  font-weight: 700;
}

.member-count {
  color: #6c757d;
  font-size: 0.9rem;
  font-weight: 500;
}

.group-totals {
  text-align: right;
}

.amount-total {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2e7d32;
  margin-bottom: 0.25rem;
}

.collection-count {
  color: #6c757d;
  font-size: 0.9rem;
}

.expand-icon {
  font-size: 1.2rem;
  color: #2196f3;
  font-weight: bold;
  transition: transform 0.3s ease;
}

.group-summary-card.expanded .expand-icon {
  transform: rotate(180deg);
}

.group-details {
  border-top: 1px solid #e9ecef;
  background: #fafafa;
}

.table-responsive {
  overflow-x: auto;
  padding: 1rem;
}

.collections-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.collections-table th,
.collections-table td {
  padding: 1rem 1.25rem;
  text-align: left;
  border-bottom: 1px solid #f1f3f4;
}

.collections-table th {
  background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
  color: #2e7d32;
  font-weight: 700;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.collection-row:hover {
  background: #f8f9fa;
  transition: background 0.2s ease;
}

.member-name {
  font-weight: 600;
  color: #2c3e50;
}

.installment-number {
  font-weight: 600;
  color: #3f51b5;
}

.amount {
  font-weight: 700;
  color: #2e7d32;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  display: inline-block;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.completed {
  background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);
  color: #1b5e20;
}

.status-badge.pending {
  background: linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%);
  color: #e65100;
}

.status-badge.excess {
  background: linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%);
  color: #b71c1c;
}

.time {
  color: #6c757d;
  font-size: 0.9rem;
}

.overall-total {
  margin-top: 2rem;
}

.total-card {
  background: linear-gradient(135deg, #4bdf8e 0%, #42e774 100%);
  color: #fff;
  padding: 2rem;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 15px 35px rgba(129, 212, 250, 0.3);
}

.total-card h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.total-stats {
  display: flex;
  justify-content: space-around;
  gap: 2rem;
  flex-wrap: wrap;
}

.stat-item {
  text-align: center;
  flex: 1;
  min-width: 150px;
}

.stat-label {
  display: block;
  font-size: 0.9rem;
  opacity: 0.9;
  margin-bottom: 0.5rem;
}

.stat-value {
  display: block;
  font-size: 1.8rem;
  font-weight: 700;
}

.grand-total .stat-value {
  font-size: 2.2rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.no-data, .initial-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #6c757d;
}

.no-data-icon, .initial-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.no-data h4, .initial-state h4 {
  margin: 0 0 1rem 0;
  color: #495057;
  font-size: 1.5rem;
  font-weight: 600;
}

.no-data p, .initial-state p {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.6;
}

/* Responsive Design */
@media (max-width: 768px) {
  .datewise-container {
    margin: 1rem;
    padding: 1.5rem;
  }
  
  .filters {
    flex-direction: column;
    gap: 1rem;
  }
  
  .date-group {
    flex: 1;
    min-width: auto;
  }
  
  .group-selection-wrapper {
    min-width: auto;
  }
  
  .group-summary-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .total-stats {
    flex-direction: column;
    gap: 1rem;
  }
  
  .stat-item {
    min-width: auto;
  }
  
  .collections-table th,
  .collections-table td {
    padding: 0.75rem 0.5rem;
    font-size: 0.9rem;
  }
  
  /* Calendar responsive adjustments */
  .calendar-widget {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90vw;
    max-width: 350px;
    margin-top: 0;
  }
  
  .date-input-container {
    flex-wrap: nowrap;
  }
  
  .date-nav-button, .calendar-toggle-button {
    min-width: 35px;
    padding: 0.75rem 0.4rem;
  }
  
  .date-nav-button span, .calendar-toggle-button span {
    font-size: 1rem;
  }
  
  .calendar-day {
    min-height: 35px;
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .card-header h3 {
    font-size: 1.8rem;
  }
  
  .header-description {
    font-size: 1rem;
  }
  
  .amount-total {
    font-size: 1.3rem;
  }
  
  .stat-value {
    font-size: 1.5rem;
  }
  
  .grand-total .stat-value {
    font-size: 1.8rem;
  }
}
</style>
