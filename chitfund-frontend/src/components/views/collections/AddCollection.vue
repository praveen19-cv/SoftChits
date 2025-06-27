<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useMembersStore } from '@/stores/MembersStore'
import type { CollectionBalance } from '@/stores/CollectionsStore'
import type { CollectionSheetRow } from './CollectionSheetRow.ts'
import StandardNotification from '@/components/standards/StandardNotification.vue'
import CollectionSheetTable from './CollectionSheetTable.vue'

interface Group {
  id: number
  name: string
  total_amount: number
  member_count: number
  start_date: string
  end_date: string
  status: string
  number_of_months: number
}

interface Member {
  id: number
  name: string
  phone: string
  email: string
  address: string
  status: string
  group_id: number
}

interface ExistingCollection {
  id: number;
  collection_date: string;
  group_id: number;
  member_id: number;
  installment_number: number;
  collection_amount: number;
  remaining_balance: number;
  is_completed: number;
  created_at: string;
}

const router = useRouter()
const collectionsStore = useCollectionsStore()
const groupsStore = useGroupsStore()
const membersStore = useMembersStore()

const groups = ref<Group[]>([])
const members = ref<Member[]>([])
const groupMembers = ref<Member[]>([])

const collection = ref({
  date: '',
  group_id: '',
  status: 'pending'
})

// Date input state for enhanced date picker
const dateInput = ref('')
const showCalendar = ref(false)
const calendarDate = ref(new Date())

const collectionSheet = ref<CollectionSheetRow[]>([])
const originalCollectionSheet = ref<CollectionSheetRow[]>([]) // Track original state for comparison
const collectionBalances = ref<CollectionBalance[]>([])
const selectedGroup = ref<Group | null>(null)
const errorMessage = ref('')
const showPrompt = ref(false)
const promptMessage = ref('')

// New state for managing data sources
const isAfterSubmission = ref(false)
const submittedCollections = ref<any[]>([])

// Notification state
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref<'success' | 'error'>('success')

function showSuccessNotification(message: string) {
  notificationMessage.value = message
  notificationType.value = 'success'
  showNotification.value = true
}

