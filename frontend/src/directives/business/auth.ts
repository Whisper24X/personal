import type { Directive } from 'vue'
import { useAccessStore } from '@/stores/modules/access'
import { hasSomeAccess } from '@/constants/access-control'

export const authDirective: Directive<HTMLElement, string | string[]> = {
  mounted(element, binding) {
    const required = binding.value
    if (!required) return

    const capabilities = Array.isArray(required) ? required : [required]
    const accessStore = useAccessStore()
    const allowed = hasSomeAccess(capabilities, (capability) => accessStore.hasCapability(capability))

    if (!allowed) {
      element.style.display = 'none'
    }
  },
}
