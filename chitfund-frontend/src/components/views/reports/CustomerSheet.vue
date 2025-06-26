<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useGroupsStore } from '@/stores/GroupsStore';
import api from '@/services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

interface CollectionBalanceRow {
  id: number;
  group_id: number;
  member_id: number;
  installment_number: number;
  total_paid: number;
  remaining_balance: number;
  is_completed: boolean;
  last_updated: string;
  completion_date?: string;
  paid_amount?: number;
}

interface GroupMember {
  id: number;
  group_id: number;
  member_id: number;
  member_name: string;
  group_member_id: string;
  created_at: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

interface CustomerSheetData {
  members: GroupMember[];
  balances: CollectionBalanceRow[];
  exportedInstallments: number[];
}

const groupsStore = useGroupsStore();
const loading = ref(false);
const selectedGroupId = ref<number | null>(null);
const customerSheetData = ref<CustomerSheetData>({
  members: [],
  balances: [],
  exportedInstallments: []
});

const filteredGroups = computed(() => groupsStore.groups);
const groupSearch = ref('');
const dropdownOpen = ref(false);
const filteredGroupsWithSearch = computed(() => {
  if (!groupSearch.value) return filteredGroups.value;
  return filteredGroups.value.filter(g => g.name.toLowerCase().includes(groupSearch.value.toLowerCase()));
});

const selectedGroupName = computed(() => {
  const group = filteredGroups.value.find(g => g.id === selectedGroupId.value);
  return group ? group.name : '';
});

// Get ordered members from the new API
const orderedMembers = computed(() => {
  return customerSheetData.value.members.map((member, index) => ({
    serialNo: index + 1,
    id: member.member_id,
    name: member.name || member.member_name,
    phone: member.phone,
    group_member_id: member.group_member_id
  }));
});

// Get exported installments list
const exportedInstallmentNumbers = computed(() => {
  return customerSheetData.value.exportedInstallments.sort((a, b) => a - b);
});

// Fetch monthly subscription amounts for exported installments
const monthlySubscriptionAmounts = ref<Record<number, number>>({});
async function fetchMonthlySubscriptionAmounts(groupId: number) {
  try {
    const group = groupsStore.groups.find(g => g.id === groupId);
    if (!group) return;
    const response = await api.get(`/collections/${groupId}/monthly-subscription`);
    const exported = response.data.filter((row: any) => row.is_exported);
    const amounts: Record<number, number> = {};
    exported.forEach((row: any) => {
      amounts[row.month_number] = row.monthly_subscription;
    });
    monthlySubscriptionAmounts.value = amounts;
  } catch (error) {
    console.error('Error fetching monthly subscription amounts:', error);
    monthlySubscriptionAmounts.value = {};
  }
}

watch(selectedGroupId, async (newVal) => {
  if (newVal) {
    loading.value = true;
    try {
      // Use the new enhanced customer sheet API
      const response = await api.get(`/collection-balance/${newVal}/customer-sheet-enhanced`);
      customerSheetData.value = response.data;
      await fetchMonthlySubscriptionAmounts(newVal);
    } catch (error) {
      console.error('Error fetching customer sheet data:', error);
      customerSheetData.value = {
        members: [],
        balances: [],
        exportedInstallments: []
      };
      monthlySubscriptionAmounts.value = {};
    } finally {
      loading.value = false;
    }
  } else {
    customerSheetData.value = {
      members: [],
      balances: [],
      exportedInstallments: []
    };
    monthlySubscriptionAmounts.value = {};
  }
});

const installmentAmount = (num: number) => {
  return typeof monthlySubscriptionAmounts.value[num] === 'number' && monthlySubscriptionAmounts.value[num] > 0
    ? monthlySubscriptionAmounts.value[num]
    : '-';
};

const memberTotals = computed(() => {
  const totals: Record<number, { paid: number; balance: number }> = {};
  orderedMembers.value.forEach((member) => {
    let paid = 0;
    let balance = 0;
    exportedInstallmentNumbers.value.forEach(num => {
      const row = customerSheetData.value.balances.find(
        (r: CollectionBalanceRow) => r.member_id === member.id && r.installment_number === num
      );
      if (row) {
        paid += row.total_paid;
        balance += row.remaining_balance;
      }
    });
    totals[member.id] = { paid, balance };
  });
  return totals;
});

onMounted(async () => {
  loading.value = true;
  await groupsStore.fetchGroups();
  loading.value = false;
});

function selectGroup(group: any) {
  selectedGroupId.value = group.id;
  dropdownOpen.value = false;
  groupSearch.value = '';
}

// Helper to get balance data for a member and installment
function getMemberInstallmentBalance(memberId: number, installmentNum: number): CollectionBalanceRow | undefined {
  return customerSheetData.value.balances.find(
    (row: CollectionBalanceRow) => row.member_id === memberId && row.installment_number === installmentNum
  );
}

function downloadAsPDF() {
  const doc = new jsPDF('landscape');
  
  // Prepare table data with serial numbers and two rows per member
  const tableData: any[][] = [];
  
  orderedMembers.value.forEach(member => {
    // First row: Pending balances (red)
    const pendingRow = [
      member.serialNo,
      member.name,
      'Pending',
      ...exportedInstallmentNumbers.value.map(num => {
        const balance = getMemberInstallmentBalance(member.id, num);
        return balance && !balance.is_completed ? `₹${balance.remaining_balance}` : '-';
      })
    ];
    
    // Second row: Completed amounts with dates (green)
    const completedRow = [
      '',
      '',
      'Completed',
      ...exportedInstallmentNumbers.value.map(num => {
        const balance = getMemberInstallmentBalance(member.id, num);
        if (balance && balance.is_completed) {
          const amount = `₹${balance.paid_amount || balance.total_paid}`;
          const date = balance.completion_date ? new Date(balance.completion_date).toLocaleDateString('en-GB') : '';
          return `${amount}${date ? ` (${date})` : ''}`;
        }
        return '-';
      })
    ];
    
    tableData.push(pendingRow, completedRow);
  });

  autoTable(doc, {
    head: [['S.No', 'Name', 'Status', ...exportedInstallmentNumbers.value.map(num => `Inst ${num}`)]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [25, 118, 210] },
    didParseCell: function(data) {
      if (data.row.index % 2 === 0 && data.cell.text[0] !== '' && data.column.index === 2) {
        // Pending row styling
        data.cell.styles.textColor = [198, 40, 40];
        data.cell.styles.fillColor = [255, 235, 238];
      } else if (data.row.index % 2 === 1 && data.column.index === 2) {
        // Completed row styling
        data.cell.styles.textColor = [46, 125, 50];
        data.cell.styles.fillColor = [232, 245, 233];
      }
    }
  });
  
  doc.save(`CustomerSheet_${selectedGroupName.value}.pdf`);
}

function downloadAsExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Customer Sheet');

