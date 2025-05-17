<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCollectionsStore } from '@/stores/CollectionsStore'
import { useGroupsStore } from '@/stores/GroupsStore'
import { useMembersStore } from '@/stores/MembersStore'
import type { Collection, CollectionBalance } from '@/stores/CollectionsStore'
import StandardNotification from '@/components/standards/StandardNotification.vue'

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

interface CollectionSheetRow {
  serialNo: number
  memberId: number
  memberName: string
  installment: string
  amount: string
  installmentBalances: { [key: number]: number }
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
const selectedGroup = ref<Group | null>(null)
const errorMessage = ref('')
const showPrompt = ref(false)
const promptMessage = ref('')

// Replace notification state with standard notification
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref<'success' | 'error'>('success')

const collectionBalances = ref<CollectionBalance[]>([])

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
    console.error('Error loading data:', error)
    errorMessage.value = 'Failed to load groups and members'
  }
}

function validateDate(group: Group) {
  if (!collection.value.date || !group) return false
  
  const selectedDate = new Date(collection.value.date)
  const groupStartDate = new Date(group.start_date)
  const oneMonthBefore = new Date(groupStartDate)
  oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1)
  
  return selectedDate >= oneMonthBefore
}

async function loadExistingCollections() {
  if (!collection.value.date || !collection.value.group_id) return;

  try {
    const existingCollections = await collectionsStore.fetchCollectionsByDateAndGroup(
      collection.value.date,
      Number(collection.value.group_id)
    ) as ExistingCollection[];

    // Update collection sheet with existing data
    collectionSheet.value = collectionSheet.value.map(row => {
      const memberCollections = existingCollections.filter(c => c.member_id === row.memberId);
      
      if (memberCollections.length > 0) {
        // Combine all installments for this member
        const installmentString = memberCollections
          .map(c => `${c.installment_number}${c.is_completed ? 'c' : ''}`)
          .join(',');
        
        // Calculate total amount
        const totalAmount = memberCollections.reduce((sum: number, c: ExistingCollection) => sum + c.collection_amount, 0);
        
        // Calculate installment balances
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
          installment: installmentString,
          amount: totalAmount.toFixed(2),
          installmentBalances
        };
      }
      return row;
    });
  } catch (error) {
    console.error('Error loading existing collections:', error);
    showErrorNotification('Failed to load existing collections');
  }
}

// Add function to get previous collections
async function getPreviousCollections(memberId: number): Promise<ExistingCollection[]> {
  try {
    const allCollections = await collectionsStore.fetchCollectionsByGroup(Number(collection.value.group_id));
    return allCollections.filter(c => 
      c.member_id === memberId && 
      new Date(c.collection_date) < new Date(collection.value.date)
    );
  } catch (error) {
    console.error('Error fetching previous collections:', error);
    return [];
  }
}

