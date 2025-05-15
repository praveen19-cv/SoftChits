<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGroupsStore } from '@/stores/GroupsStore'
import ChitDatesTable from './ChitDatesTable.vue'
import MonthlySubscriptionTab from './MonthlySubscriptionTab.vue'
import OtherTab from './OtherTab.vue'

const route = useRoute()
const store = useGroupsStore()
const groupId = Number(route.params.id)
const activeTab = ref('chitdate')

// Load group data when component is mounted
const loadGroup = async () => {
  try {
    await store.fetchGroupById(groupId)
  } catch (error) {
    console.error('Error loading group:', error)
  }
}

onMounted(() => {
  loadGroup()
})
</script>

<template>
  <div class="more-group-details">
    <div class="button-series">
      <button 
        :class="['tab-button', { active: activeTab === 'chitdate' }]"
        @click="activeTab = 'chitdate'"
      >
        Chit Date
      </button>
      <button 
        :class="['tab-button', { active: activeTab === 'subscription' }]"
        @click="activeTab = 'subscription'"
      >
        Monthly Subscription
      </button>
      <button 
        :class="['tab-button', { active: activeTab === 'other' }]"
        @click="activeTab = 'other'"
      >
        Other
      </button>
    </div>

    <div class="content-box">
      <ChitDatesTable 
        v-if="activeTab === 'chitdate' && store.currentGroup"
        :groupId="Number(groupId)"
        :startDate="store.currentGroup.start_date"
        :endDate="store.currentGroup.end_date"
        :numberOfMonths="store.currentGroup.number_of_months"
      />
      <MonthlySubscriptionTab v-if="activeTab === 'subscription'" :groupId="Number(groupId)" />
      <OtherTab v-if="activeTab === 'other'" :groupId="Number(groupId)" />
    </div>
  </div>
</template>

<style scoped>
.more-group-details {
  padding: 2rem;
}

.button-series {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 1rem;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  background-color: #f3f4f6;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button:hover {
  background-color: #e5e7eb;
}

.tab-button.active {
  background-color: #2c3e50;
  color: white;
}

.content-box {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
</style> 