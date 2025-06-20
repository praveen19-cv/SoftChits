<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useGroupsStore } from '@/stores/GroupsStore';
import api from '@/services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

interface CustomerSheetRow {
  member_id: number;
  member_name: string;
  installment_number: number;
  is_completed: boolean;
  total_paid: number;
  remaining_balance: number;
}

const groupsStore = useGroupsStore();
const loading = ref(false);
const selectedGroupId = ref<number | null>(null);
const customerSheetData = ref<any[]>([]);

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

const allInstallmentNumbers = computed(() => {
  const set = new Set<number>();
  customerSheetData.value.forEach(row => {
    set.add(row.installment_number);
  });
  return Array.from(set).sort((a, b) => a - b);
});

const allMembers = computed(() => {
  const members = new Map<number, string>();
  customerSheetData.value.forEach(row => {
    members.set(row.member_id, row.member_name);
  });
  return (Array.from(
    customerSheetData.value.reduce((acc: Map<number, string>, row: CustomerSheetRow) => {
      if (!acc.has(row.member_id)) {
        acc.set(row.member_id, row.member_name);
      }
      return acc;
    }, new Map<number, string>()).entries()
  ) as [number, string][]).map(([id, name]) => ({ id, name }));
});

watch(selectedGroupId, async (newVal) => {
  if (newVal) {
    loading.value = true;
    try {
      const response = await api.get(`/collection-balance/${newVal}/customer-sheet`);
      customerSheetData.value = response.data;
    } catch (error) {
      console.error('Error fetching customer sheet data:', error);
      customerSheetData.value = [];
    } finally {
      loading.value = false;
    }
  } else {
    customerSheetData.value = [];
  }
});

onMounted(async () => {
  loading.value = true;
  await groupsStore.fetchGroups();
  loading.value = false;
});

function isCompleted(row: any) {
  return row.is_completed;
}

function selectGroup(group: any) {
  selectedGroupId.value = group.id;
  dropdownOpen.value = false;
  groupSearch.value = '';
}

function downloadAsPDF() {
  const doc = new jsPDF();
  autoTable(doc, {
    head: [['Name', ...allInstallmentNumbers.value.map(num => `Installment ${num}`)]],
    body: allMembers.value.map(member => [
      member.name,
      ...allInstallmentNumbers.value.map(num => {
        const row = customerSheetData.value.find(
          (r: CustomerSheetRow) => r.member_id === member.id && r.installment_number === num
        );
        return row ? (row.is_completed ? row.total_paid : row.remaining_balance) : '-';
      })
    ])
  });
  doc.save('CustomerSheet.pdf');
}

function downloadAsExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('CustomerSheet');

  // Add header row
  worksheet.addRow(['Name', ...allInstallmentNumbers.value.map(num => `Installment ${num}`)]);

  // Add data rows
  allMembers.value.forEach(member => {
    const rowData = [
      member.name,
      ...allInstallmentNumbers.value.map(num => {
        const row = customerSheetData.value.find(
          (r: CustomerSheetRow) => r.member_id === member.id && r.installment_number === num
        );
        return row ? (row.is_completed ? row.total_paid : row.remaining_balance) : '-';
      })
    ];
    worksheet.addRow(rowData);
  });

  // Save the file
  workbook.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'CustomerSheet.xlsx';
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
      <div v-if="selectedGroupId && customerSheetData.length" class="cs-table-wrap">
        <table class="cs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th v-for="num in allInstallmentNumbers" :key="num">Installment {{ num }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in allMembers" :key="member.id">
              <td class="cs-name">{{ member.name }}</td>
              <td v-for="num in allInstallmentNumbers" :key="num">
                <span :class="isCompleted(customerSheetData.find((row: CustomerSheetRow) => row.member_id === member.id && row.installment_number === num)) ? 'paid' : 'unpaid'">
                  {{
                  (() => {
                    const row: CustomerSheetRow | undefined = customerSheetData.find((row: CustomerSheetRow) => row.member_id === member.id && row.installment_number === num);
                    if (!row) return '-';
                    return row.is_completed ? row.total_paid : row.remaining_balance;
                  })()
                  }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="cs-no-data">No data found for this group.</div>
    </div>
  </div>
</template>

<style scoped>
.customer-sheet {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  padding: 2rem 2.5rem;
  max-width: 1100px;
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
  padding: 0.7rem 1rem;
  border-bottom: 1px solid #e3e8ee;
  text-align: center;
  font-size: 1rem;
}
.cs-table th {
  background: #e3f0fd;
  color: #1976d2;
  font-weight: 600;
}
.cs-table tr:last-child td {
  border-bottom: none;
}
.cs-name {
  font-weight: 500;
  color: #333;
  text-align: left;
}
.paid {
  color: #2e7d32;
  font-weight: 600;
  background: #e8f5e9;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
}
.unpaid {
  color: #c62828;
  font-weight: 600;
  background: #ffebee;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
}
.cs-loading, .cs-error, .cs-no-data {
  margin-top: 2.5rem;
  text-align: center;
  color: #888;
  font-size: 1.1rem;
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
}
.cs-download-btn:hover {
  background-color: #1565c0;
}
</style>