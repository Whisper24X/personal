import type { Directive } from 'vue'
import { useUserStore } from '@/stores/modules/user'

export const authDirective: Directive<HTMLElement, string | string[]> = {
  mounted(element, binding) {
    const required = binding.value
    if (!required) return

    const permissions = Array.isArray(required) ? required : [required]
    const userStore = useUserStore()
    const allowed = permissions.some((permission) => userStore.hasPermission(permission))

    if (!allowed) {
      element.style.display = 'none'
    }
  },
}