function showErrorNotification(message: string) {
  notificationMessage.value = message
  notificationType.value = 'error'
  showNotification.value = true
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

function navigateDate(direction: 'prev' | 'next') {
  const currentDate = collection.value.date ? new Date(collection.value.date) : new Date()
  
  if (direction === 'prev') {
    currentDate.setDate(currentDate.getDate() - 1)
  } else {
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  const year = currentDate.getFullYear()
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0')
  const day = currentDate.getDate().toString().padStart(2, '0')
  
  collection.value.date = `${year}-${month}-${day}`
  dateInput.value = formatDateForDisplay(collection.value.date)
  calendarDate.value = currentDate
}

function toggleCalendar() {
  showCalendar.value = !showCalendar.value
  if (showCalendar.value && collection.value.date) {
    calendarDate.value = new Date(collection.value.date)
  }
}

function selectCalendarDate(date: Date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  
  collection.value.date = `${year}-${month}-${day}`
  dateInput.value = formatDateForDisplay(collection.value.date)
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
      isSelected: collection.value.date && currentDate.toDateString() === new Date(collection.value.date).toDateString()
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return days
}

function getCalendarMonthYear() {
  return calendarDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

async function loadGroupsAndMembers() {
  try {
    await Promise.all([
      groupsStore.fetchGroups(),
      membersStore.fetchMembers()
    ])
    groups.value = groupsStore.groups as Group[]
    members.value = membersStore.members as Member[]
  } catch (error) {
    showErrorNotification('Failed to load groups and members')
  }
}

async function loadExistingCollections() {
  if (!collection.value.date || !collection.value.group_id) {
    return;
  }

  try {
    // Check if there are actual submitted collections for this date FIRST
    let existingCollections: ExistingCollection[] = [];
    try {
      existingCollections = await collectionsStore.fetchCollectionsByDateAndGroup(
        collection.value.date,
        Number(collection.value.group_id)
      ) as ExistingCollection[];
    } catch (collectionError) {
      // No submitted collections found
      existingCollections = [];
    }

    if (existingCollections.length > 0) {
      // AFTER SUBMISSION: Show actual collection data from collection table
      isAfterSubmission.value = true;
      submittedCollections.value = existingCollections;

      // Update collection sheet with submitted collection data
      collectionSheet.value = collectionSheet.value.map(row => {
        const memberCollections = existingCollections.filter(c => c.member_id === row.memberId);
        if (memberCollections.length > 0) {
          // Show the actual submitted data
          const firstCollection = memberCollections[0];
          const installmentString = memberCollections
            .map(c => `${c.installment_number}${c.is_completed ? 'c' : ''}`)
            .join(',');
          const totalAmount = memberCollections.reduce((sum: number, c: ExistingCollection) => sum + c.collection_amount, 0);
          
          // For installment balances, show the actual remaining balance from collection table
          const installmentBalances: { [key: number]: number } = {};
          memberCollections.forEach((c: ExistingCollection) => {
            // Show the remaining balance as it was when the collection was made
            installmentBalances[c.installment_number] = c.remaining_balance;
          });
          
          return {
            ...row,
            id: firstCollection.id,
            installment: installmentString,
            amount: totalAmount.toString(),
            installmentBalances
          };
        }
        return row;
      });
    } else {
      // BEFORE SUBMISSION: Fetch incomplete balances from collection_balance table
      // This shows only unpaid installments in ascending order
      isAfterSubmission.value = false;
      
      const incompleteBalances = await collectionsStore.fetchIncompleteCollectionBalances(
        Number(collection.value.group_id)
      );

      // Update collection sheet with incomplete balance data
      collectionSheet.value = collectionSheet.value.map(row => {
        const memberIncompleteBalances = incompleteBalances
          .filter((b: any) => b.member_id === row.memberId)
          .sort((a: any, b: any) => a.installment_number - b.installment_number);
        
        if (memberIncompleteBalances.length > 0) {
          // Show incomplete installments data
          const installmentBalances: { [key: number]: number } = {};
          
          memberIncompleteBalances.forEach((balance: any) => {
            installmentBalances[balance.installment_number] = balance.remaining_balance;
          });
          
          return {
            ...row,
            installmentBalances,
            // Clear amount and installment to allow fresh input
            amount: '',
            installment: ''
          };
        }
        return row;
      });
    }

    // Save the original state after loading data
    saveOriginalState();

  } catch (error) {
    console.error('Error loading collection data:', error);
    showErrorNotification('Failed to load collection data');
  }
}

async function getPreviousCollections(memberId: number): Promise<ExistingCollection[]> {
  try {
    const allCollections = await collectionsStore.fetchCollectionsByGroup(Number(collection.value.group_id));
    return allCollections.filter(c =>
      c.member_id === memberId &&
      new Date(c.collection_date) < new Date(collection.value.date)
    );
  } catch (error) {
    return [];
  }
}

async function handleGroupChange() {
  // Clear the collection sheet immediately when group changes
  collectionSheet.value = [];
  collectionBalances.value = [];
  
  // Reset submission state
  isAfterSubmission.value = false;
  submittedCollections.value = [];
  
  const group = groups.value.find(g => g.id === Number(collection.value.group_id))
  if (group) {
    selectedGroup.value = group
    errorMessage.value = '';
  } else {
    selectedGroup.value = null
    errorMessage.value = '';
  }
}

async function loadGroupMembers() {
  const group = groups.value.find(g => g.id === Number(collection.value.group_id))

  if (!group) {
    showErrorNotification('Please select a group first');
    return;
  }

  selectedGroup.value = group
  errorMessage.value = '';

  // Clear existing data first
  collectionSheet.value = [];
  collectionBalances.value = [];

  try {
    // Fetch group members from the specific API endpoint
    const response = await groupsStore.fetchGroupMembers(group.id);
    const groupMembersFiltered = response as Member[];
    groupMembers.value = groupMembersFiltered;
    
    if (groupMembersFiltered.length === 0) {
      showErrorNotification(`No members found for group "${group.name}". Please add members to this group first.`);
      return;
    }
    
    // Create fresh collection sheet - ALWAYS show this when group is selected
    collectionSheet.value = groupMembersFiltered.map((member, index) => ({
      serialNo: index + 1,
      memberId: Number(member.id),
      memberName: member.name,
      installment: '',
      amount: '',
      installmentBalances: {}
    }))

    try {
      // Load incomplete collection balances for this group (for installment calculation)
      collectionBalances.value = await collectionsStore.fetchIncompleteCollectionBalances(Number(collection.value.group_id))
    } catch (error) {
      showErrorNotification('Failed to load collection balances')
    }

    // Load existing collections if date is also selected
    if (collection.value.date) {
      await loadExistingCollections();
    } else {
      // If no date selected yet, save the current state as original
      saveOriginalState();
    }

    showSuccessNotification(`Loaded ${groupMembersFiltered.length} members for ${group.name}`);
  } catch (error) {
    showErrorNotification(`Failed to load members for group "${group.name}". Please try again.`);
  }
}

function calculateMonthlySubscription() {
  if (!selectedGroup.value) return 0
  return selectedGroup.value.total_amount / selectedGroup.value.member_count
}

function getTotalPaidForMember(memberId: number): number {
  return collectionSheet.value
    .filter(r => r.memberId === memberId)
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
}

function isMonthlySubscriptionComplete(row: CollectionSheetRow): boolean {
  if (!selectedGroup.value || !row.amount) return false;
  const monthlySubscription = calculateMonthlySubscription();
  const amount = parseFloat(row.amount) || 0;

  const installments = row.installment.split(',').map(inst => {
    const isCompleted = inst.endsWith('c');
    const number = parseInt(inst.replace('c', ''));
    return { number, isCompleted };
  });

  return installments.some(inst => !inst.isCompleted && amount >= monthlySubscription);
}

async function handleAmountChange(row: CollectionSheetRow) {
  // The InstallmentCalculator component will handle the installment calculation automatically
  // This function is kept for backward compatibility and any additional processing needed
  if (!row.amount || !selectedGroup.value) return;
  
  // Any additional validation or processing can be added here
  const amount = parseFloat(row.amount);
  if (isNaN(amount) || amount < 0) {
    row.amount = '';
    return;
  }
}

function handleInstallmentChange(row: CollectionSheetRow) {
  // Basic validation for installment format
  if (!row.installment) return;
  
  // The InstallmentBalanceDisplay component will handle the balance calculation
  // Any additional validation can be added here
}

// Helper functions for tracking changes and selective updates
// This system tracks the original state when data is loaded and only
// submits changes for rows that have actually been modified by the user
function saveOriginalState() {
  originalCollectionSheet.value = JSON.parse(JSON.stringify(collectionSheet.value));
}

function getChangedRows(): { 
  toSave: CollectionSheetRow[], 
  toDelete: CollectionSheetRow[], 
  unchanged: CollectionSheetRow[] 
} {
  const toSave: CollectionSheetRow[] = [];
  const toDelete: CollectionSheetRow[] = [];
  const unchanged: CollectionSheetRow[] = [];
  
  for (const currentRow of collectionSheet.value) {
    const originalRow = originalCollectionSheet.value.find(orig => orig.memberId === currentRow.memberId);
    
    // If no original row exists, this is new data
    if (!originalRow) {
      if (currentRow.memberId && currentRow.amount && !isNaN(parseFloat(currentRow.amount)) && 
          currentRow.installment && parseFloat(currentRow.amount) > 0) {
        toSave.push(currentRow);
      }
      continue;
    }
    
    // Check if row has meaningful data now
    const hasCurrentData = currentRow.memberId && currentRow.amount && 
                          !isNaN(parseFloat(currentRow.amount)) && 
                          currentRow.installment && parseFloat(currentRow.amount) > 0;
    
    // Check if row had meaningful data before
    const hadOriginalData = originalRow.amount && !isNaN(parseFloat(originalRow.amount)) && 
                           originalRow.installment && parseFloat(originalRow.amount) > 0;
    
    // Compare actual values for changes
    const amountChanged = originalRow.amount !== currentRow.amount;
    const installmentChanged = originalRow.installment !== currentRow.installment;
    const hasChanges = amountChanged || installmentChanged;
    
    if (hadOriginalData && !hasCurrentData) {
      // Had data before, now doesn't - mark for deletion
      toDelete.push({ ...originalRow });
    } else if (hasCurrentData && (hasChanges || !hadOriginalData)) {
      // Has data now and either changed or is new - mark for save
      toSave.push(currentRow);
    } else {
      // No changes
      unchanged.push(currentRow);
    }
  }
  
  return { toSave, toDelete, unchanged };
}

// Debug function to help test change tracking (can be removed later)
function debugChanges() {
  const { toSave, toDelete, unchanged } = getChangedRows();
  console.log('Debug Changes:', {
    toSave: toSave.map(r => ({ memberId: r.memberId, name: r.memberName, amount: r.amount, installment: r.installment })),
    toDelete: toDelete.map(r => ({ memberId: r.memberId, name: r.memberName, amount: r.amount, installment: r.installment })),
    unchanged: unchanged.map(r => ({ memberId: r.memberId, name: r.memberName, amount: r.amount, installment: r.installment }))
  });
  return { toSave, toDelete, unchanged };
}

async function deleteSpecificCollections(memberCollections: ExistingCollection[]) {
  for (const collection of memberCollections) {
    try {
      await collectionsStore.deleteCollection(collection.id, Number(collection.group_id));
    } catch (deleteError) {
      console.warn('Failed to delete collection:', collection.id, deleteError);
      throw deleteError;
    }
  }
}

async function handleSubmit() {
  try {
    errorMessage.value = '';
    if (!collection.value.date || !collection.value.group_id) {
      showErrorNotification('Please fill in all required fields');
      return;
    }

    // Use change tracking to identify what actually changed
    const { toSave, toDelete, unchanged } = getChangedRows();

    if (toSave.length === 0 && toDelete.length === 0) {
      showErrorNotification('No changes detected. Please make changes to collections before submitting.');
      return;
    }

    let hasError = false;

    // First, handle deletions for rows that had data but now don't
    for (const row of toDelete) {
      try {
        // Only delete collections for this specific member that we know existed
        const oldCollections = await collectionsStore.fetchCollectionsByDateAndGroup(
          collection.value.date,
          Number(collection.value.group_id)
        );
        const memberOldCollections = oldCollections.filter((c: any) => c.member_id === row.memberId);
        
        if (memberOldCollections.length > 0) {
          await deleteSpecificCollections(memberOldCollections);
        }
      } catch (error: any) {
        hasError = true;
        showErrorNotification(`Failed to delete collection for member ID ${row.memberId}: ${error.message}`);
      }
    }

    // Now handle saves/updates for only the changed rows
    for (const row of toSave) {
      // The backend expects simple data: just the amount and starting installment
      // It will automatically distribute the payment across installments
      const installmentNumbers = row.installment.split(',').map(inst => {
        const cleanInst = inst.replace('c', '');
        return parseInt(cleanInst);
      }).filter(num => !isNaN(num));

      // Use the first (lowest) installment number as the starting point
      const startingInstallmentNumber = Math.min(...installmentNumbers) || 1;

      const payload = {
        group_id: Number(collection.value.group_id),
        member_id: row.memberId,
        installment_number: startingInstallmentNumber,
        collection_amount: parseFloat(row.amount),
        date: collection.value.date
      };

      try {
        // For updates, we need to handle existing data more carefully
        if (row.id) {
          // This row had existing data - delete only this member's collections for this date
          const oldCollections = await collectionsStore.fetchCollectionsByDateAndGroup(
            collection.value.date,
            Number(collection.value.group_id)
          );
          const memberOldCollections = oldCollections.filter((c: any) => c.member_id === row.memberId);
          
          // Delete existing collections for this member
          if (memberOldCollections.length > 0) {
            await deleteSpecificCollections(memberOldCollections);
            // Wait a bit to ensure deletions complete
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        // Create the new collection - backend will handle installment distribution
        await collectionsStore.createCollection(payload);
        
      } catch (error: any) {
        hasError = true;
        console.error('Error saving collection for member:', row.memberId, error);
        const errorDetails = error.response?.data?.details || error.message || 'Unknown error';
        showErrorNotification(`Failed to save collection for member ID ${row.memberId}: ${errorDetails}`);
        
        // If it's a unique constraint error, try a different approach
        if (errorDetails.includes('UNIQUE constraint failed')) {
          console.warn('Unique constraint violation detected, this suggests the record may already exist');
        }
      }
    }

    if (!hasError) {
      let message = '';
      if (toSave.length > 0 && toDelete.length > 0) {
        message = `Collections updated successfully! ${toSave.length} saved, ${toDelete.length} deleted.`;
      } else if (toSave.length > 0) {
        message = `${toSave.length} collections saved successfully!`;
      } else if (toDelete.length > 0) {
        message = `${toDelete.length} collections deleted successfully!`;
      } else {
        message = 'Collections updated successfully!';
      }
      showSuccessNotification(message);
      
      // After successful submission, clear the collection sheet but keep date and group for easy navigation
      // This allows users to quickly move to next date without losing context
      collectionSheet.value = [];
      originalCollectionSheet.value = [];
      collectionBalances.value = [];
      isAfterSubmission.value = false;
      submittedCollections.value = [];
      
      // Keep the group selected but clear any error messages
      errorMessage.value = '';
      
      // Show a helpful message about what to do next
      setTimeout(() => {
        showSuccessNotification('Collection saved! You can now select a different date or group to continue.');
      }, 1500);
    } else {
      showErrorNotification('Some collections failed to save. Please check the notifications for details.');
    }

  } catch (error: any) {
    showErrorNotification(error.response?.data?.message || error.message || 'Failed to create/update collections');
  }
}

function validateForm() {
  if (!collection.value.date || !collection.value.group_id || collectionSheet.value.length === 0) {
    showErrorNotification('Please fill in all required fields');
    return false;
  }

  const invalidRows = collectionSheet.value
    .filter(row => row.amount && isNaN(parseFloat(row.amount)));

  if (invalidRows.length > 0) {
    showErrorNotification('Please enter valid amounts for all members');
    return false;
  }

  return true;
}

// Computed property for total collected amount
const totalCollectedAmount = computed(() => {
  return collectionSheet.value.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)
})

function getMemberBalances(memberId: number): CollectionBalance[] {
  return collectionBalances.value.filter(b => b.member_id === memberId)
}

function getInstallmentStatus(memberId: number, installmentNumber: number): { isCompleted: boolean; remainingBalance: number } {
  const balance = collectionBalances.value.find(
    b => b.member_id === memberId && b.installment_number === installmentNumber
  )
  return {
    isCompleted: balance?.is_completed || false,
    remainingBalance: balance?.remaining_balance || calculateMonthlySubscription()
  }
}

watch([
  () => collection.value.date,
  () => collection.value.group_id
], async ([newDate, newGroupId], [oldDate, oldGroupId]) => {
  // Clear collection sheet immediately when group changes
  if (newGroupId !== oldGroupId) {
    collectionSheet.value = [];
    originalCollectionSheet.value = [];
    collectionBalances.value = [];
    selectedGroup.value = null;
    errorMessage.value = '';
    isAfterSubmission.value = false;
    submittedCollections.value = [];
    return;
  }
  
  // When date changes and we have both group and date, reload existing collections
  if (newDate !== oldDate) {
    errorMessage.value = '';
    isAfterSubmission.value = false;
    submittedCollections.value = [];
    
    // Update date display when date changes programmatically
    if (newDate) {
      dateInput.value = formatDateForDisplay(newDate);
      
      // If we have both group and date, reload the collection data
      if (newGroupId && collectionSheet.value.length > 0) {
        await loadExistingCollections();
      }
    } else {
      dateInput.value = '';
      // If date is cleared, reset to fresh state but keep the member data
      if (collectionSheet.value.length > 0) {
        collectionSheet.value = collectionSheet.value.map(row => ({
          ...row,
          amount: '',
          installment: '',
          id: undefined
        }));
        saveOriginalState();
      }
    }
  }
});

// Watch for date input changes to sync with collection.date
watch(() => dateInput.value, (newValue) => {
  const parsedDate = parseDateInput(newValue)
  if (parsedDate) {
    collection.value.date = parsedDate
  }
})

// Initialize date input display when component mounts
onMounted(() => {
  loadGroupsAndMembers()
  if (collection.value.date) {
    dateInput.value = formatDateForDisplay(collection.value.date)
  }
  
  // Close calendar when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.form-group') && showCalendar.value) {
      showCalendar.value = false
    }
  })
})
</script>

<template>
  <div class="add-collection">
    <div class="header">
      <h2>Add New Collection</h2>
    </div>
    <form @submit.prevent="handleSubmit" class="collection-form">
      <div class="form-row">
        <div class="form-group">
          <label for="date">Date</label>
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
              @blur="() => { const parsed = parseDateInput(dateInput); if (parsed) collection.date = parsed; }"
              required 
            />
            <input 
              type="date" 
              v-model="collection.date" 
              class="date-input-hidden"
              @change="dateInput = formatDateForDisplay(collection.date)"
            />
            <button type="button" @click="toggleCalendar" class="calendar-toggle-button" title="Open calendar">
              <span>📅</span>
            </button>
            <button type="button" @click="navigateDate('next')" class="date-nav-button" title="Next day">
              <span>→</span>
            </button>
          </div>
          <small class="date-help-text">Enter date as dd/mm/yyyy, use arrows, or click calendar</small>
          
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
        <div class="form-group">
          <label for="group_id">Group</label>
          <div class="group-selection-row">
            <select id="group_id" v-model="collection.group_id" required @change="handleGroupChange" class="group-select">
              <option value="">Select a group</option>
              <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
            </select>
            <button 
              type="button" 
              @click="loadGroupMembers" 
              :disabled="!collection.group_id"
              class="load-members-button"
            >
              Load Members
            </button>
          </div>
        </div>
      </div>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      
      <!-- Debug/Status Info -->
      <div v-if="collection.group_id" class="status-info">
        <p><strong>Selected Group:</strong> {{ selectedGroup?.name || 'Loading...' }}</p>
        <p><strong>Members in Collection Sheet:</strong> {{ collectionSheet.length }}</p>
        <p><strong>Total Members for Group:</strong> {{ groupMembers.length }}</p>
        <p v-if="collection.date && collectionSheet.length === 0" class="next-action-hint">
          <strong>💡 Tip:</strong> Collection sheet cleared after save. Click "Load Members" to start a new collection or use date navigation to move to another date.
        </p>
      </div>
      
      <!-- Show helpful message when collection is saved and sheet is cleared -->
      <div v-if="collection.group_id && collection.date && collectionSheet.length === 0 && selectedGroup" class="saved-state-info">
        <div class="saved-state-content">
          <h4>✅ Ready for Next Collection</h4>
          <p>Group: <strong>{{ selectedGroup.name }}</strong></p>
          <p>Current Date: <strong>{{ formatDateForDisplay(collection.date) }}</strong></p>
          <div class="next-steps">
            <p><strong>What's next?</strong></p>
            <ul>
              <li>Use the date arrows (← →) to move to another date</li>
              <li>Click "Load Members" to start a new collection for this date</li>
              <li>Or select a different group to work with</li>
            </ul>
          </div>
        </div>
      </div>
      
      <CollectionSheetTable
        v-if="collectionSheet && collectionSheet.length > 0"
        :collectionSheet="collectionSheet"
        :memberBalances="collectionBalances"
        :monthlySubscription="calculateMonthlySubscription()"
        :onInstallmentChange="handleInstallmentChange"
        :onAmountChange="handleAmountChange"
        :isMonthlySubscriptionComplete="isMonthlySubscriptionComplete"
        :isAfterSubmission="isAfterSubmission"
        :submittedCollections="submittedCollections"
      />
      <div v-if="collectionSheet && collectionSheet.length > 0" class="total-collected-amount">
        <b>Total Collected Amount:</b> ₹{{ totalCollectedAmount.toLocaleString() }}
      </div>
      <div class="form-actions">
        <button type="submit" class="submit-button">Save Collection</button>
        <button type="button" class="cancel-button" @click="router.push('/collections')">Cancel</button>
      </div>
    </form>
    <div v-if="showPrompt" class="prompt-overlay">
      <div class="prompt-dialog">
        <p>{{ promptMessage }}</p>
        <button @click="showPrompt = false" class="prompt-button">OK</button>
      </div>
    </div>
    <StandardNotification
      :message="notificationMessage"
      :type="notificationType"
      :show="showNotification"
      :duration="3000"
      @close="showNotification = false"
    />
  </div>
</template>

<style scoped>
.add-collection {
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

.collection-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-row {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.form-group {
  flex: 1;
}

.group-selection-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.group-select {
  flex: 1;
}

.load-members-button {
  padding: 0.75rem 1.2rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background-color 0.2s;
  white-space: nowrap;
  min-width: 120px;
}

.load-members-button:hover:not(:disabled) {
  background-color: #2980b9;
}

.load-members-button:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #2c3e50;
  font-weight: 500;
}

input, select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus, select:focus {
  outline: none;
  border-color: #3498db;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.submit-button, .cancel-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.submit-button {
  background-color: #2c3e50;
  color: white;
}

.submit-button:hover {
  background-color: #34495e;
}

.cancel-button {
  background-color: #95a5a6;
  color: white;
}

.cancel-button:hover {
  background-color: #7f8c8d;
}

.error-message {
  color: #e74c3c;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #fde8e8;
  border-radius: 4px;
}

.status-info {
  background: #e8f4f8;
  border: 1px solid #3498db;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.status-info p {
  margin: 0.5rem 0;
  color: #2c3e50;
  font-size: 0.9rem;
}

.status-info p:first-child {
  margin-top: 0;
}

.status-info p:last-child {
  margin-bottom: 0;
}

.next-action-hint {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  padding: 0.75rem;
  margin-top: 0.5rem;
  color: #856404;
  font-size: 0.85rem;
}

.saved-state-info {
  background: linear-gradient(135deg, #f8fff8 0%, #e8f5e8 100%);
  border: 2px solid #4caf50;
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.1);
}

.saved-state-content h4 {
  margin: 0 0 1rem 0;
  color: #2e7d32;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.saved-state-content p {
  margin: 0.5rem 0;
  color: #2c3e50;
  font-size: 0.95rem;
}

.next-steps {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #c8e6c9;
}

.next-steps p {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
  color: #2e7d32;
}

.next-steps ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.2rem;
  color: #2c3e50;
}

.next-steps li {
  margin: 0.3rem 0;
  font-size: 0.9rem;
}

.collection-sheet {
  margin-top: 2rem;
}

.collection-sheet h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.table-container {
  overflow-x: auto;
  margin: 1rem 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  border: none;
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border: none;
  border-bottom: 1px solid #eee;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #ddd;
}

td input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

td input:focus {
  outline: none;
  border-color: #3498db;
}

td input[readonly] {
  background-color: #f8f9fa;
  cursor: not-allowed;
}

td input.completed {
  background-color: #dcfce7;
  border-color: #059669;
}

.invalid {
  border: 1px solid #e74c3c !important;
  background: #fdecea;
}

.prompt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.prompt-dialog {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 90%;
}

.prompt-dialog p {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.prompt-button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.prompt-button:hover {
  background-color: #2980b9;
}

.total-collected-amount {
  display: inline-block;
  margin: 1.5rem 0 1rem 0;
  padding: 1.2rem 2.5rem 1.2rem 1.5rem;
  background: linear-gradient(90deg, #e3f2fd 0%, #bbdefb 100%);
  border-radius: 10px;
  font-size: 1.45rem;
  font-weight: 700;
  color: #1976d2;
  box-shadow: 0 2px 8px rgba(44, 62, 80, 0.10);
  text-align: right;
  letter-spacing: 0.5px;
  min-width: 280px;
  max-width: 100%;
}

/* Enhanced Date Input Styles */
.date-input-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  overflow: hidden;
}

.date-input-container:focus-within {
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.1);
}

.date-nav-button, .calendar-toggle-button {
  background: #f8f9fa;
  border: none;
  padding: 0.75rem 0.5rem;
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
  padding: 0.75rem;
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

.date-help-text {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #6c757d;
  font-style: italic;
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
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-top: 0.5rem;
  min-width: 300px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.calendar-nav-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  color: #6c757d;
  transition: all 0.2s ease;
  font-size: 1.5rem;
  line-height: 1;
}

.calendar-nav-button:hover {
  background: #f8f9fa;
  color: #495057;
}

.calendar-month-year {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
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
  color: #6c757d;
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
  border-radius: 4px;
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
  background: #f8f9fa;
}

.calendar-day.today {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 600;
}

.calendar-day.selected {
  background: #3498db;
  color: white;
  font-weight: 600;
}

.calendar-day.selected:hover {
  background: #2980b9;
}

.calendar-footer {
  padding: 1rem;
  border-top: 1px solid #eee;
  text-align: center;
}

.calendar-close-button {
  background: #95a5a6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.calendar-close-button:hover {
  background: #7f8c8d;
}

/* Adjust form-group to accommodate the help text and calendar */
.form-group {
  position: relative;
  margin-bottom: 1.5rem;
}

/* Responsive styles */
@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 1rem;
  }
  
  .group-selection-row {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
  
  .load-members-button {
    min-width: auto;
    width: 100%;
  }
  
  .add-collection {
    padding: 1rem;
  }
  
  .collection-form {
    padding: 1rem;
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
    flex-wrap: wrap;
  }
  
  .date-nav-button, .calendar-toggle-button {
    min-width: 35px;
    padding: 0.6rem 0.4rem;
  }
  
  .date-nav-button span, .calendar-toggle-button span {
    font-size: 1rem;
  }
  
  .calendar-day {
    min-height: 35px;
    font-size: 0.85rem;
  }
}

/* Remove number input spinners */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

.installment-balance {
  padding: 4px 0;
  font-size: 0.9em;
  color: #2c3e50;
}

.installment-balance:not(:last-child) {
  border-bottom: 1px solid #eee;
}

.installment-balance .completed {
  color: #059669;
  font-weight: 500;
}
</style>