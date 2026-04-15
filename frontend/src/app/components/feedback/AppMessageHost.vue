<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessageStore } from '@app/stores/modules/message'
import type { MessageType } from '@shared/types/component/message'

defineOptions({
  name: 'AppMessageHost',
})

const messageStore = useMessageStore()
const { items } = storeToRefs(messageStore)

const typeClassMap: Record<MessageType, string> = {
  success: 'app-message-success',
  error: 'app-message-error',
  warning: 'app-message-warning',
  info: 'app-message-info',
}

const typeTitleMap: Record<MessageType, string> = {
  success: '成功',
  error: '错误',
  warning: '提醒',
  info: '提示',
}

const typeIconMap: Record<MessageType, string> = {
  success: 'OK',
  error: 'ER',
  warning: 'WR',
  info: 'IF',
}

const messageList = computed(() => items.value)

const removeMessage = (id: string) => {
  messageStore.remove(id)
}
</script>

<template>
  <Teleport to="body">
    <section aria-live="polite" class="app-message-host" role="region">
      <TransitionGroup name="app-message-transition" tag="div">
        <article
          v-for="item in messageList"
          :key="item.id"
          class="app-message-item"
          :class="typeClassMap[item.type]"
          role="alert"
        >
          <div class="app-message-icon" aria-hidden="true">{{ typeIconMap[item.type] }}</div>
          <div class="app-message-content">
            <p class="app-message-title">{{ typeTitleMap[item.type] }}</p>
            <p class="app-message-text">{{ item.text }}</p>
          </div>
          <button class="app-message-close" type="button" aria-label="关闭消息" @click="removeMessage(item.id)">
            ×
          </button>
        </article>
      </TransitionGroup>
    </section>
  </Teleport>
</template>
