<script lang="ts" setup>
import { ref } from 'vue'

defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <div class="prompt-overlay" @click="emit('cancel')">
    <div class="prompt-dialog" @click.stop>
      <h3 class="prompt-title">{{ title }}</h3>
      <p class="prompt-message">{{ message }}</p>
      <div class="prompt-actions">
        <button class="cancel-button" @click="emit('cancel')">
          {{ cancelText || 'Cancel' }}
        </button>
        <button 
          class="confirm-button" 
          :class="type || 'danger'"
          @click="emit('confirm')"
        >
          {{ confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prompt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.prompt-dialog {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.prompt-title {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.25rem;
}

.prompt-message {
  margin: 0 0 1.5rem 0;
  color: #4b5563;
  line-height: 1.5;
}

.prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.cancel-button, .confirm-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.cancel-button {
  background-color: #e5e7eb;
  color: #4b5563;
}

.cancel-button:hover {
  background-color: #d1d5db;
}

.confirm-button {
  color: white;
}

.confirm-button.danger {
  background-color: #dc2626;
}

.confirm-button.danger:hover {
  background-color: #b91c1c;
}

.confirm-button.warning {
  background-color: #f59e0b;
}

.confirm-button.warning:hover {
  background-color: #d97706;
}

.confirm-button.info {
  background-color: #3b82f6;
}

.confirm-button.info:hover {
  background-color: #2563eb;
}
</style> 