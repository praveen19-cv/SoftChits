<template>
  <Transition name="slide-up">
    <div v-if="show" class="notification" :class="type">
      {{ message }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const props = defineProps({
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'success',
    validator: (value: string) => ['success', 'error'].includes(value)
  },
  show: {
    type: Boolean,
    default: false
  },
  duration: {
    type: Number,
    default: 3000
  },
  navigateTo: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

// Auto close after duration and handle navigation
watch(() => props.show, (newValue) => {
  if (newValue && props.duration > 0) {
    setTimeout(() => {
      emit('close')
      // If navigateTo is provided, navigate after closing
      if (props.navigateTo) {
        router.push(props.navigateTo)
      }
    }, props.duration)
  }
})
</script>

<style scoped>
.notification {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 4px;
  color: white;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  min-width: 200px;
  text-align: center;
}

.notification.success {
  background-color: #10B981; /* Green */
}

.notification.error {
  background-color: #EF4444; /* Red */
}

/* Slide up animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}

.slide-up-enter-to,
.slide-up-leave-from {
  transform: translate(-50%, 0);
  opacity: 1;
}
</style> 