  // Add header row
  const headerRow = worksheet.addRow(['Serial No', 'Name', 'Status', ...exportedInstallmentNumbers.value.map(num => `Installment ${num}`)]);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F0FD' } };

  // Add data rows
  orderedMembers.value.forEach(member => {
    // Pending row
    const pendingRow = worksheet.addRow([
      member.serialNo,
      member.name,
      'Pending',
      ...exportedInstallmentNumbers.value.map(num => {
        const balance = getMemberInstallmentBalance(member.id, num);
        return balance && !balance.is_completed ? balance.remaining_balance : 0;
      })
    ]);
    pendingRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
    pendingRow.getCell(3).font = { color: { argb: 'FFC62828' } };

    // Completed row
    const completedRow = worksheet.addRow([
      '',
      '',
      'Completed',
      ...exportedInstallmentNumbers.value.map(num => {
        const balance = getMemberInstallmentBalance(member.id, num);
        if (balance && balance.is_completed) {
          return `₹${balance.paid_amount || balance.total_paid}${balance.completion_date ? ` (${new Date(balance.completion_date).toLocaleDateString('en-GB')})` : ''}`;
        }
        return '-';
      })
    ]);
    completedRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
    completedRow.getCell(3).font = { color: { argb: 'FF2E7D32' } };
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 15;
  });

