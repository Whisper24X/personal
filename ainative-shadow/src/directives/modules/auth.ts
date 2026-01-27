import { checkButtonAuth } from '@/utils/permission'
import type { Directive } from 'vue'

export const auth: Directive = (el: HTMLElement, binding, vnode, prevVnode) => {
  const { value } = binding
  if (!checkButtonAuth(value)) {
    el.style.display = 'none'
    el.parentNode && el.parentNode.removeChild(el)
  }
}
