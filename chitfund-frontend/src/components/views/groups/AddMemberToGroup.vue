<template>
  <!-- No changes to template section -->
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAvailableMembers, getGroupById, addMemberToGroup } from '../../services/groupService'

const props = defineProps<{
  groupId: number
}>()

const emit = defineEmits(['close', 'member-added'])

const loading = ref(false)
const error = ref('')
const members = ref([])
const selectedMemberId = ref('')
const groupDetails = ref(null)

async function loadMembers() {
  try {
    loading.value = true
    error.value = ''
    const [membersData, groupData] = await Promise.all([
      getAvailableMembers(),
      getGroupById(props.groupId)
    ])
    members.value = membersData
    groupDetails.value = groupData
  } catch (err: any) {
    console.error('Error loading data:', err)
    error.value = 'Failed to load data. Please try again.'
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  try {
    if (!selectedMemberId.value) {
      error.value = 'Please select a member'
      return
    }

    // Check if adding this member would exceed the group's member limit
    if (groupDetails.value && groupDetails.value.current_members >= groupDetails.value.memberCount) {
      error.value = `Cannot add more members. Group limit (${groupDetails.value.memberCount}) reached.`
      return
    }

    loading.value = true
    error.value = ''
    await addMemberToGroup(props.groupId, Number(selectedMemberId.value))
    emit('member-added')
    emit('close')
  } catch (err: any) {
    console.error('Error adding member to group:', err)
    error.value = err.response?.data?.message || 'Failed to add member to group. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadMembers)
</script> 