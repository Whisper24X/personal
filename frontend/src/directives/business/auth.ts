import type { Directive } from 'vue'
import { useAccessStore } from '@/stores/modules/access'

export const authDirective: Directive<HTMLElement, string | string[]> = {
  mounted(element, binding) {
    const required = binding.value
    if (!required) return

    const capabilities = Array.isArray(required) ? required : [required]
    const accessStore = useAccessStore()
    const allowed = capabilities.some((capability) => accessStore.hasCapability(capability))

    if (!allowed) {
      element.style.display = 'none'
    }
  },
}