// Update handleGroupChange to load previous collections
async function handleGroupChange() {
  const group = groups.value.find(g => g.id === Number(collection.value.group_id))
  
  if (!group) {
    return
  }
  
  selectedGroup.value = group
  
  // Validate date
  if (!validateDate(group)) {
    errorMessage.value = 'Selected date must be from one month before group start date'
    return
  }
  errorMessage.value = ''
  
  // Initialize collection sheet with all members
  collectionSheet.value = members.value.map((member, index) => ({
    serialNo: index + 1,
    memberId: member.id,
    memberName: member.name,
    installment: '',
    amount: '',
    installmentBalances: {}
  }))

  // Load collection balances
  try {
    collectionBalances.value = await collectionsStore.fetchCollectionBalances(Number(collection.value.group_id))
  } catch (error) {
    console.error('Error loading collection balances:', error)
    showErrorNotification('Failed to load collection balances')
  }

  // Load existing collections if date is selected
  if (collection.value.date) {
    await loadExistingCollections();
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
  
  // Parse installment string (e.g., "1c,2")
  const installments = row.installment.split(',').map(inst => {
    const isCompleted = inst.endsWith('c');
    const number = parseInt(inst.replace('c', ''));
    return { number, isCompleted };
  });

  // Sort installments by number
  installments.sort((a, b) => a.number - b.number);

  // Calculate installment balances
  row.installmentBalances = {};
  let remainingAmount = amount;

  for (const inst of installments) {
    if (inst.isCompleted) {
      // For completed installments, balance is 0
      row.installmentBalances[inst.number] = 0;
    } else {
      // For incomplete installments, calculate remaining balance
      if (remainingAmount >= monthlySubscription) {
        // If amount is enough for this installment
        row.installmentBalances[inst.number] = 0;
        remainingAmount -= monthlySubscription;
      } else {
        // If amount is not enough, show remaining balance
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
  
  // Parse installment string
  const installments = row.installment.split(',').map(inst => {
    const isCompleted = inst.endsWith('c');
    const number = parseInt(inst.replace('c', ''));
    return { number, isCompleted };
  });

  // Check if any incomplete installment has enough payment
  return installments.some(inst => !inst.isCompleted && amount >= monthlySubscription);
}

// Add function to handle amount changes
async function handleAmountChange(row: CollectionSheetRow) {
  if (!row.amount || !selectedGroup.value) return;
  
  const amount = parseFloat(row.amount);
  const monthlySubscription = calculateMonthlySubscription();
  
  // Get previous collections
  const previousCollections = await getPreviousCollections(row.memberId);
  
  // Calculate total paid in previous collections
  const totalPaid = previousCollections.reduce((sum, c) => sum + c.collection_amount, 0);
  
  // Calculate remaining installments
  const completedInstallments = Math.floor(totalPaid / monthlySubscription);
  const currentAmount = totalPaid % monthlySubscription;
  
  // Calculate how many installments can be completed with current amount
  const totalAmount = currentAmount + amount;
  const newCompletedInstallments = Math.floor(totalAmount / monthlySubscription);
  
  // Update installment string
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
  
  // Update balances
  handleInstallmentChange(row);
}

async function handleSubmit() {
  try {
    errorMessage.value = ''
    const collections = collectionSheet.value
      .filter(row => row.installment && row.amount)
      .map(row => ({
        date: collection.value.date,
        group_id: Number(collection.value.group_id),
        member_id: row.memberId,
        installment_string: row.installment,
        amount: parseFloat(row.amount),
      })) as Omit<Collection, 'id'>[]
    
    // Create collections one by one
    for (const collection of collections) {
      await collectionsStore.createCollection(collection)
    }
    showSuccessNotification('Collections saved successfully!')
    
    // Reset form
    collection.value.date = ''
    collection.value.group_id = ''
    collectionSheet.value = []
  } catch (error: any) {
    console.error('Error creating collections:', error)
    errorMessage.value = error.response?.data?.message || 'Failed to create collections'
    showErrorNotification(errorMessage.value)
  }
}

function validateForm() {
  if (!collection.value.date || !collection.value.group_id || collectionSheet.value.length === 0) {
    errorMessage.value = 'Please fill in all required fields';
    return false;
  }
  return true;
}

// Add watcher for date changes
watch(() => collection.value.date, async (newDate) => {
  if (newDate && collection.value.group_id) {
    await loadExistingCollections();
  }
});

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
        <input
          type="date"
          id="date"
          v-model="collection.date"
          required
        />
      </div>

      <div class="form-group">
        <label for="group_id">Group</label>
          <select 
            id="group_id" 
            v-model="collection.group_id" 
            required
            @change="handleGroupChange"
          >
          <option value="">Select a group</option>
          <option v-for="group in groups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
        </div>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <div v-if="collectionSheet && collectionSheet.length > 0" class="collection-sheet">
        <h3>Collection Sheet</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Serial No</th>
                <th>Member Name</th>
                <th>Installment</th>
                <th>Amount</th>
                <th>Installment Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in collectionSheet" :key="row.memberId">
                <td>{{ row.serialNo }}</td>
                <td>{{ row.memberName }}</td>
                <td>
                  <input
                    type="text"
                    v-model="row.installment"
                    @input="handleInstallmentChange(row)"
                    placeholder="e.g., 1c,2,3c"
                  />
                </td>
                <td>
        <input
          type="number"
                    v-model="row.amount"
                    :class="{ 'completed': isMonthlySubscriptionComplete(row) }"
          placeholder="Enter amount"
                    @input="handleAmountChange(row)"
                  />
                </td>
                <td>
                  <div v-for="(balance, instNo) in row.installmentBalances" :key="instNo" class="installment-balance">
                    <span v-if="getInstallmentStatus(row.memberId, instNo).isCompleted" class="completed">
                      Inst-{{ instNo }}: ✓ Completed
                    </span>
                    <span v-else>
                      Inst-{{ instNo }}: ₹{{ getInstallmentStatus(row.memberId, instNo).remainingBalance }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
      </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="submit-button">Save Collection</button>
        <button type="button" class="cancel-button" @click="router.push('/collections')">Cancel</button>
      </div>
    </form>

    <!-- Prompt Dialog -->
    <div v-if="showPrompt" class="prompt-overlay">
      <div class="prompt-dialog">
        <p>{{ promptMessage }}</p>
        <button @click="showPrompt = false" class="prompt-button">OK</button>
      </div>
    </div>

    <!-- Replace custom notification with StandardNotification -->
    <StandardNotification
      :show="showNotification"
      :message="notificationMessage"
      :type="notificationType"
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

/* Responsive styles */
@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 1rem;
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

/* Remove custom notification styles */
.notification {
  display: none;
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