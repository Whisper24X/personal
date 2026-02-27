import { useMessageStore } from '@/stores/modules/message'

export const useMessage = () => {
  const messageStore = useMessageStore()

  return {
    push: messageStore.push,
    success: messageStore.success,
    error: messageStore.error,
    warning: messageStore.warning,
    info: messageStore.info,
    remove: messageStore.remove,
    clear: messageStore.clear,
  }
}
