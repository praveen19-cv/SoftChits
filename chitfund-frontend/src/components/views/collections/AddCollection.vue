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

const collectionSheet = ref<CollectionSheetRow[]>([])
const collectionBalances = ref<CollectionBalance[]>([])
const selectedGroup = ref<Group | null>(null)
const errorMessage = ref('')
const showPrompt = ref(false)
const promptMessage = ref('')

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

function validateDate(group: Group) {
  if (!collection.value.date || !group) return true // Allow if no date set yet

  const selectedDate = new Date(collection.value.date)
  const groupStartDate = new Date(group.start_date)
  const oneMonthBefore = new Date(groupStartDate)
  oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1)

  return selectedDate >= oneMonthBefore
}

async function loadExistingCollections() {
  if (!collection.value.date || !collection.value.group_id) {
    return;
  }

  try {
    const existingCollections = await collectionsStore.fetchCollectionsByDateAndGroup(
      collection.value.date,
      Number(collection.value.group_id)
    ) as ExistingCollection[];

    // Update collection sheet with existing data
    collectionSheet.value = collectionSheet.value.map(row => {
      const memberCollections = existingCollections.filter(c => c.member_id === row.memberId);
      if (memberCollections.length > 0) {
        const firstCollection = memberCollections[0];
        const installmentString = memberCollections
          .map(c => `${c.installment_number}${c.is_completed ? 'c' : ''}`)
          .join(',');
        const totalAmount = memberCollections.reduce((sum: number, c: ExistingCollection) => sum + c.collection_amount, 0);
        const installmentBalances: { [key: number]: number } = {};
        const monthlySubscription = calculateMonthlySubscription();
        
        memberCollections.forEach((c: ExistingCollection) => {
          if (c.is_completed) {
            installmentBalances[c.installment_number] = 0;
          } else {
            installmentBalances[c.installment_number] = monthlySubscription - c.collection_amount;
          }
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
  } catch (error) {
    showErrorNotification('Failed to load existing collections');
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

  // Check date validation if date is selected
  if (collection.value.date && !validateDate(group)) {
    errorMessage.value = 'Selected date must be from one month before group start date';
  }

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
      // Load collection balances for this group
      collectionBalances.value = await collectionsStore.fetchCollectionBalances(Number(collection.value.group_id))
    } catch (error) {
      showErrorNotification('Failed to load collection balances')
    }

    // Load existing collections if date is also selected and valid
    if (collection.value.date && validateDate(group)) {
      await loadExistingCollections();
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

function handleInstallmentChange(row: CollectionSheetRow) {
  if (!row.installment || !selectedGroup.value) return

  const monthlySubscription = calculateMonthlySubscription();
  const amount = parseFloat(row.amount) || 0;

  const installments = row.installment.split(',').map(inst => {
    const isCompleted = inst.endsWith('c');
    const number = parseInt(inst.replace('c', ''));
    return { number, isCompleted };
  });

  installments.sort((a, b) => a.number - b.number);

  row.installmentBalances = {};
  let remainingAmount = amount;

  for (const inst of installments) {
    if (inst.isCompleted) {
      row.installmentBalances[inst.number] = 0;
    } else {
      if (remainingAmount >= monthlySubscription) {
        row.installmentBalances[inst.number] = 0;
        remainingAmount -= monthlySubscription;
      } else {
        row.installmentBalances[inst.number] = monthlySubscription - remainingAmount;
        remainingAmount = 0;
      }
    }
  }
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
  if (!row.amount || !selectedGroup.value) return;

  const amount = parseFloat(row.amount);
  const monthlySubscription = calculateMonthlySubscription();

  const previousCollections = await getPreviousCollections(row.memberId);

  const totalPaid = previousCollections.reduce((sum, c) => sum + c.collection_amount, 0);

  const completedInstallments = Math.floor(totalPaid / monthlySubscription);
  const currentAmount = totalPaid % monthlySubscription;

  const totalAmount = currentAmount + amount;
  const newCompletedInstallments = Math.floor(totalAmount / monthlySubscription);

  const installments = [];
  for (let i = 1; i <= completedInstallments; i++) {
    installments.push(`${i}c`);
  }
  for (let i = completedInstallments + 1; i <= completedInstallments + newCompletedInstallments; i++) {
    installments.push(`${i}c`);
  }
  if (totalAmount % monthlySubscription > 0) {
    installments.push(`${completedInstallments + newCompletedInstallments + 1}`);
  }

  row.installment = installments.join(',');

  handleInstallmentChange(row);
  calculateUpdatedInstallmentBalances(row);
}

function getCurrentAndPreviousInstallments(memberBalances: CollectionBalance[]): number[] {
  if (!memberBalances.length) return [];
  const currentIdx = memberBalances.findIndex(b => b.remaining_balance > 0);
  if (currentIdx === -1) {
    return [memberBalances.length - 2, memberBalances.length - 1].filter(i => i >= 0).map(i => memberBalances[i].installment_number);
  }
  const prevIdx = currentIdx - 1;
  const result = [memberBalances[currentIdx].installment_number];
  if (prevIdx >= 0) result.unshift(memberBalances[prevIdx].installment_number);
  return result;
}

function calculateUpdatedInstallmentBalances(row: CollectionSheetRow) {
  const memberBalances = collectionBalances.value
    .filter(b => b.member_id === row.memberId)
    .sort((a, b) => a.installment_number - b.installment_number);
  let amount = parseFloat(row.amount) || 0;
  const updatedBalances: { [key: number]: { old: number, updated: number } } = {};

  let installmentsToShow: number[] = [];
  if (row.installment) {
    const entered = row.installment.split(',').map(inst => parseInt(inst)).filter(n => !isNaN(n));
    if (entered.length > 0) {
      const prev = Math.max(1, Math.min(...entered) - 1);
      if (!entered.includes(prev) && prev > 0) entered.unshift(prev);
      installmentsToShow = entered;
    }
  }
  if (!installmentsToShow.length) {
    installmentsToShow = getCurrentAndPreviousInstallments(memberBalances);
  }

  for (const bal of memberBalances) {
    if (!installmentsToShow.includes(bal.installment_number)) continue;
    const oldBal = bal.remaining_balance;
    let updatedBal = oldBal;
    if (amount > 0) {
      if (amount >= oldBal) {
        updatedBal = 0;
        amount -= oldBal;
      } else {
        updatedBal = oldBal - amount;
        amount = 0;
      }
    }
    updatedBalances[bal.installment_number] = { old: oldBal, updated: updatedBal };
  }
  row.installmentBalances = updatedBalances;
}

async function handleSubmit() {
  try {
    errorMessage.value = '';
    if (!collection.value.date || !collection.value.group_id) {
      showErrorNotification('Please fill in all required fields');
      return;
    }

    const collections = collectionSheet.value
      .filter(row => row.memberId && row.amount !== undefined && !isNaN(parseFloat(row.amount)) && row.installment);

    if (collections.length === 0) {
      showErrorNotification('Please enter at least one amount to save collections.');
      return;
    }

    let hasError = false;

    for (const row of collections) {
      const payload = {
        date: collection.value.date,
        group_id: Number(collection.value.group_id),
        member_id: row.memberId,
        installment: row.installment,
        amount: parseFloat(row.amount),
        member_name: members.value.find(m => m.id === row.memberId)?.name || '',
        installment_number: parseInt(row.installment.split(',')[0]),
        collection_amount: parseFloat(row.amount),
        remaining_balance: 0, // Default value, adjust as needed
        is_completed: 0, // Default value, adjust as needed
        created_at: new Date().toISOString(),
        updated_remaining_balance: 0 // Default value, adjust as needed
      };

      try {
        if (row.id) {
          const oldCollections = await collectionsStore.fetchCollectionsByDateAndGroup(
            collection.value.date,
            Number(collection.value.group_id)
          );
          const memberOldCollections = oldCollections.filter((c: any) => c.member_id === row.memberId);
          for (const old of memberOldCollections) {
            await collectionsStore.deleteCollection(old.id, Number(collection.value.group_id));
          }
          await collectionsStore.createCollection(payload);
        } else {
          await collectionsStore.createCollection(payload);
        }
      } catch (error: any) {
        hasError = true;
        showErrorNotification(`Failed to save collection for member ID ${row.memberId}: ${error.response?.data?.message || error.message}`);
      }
    }

    if (!hasError) {
      showSuccessNotification('Collections saved successfully!');
    } else {
      showErrorNotification('Some collections failed to save. Please check the notifications for details.');
    }

    setTimeout(() => {
      collection.value.date = '';
      collection.value.group_id = '';
      collectionSheet.value = [];
      router.push('/collections/add');
    }, 1500);
  } catch (error: any) {
    showErrorNotification(error.response?.data?.message || error.message || 'Failed to create/update collections');
  }
}

function validateForm() {
  if (!collection.value.date || !collection.value.group_id || collectionSheet.value.length === 0) {
    showErrorNotification('Please fill in all required fields');
    return false;
  }

  // Check date validation
  const group = groups.value.find(g => g.id === Number(collection.value.group_id));
  if (group && !validateDate(group)) {
    showErrorNotification('Selected date must be from one month before group start date');
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

watch([
  () => collection.value.date,
  () => collection.value.group_id
], async ([newDate, newGroupId], [oldDate, oldGroupId]) => {
  // Clear collection sheet immediately when group changes
  if (newGroupId !== oldGroupId) {
    collectionSheet.value = [];
    collectionBalances.value = [];
    selectedGroup.value = null;
    errorMessage.value = '';
    return;
  }
  
  // Handle date changes only if group hasn't changed
  if (newDate !== oldDate && selectedGroup.value) {
    // Clear existing collection sheet data when date changes
    if (collectionSheet.value.length > 0) {
      // Reset the collection sheet to show just member names without amounts
      collectionSheet.value = collectionSheet.value.map(row => ({
        ...row,
        installment: '',
        amount: '',
        installmentBalances: {},
        id: undefined
      }));
    }
    
    // Check date validation
    if (newDate && !validateDate(selectedGroup.value)) {
      errorMessage.value = 'Selected date must be from one month before group start date';
    } else {
      errorMessage.value = '';
      // Load existing collections if date is valid and we have a collection sheet
      if (newDate && collectionSheet.value.length > 0) {
        await loadExistingCollections();
      }
    }
  } else if (!newDate && collectionSheet.value.length > 0) {
    // Clear collection data when date is removed
    collectionSheet.value = collectionSheet.value.map(row => ({
      ...row,
      installment: '',
      amount: '',
      installmentBalances: {},
      id: undefined
    }));
    errorMessage.value = '';
  }
});

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

onMounted(loadGroupsAndMembers)
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
          <input type="date" id="date" v-model="collection.date" required />
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
      </div>
      
      <CollectionSheetTable
        v-if="collectionSheet && collectionSheet.length > 0"
        :collectionSheet="collectionSheet"
        :onInstallmentChange="handleInstallmentChange"
        :onAmountChange="handleAmountChange"
        :isMonthlySubscriptionComplete="isMonthlySubscriptionComplete"
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