  workbook.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CustomerSheet_${selectedGroupName.value}.xlsx`;
    link.click();
  });
}

</script>

<template>
  <div class="customer-sheet">
    <div class="cs-header">
      <div class="cs-title">Customer Sheet</div>
      <div class="cs-actions">
        <div class="cs-dropdown">
          <div class="cs-dropdown-selected" @click="dropdownOpen = !dropdownOpen">
            {{ selectedGroupName || 'Select Group' }}
            <span class="cs-dropdown-arrow">▼</span>
          </div>
          <div v-if="dropdownOpen" class="cs-dropdown-list">
            <input
              v-model="groupSearch"
              class="cs-dropdown-search"
              placeholder="Search group..."
              @click.stop
            />
            <div
              v-for="group in filteredGroupsWithSearch"
              :key="group.id"
              class="cs-dropdown-item"
              @click="selectGroup(group)"
            >
              {{ group.name }}
            </div>
            <div v-if="!filteredGroupsWithSearch.length" class="cs-dropdown-noresult">No groups found</div>
          </div>
        </div>
        <button @click="downloadAsPDF" class="cs-download-btn">Download as PDF</button>
        <button @click="downloadAsExcel" class="cs-download-btn">Download as Excel</button>
      </div>
    </div>
    <div v-if="loading" class="cs-loading">Loading...</div>
    <div v-else>
      <div v-if="selectedGroupId && orderedMembers.length" class="cs-table-wrap">
        <table class="cs-table">
          <thead>
            <tr>
              <th rowspan="3">S.No</th>
              <th rowspan="3">Name</th>
              <th rowspan="3">Status</th>
              <th v-for="num in exportedInstallmentNumbers" :key="num" colspan="1">
                Installment {{ num }}
              </th>
              <th rowspan="3">Total Paid</th>
              <th rowspan="3">Total Balance</th>
            </tr>
            <tr>
              <th v-for="num in exportedInstallmentNumbers" :key="'amt-' + num" style="font-size:0.9em; color:#1976d2; background:#e3f0fd; font-weight:600;">
                ₹{{ installmentAmount(num).toLocaleString() }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="member in orderedMembers" :key="member.id">
              <!-- Pending Balance Row (Red) -->
              <tr class="pending-row">
                <td rowspan="2" class="cs-serial">{{ member.serialNo }}</td>
                <td rowspan="2" class="cs-name">{{ member.name }}</td>
                <td class="cs-status pending">Pending</td>
                <td v-for="num in exportedInstallmentNumbers" :key="'pending-' + num" class="cs-balance">
                  <span class="balance-pending">
                    {{
                      (() => {
                        const balance = getMemberInstallmentBalance(member.id, num);
                        return balance && !balance.is_completed ? `₹${balance.remaining_balance.toLocaleString()}` : '-';
                      })()
                    }}
                  </span>
                </td>
                <td rowspan="2" class="cs-total"><b>₹{{ memberTotals[member.id]?.paid?.toLocaleString() || 0 }}</b></td>
                <td rowspan="2" class="cs-total"><b>₹{{ memberTotals[member.id]?.balance?.toLocaleString() || 0 }}</b></td>
              </tr>
              <!-- Completed Amount Row (Green) -->
              <tr class="completed-row">
                <td class="cs-status completed">Completed</td>
                <td v-for="num in exportedInstallmentNumbers" :key="'completed-' + num" class="cs-balance">
                  <span class="balance-completed">
                    {{
                      (() => {
                        const balance = getMemberInstallmentBalance(member.id, num);
                        if (balance && balance.is_completed) {
                          const amount = `₹${(balance.paid_amount || balance.total_paid).toLocaleString()}`;
                          const date = balance.completion_date ? new Date(balance.completion_date).toLocaleDateString('en-GB') : '';
                          return `${amount}${date ? ` (${date})` : ''}`;
                        }
                        return '-';
                      })()
                    }}
                  </span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-else class="cs-no-data">
        {{ selectedGroupId ? 'No data found for this group.' : 'Please select a group to view customer sheet.' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.customer-sheet {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  padding: 2rem 2.5rem;
  max-width: 1200px;
  margin: 2rem auto;
  font-family: 'Segoe UI', Arial, sans-serif;
}
.cs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}
.cs-title {
  font-size: 2rem;
  font-weight: 600;
  color: #1976d2;
  letter-spacing: 1px;
}
.cs-actions {
  display: flex;
  gap: 0.7rem;
  align-items: center;
}
.cs-dropdown {
  position: relative;
  min-width: 220px;
}
.cs-dropdown-selected {
  border: 1px solid #bdbdbd;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  background: #f9f9f9;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 200px;
}
.cs-dropdown-arrow {
  margin-left: 0.5rem;
  font-size: 1rem;
}
.cs-dropdown-list {
  position: absolute;
  top: 110%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #bdbdbd;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  z-index: 10;
  padding: 0.5rem 0;
}
.cs-dropdown-search {
  width: 90%;
  margin: 0.3rem 5%;
  padding: 0.4rem 0.7rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 1rem;
  outline: none;
}
.cs-dropdown-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.cs-dropdown-item:hover {
  background: #e3f0fd;
}
.cs-dropdown-noresult {
  padding: 0.5rem 1rem;
  color: #888;
  font-size: 0.95rem;
}
.cs-table-wrap {
  overflow-x: auto;
}
.cs-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  background: #fafcff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 6px rgba(25,118,210,0.04);
}
.cs-table th, .cs-table td {
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid #e3e8ee;
  text-align: center;
  font-size: 0.95rem;
  vertical-align: middle;
}
.cs-table th {
  background: #e3f0fd;
  color: #1976d2;
  font-weight: 600;
}
.cs-table tr:last-child td {
  border-bottom: none;
}

/* Serial number column */
.cs-serial {
  font-weight: 600;
  color: #1976d2;
  background: #f8fafe;
  text-align: center;
  width: 50px;
}

/* Member name column */
.cs-name {
  font-weight: 500;
  color: #333;
  text-align: left;
  min-width: 150px;
}

/* Status column styling */
.cs-status {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.8rem;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  min-width: 80px;
}

.cs-status.pending {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.cs-status.completed {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

/* Balance cells */
.cs-balance {
  min-width: 100px;
}

.balance-pending {
  color: #c62828;
  font-weight: 600;
  background: #ffebee;
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  display: inline-block;
  font-size: 0.9rem;
}

.balance-completed {
  color: #2e7d32;
  font-weight: 600;
  background: #e8f5e9;
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  display: inline-block;
  font-size: 0.85rem;
  line-height: 1.2;
}

/* Row styling */
.pending-row {
  background: #fafafa;
}

.completed-row {
  background: #f8f8f8;
  border-bottom: 2px solid #e0e0e0 !important;
}

/* Total columns */
.cs-total {
  font-weight: bold;
  color: #1976d2;
  background: #f0f7ff;
  min-width: 120px;
}

.cs-loading, .cs-error, .cs-no-data {
  margin-top: 2.5rem;
  text-align: center;
  color: #888;
  font-size: 1.1rem;
  padding: 2rem;
}

.material-icons {
  font-size: 1.2rem;
  vertical-align: middle;
}

.cs-download-btn {
  background-color: #1976d2;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-size: 0.9rem;
}

.cs-download-btn:hover {
  background-color: #1565c0;
}

/* Responsive design */
@media (max-width: 768px) {
  .customer-sheet {
    padding: 1rem;
    margin: 1rem;
  }
  
  .cs-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .cs-actions {
    justify-content: center;
  }
  
  .cs-table th, .cs-table td {
    font-size: 0.8rem;
    padding: 0.4rem 0.5rem;
  }
  
  .balance-completed {
    font-size: 0.75rem;
  }
}
</style>