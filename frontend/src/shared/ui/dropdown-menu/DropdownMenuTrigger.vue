<script setup lang="ts">
import type { DropdownMenuTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DropdownMenuTrigger } from 'reka-ui'
import { cn } from '@shared/lib/utils'

const props = defineProps<DropdownMenuTriggerProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <DropdownMenuTrigger
    data-slot="dropdown-menu-trigger"
    v-bind="{ ...delegatedProps, ...$attrs }"
    :class="cn(props.class)"
  >
    <slot />
  </DropdownMenuTrigger>
</template>
