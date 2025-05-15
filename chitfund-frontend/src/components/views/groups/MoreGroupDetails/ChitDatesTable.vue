<template>
  <div class="chit-dates-table">
    <h4>Chit Date Settings</h4>
    <div v-if="store.loading" class="loading">
      Loading...
    </div>
    <div v-else class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 80px">Sr. No.</th>
            <th>Chit Date</th>
            <th>Minimum Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(date, index) in chitDates" :key="index">
            <td class="text-center">{{ index + 1 }}</td>
            <td class="text-center">
              <input 
                type="date" 
                v-model="date.chit_date" 
                class="form-control"
                :min="startDate"
                :max="endDate"
                @change="validateDate(date)"
              />
            </td>
            <td>
              <input 
                type="number" 
                v-model.number="date.amount" 
                class="form-control"
                :class="{ 'is-invalid': !isValidAmount(date.amount) }"
                @input="validateAmount(date)"
                placeholder="Enter minimum amount"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-3 d-flex justify-content-end">
      <button 
        class="btn btn-primary" 
        @click="saveChitDates"
        :disabled="!hasModifiedRows || !hasValidDates || store.loading"
      >
        <span v-if="store.loading">Saving...</span>
        <span v-else>Save Changes</span>
      </button>
    </div>

    <!-- Standard Notification -->
    <StandardNotification
      :show="notification.show"
      :message="notification.message"
      :type="notification.type"
      @close="notification.show = false"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { format, addMonths, parseISO, isAfter, isValid as isDateValid } from 'date-fns';
import { useGroupsStore } from '@/stores/GroupsStore';
import StandardNotification from '@/components/standards/StandardNotification.vue';

export default {
  name: 'ChitDatesTable',
  components: {
    StandardNotification
  },
  props: {
    groupId: {
      type: [String, Number],
      required: true
    },
    startDate: {
      type: String,
      required: true
    },
    endDate: {
      type: String,
      required: true
    },
    numberOfMonths: {
      type: Number,
      required: true
    }
  },
  setup(props) {
    const store = useGroupsStore();
    const chitDates = ref([]);
    const originalChitDates = ref([]);
    const hasChanges = ref(false);
    const notification = ref({
      show: false,
      message: '',
      type: 'success'
    });

    const generateChitDates = () => {
      const dates = [];
      let currentDate = parseISO(props.startDate);
      const endDate = parseISO(props.endDate);
      
      while (!isAfter(currentDate, endDate)) {
        dates.push({
          chit_date: format(currentDate, 'yyyy-MM-dd'),
          amount: 0
        });
        currentDate = addMonths(currentDate, 1);
      }
      
      return dates;
    };

    const loadChitDates = async () => {
      try {
        const data = await store.fetchChitDates(props.groupId);
        
        if (data && Array.isArray(data) && data.length > 0) {
          chitDates.value = data.map(date => ({
            chit_date: date.chit_date,
            amount: Number(date.amount) || 0
          }));
        } else {
          chitDates.value = generateChitDates();
        }
        originalChitDates.value = JSON.parse(JSON.stringify(chitDates.value));
        hasChanges.value = false;
      } catch (error) {
        console.error('Error loading chit dates:', error);
        chitDates.value = generateChitDates();
        originalChitDates.value = JSON.parse(JSON.stringify(chitDates.value));
        hasChanges.value = false;
      }
    };

    const showNotification = (message, type = 'success') => {
      notification.value = {
        show: true,
        message,
        type
      };
    };

    const saveChitDates = async () => {
      try {
        // Ensure all dates are in the correct format
        const datesToSave = chitDates.value.map(date => {
          // Ensure the date is in YYYY-MM-DD format
          const parsedDate = parseISO(date.chit_date);
          if (!isDateValid(parsedDate)) {
            throw new Error(`Invalid date: ${date.chit_date}`);
          }
          
          return {
            chit_date: format(parsedDate, 'yyyy-MM-dd'),
            amount: Number(date.amount) || 0
          };
        });

        // Sort dates chronologically
        datesToSave.sort((a, b) => {
          return parseISO(a.chit_date).getTime() - parseISO(b.chit_date).getTime();
        });
        
        await store.updateChitDates(props.groupId, datesToSave);
        
        // Reload the dates after saving to ensure we have the latest data
        await loadChitDates();
        showNotification('Chit dates saved successfully');
      } catch (error) {
        console.error('Error saving chit dates:', error);
        // If save fails, revert to original values
        chitDates.value = JSON.parse(JSON.stringify(originalChitDates.value));
        hasChanges.value = false;
        showNotification('Failed to save chit dates', 'error');
      }
    };

    const formatDate = (date) => {
      return format(parseISO(date), 'dd-MMM-yyyy');
    };

    const isValidAmount = (amount) => {
      return amount >= 0;
    };

    const validateAmount = (date) => {
      date.amount = Math.max(0, Number(date.amount) || 0);
      hasChanges.value = true;
    };

    const validateDate = (date) => {
      try {
        const selectedDate = parseISO(date.chit_date);
        const start = parseISO(props.startDate);
        const end = parseISO(props.endDate);

        if (!isDateValid(selectedDate)) {
          date.chit_date = format(start, 'yyyy-MM-dd');
          return;
        }

        if (isAfter(selectedDate, end) || isAfter(start, selectedDate)) {
          date.chit_date = format(start, 'yyyy-MM-dd');
        }
        hasChanges.value = true;
      } catch (error) {
        console.error('Error validating date:', error);
        date.chit_date = format(parseISO(props.startDate), 'yyyy-MM-dd');
        hasChanges.value = true;
      }
    };

    const hasModifiedRows = computed(() => {
      if (!chitDates.value || !originalChitDates.value) return false;
      
      return chitDates.value.some((date, index) => {
        const original = originalChitDates.value[index];
        if (!original) return false;
        
        return date.amount !== original.amount || date.chit_date !== original.chit_date;
      });
    });

    const hasValidDates = computed(() => {
      if (!chitDates.value) return false;
      
      return chitDates.value.every(date => {
        try {
          return isDateValid(parseISO(date.chit_date));
        } catch (e) {
          return false;
        }
      });
    });

    watch(() => props.startDate, () => {
      loadChitDates();
    });

    watch(() => props.endDate, () => {
      loadChitDates();
    });

    onMounted(() => {
      loadChitDates();
    });

    return {
      store,
      chitDates,
      hasChanges,
      hasModifiedRows,
      hasValidDates,
      formatDate,
      isValidAmount,
      validateAmount,
      validateDate,
      saveChitDates,
      notification
    };
  }
};
</script>

<style scoped>
.chit-dates-table {
  margin: 20px 0;
}

h4 {
  margin-bottom: 15px;
  color: #333;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.table-container {
  overflow-x: auto;
  margin-bottom: 20px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
}

.table th,
.table td {
  padding: 12px 8px;
  border: 1px solid #dee2e6;
}

.table th {
  background-color: #f8f9fa;
  font-weight: bold;
  text-align: center;
}

.text-center {
  text-align: center;
}

.form-control {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  text-align: center;
}

.form-control:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.form-control.is-invalid {
  border-color: #dc3545;
}

.form-control.is-invalid:focus {
  border-color: #dc3545;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
}

.btn {
  padding: 8px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #007bff;
  border: 1px solid #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
}

.btn-primary:disabled {
  background-color: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.65;
}

.d-flex {
  display: flex;
}

.justify-content-end {
  justify-content: flex-end;
}

.form-control[type="date"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
}

.form-control[type="date"]:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style> 