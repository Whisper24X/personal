<template>
    <el-date-picker v-model="modelValue" :type="type" :placeholder="placeholder" format="YYYY-MM-DD"
        value-format="YYYY-MM-DD" style="width: 100%" :disabled-date="disabledDateFunc" :disabled="disabled"
        :range-separator="rangeSeparator" :start-placeholder="startPlaceholder" :end-placeholder="endPlaceholder"
        :shortcuts="shortcuts" @change="handleChange" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { createDisabledDateFunction } from '../utils'

const props = defineProps<{
    modelValue: string | [string, string] | null
    type?: 'date' | 'daterange'
    placeholder?: string
    disabled?: boolean
    availableDates?: string[]
    courseId?: string
    rangeSeparator?: string
    startPlaceholder?: string
    endPlaceholder?: string
    shortcuts?: any[]
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: string | [string, string] | null): void
    (e: 'change', value: string | [string, string] | null): void
}>()

// 默认属性
const defaultProps = {
    type: 'date',
    placeholder: '请选择日期',
    rangeSeparator: '至',
    startPlaceholder: '开始日期',
    endPlaceholder: '结束日期'
}

// 禁用日期函数
const disabledDateFunc = computed(() => {
    return createDisabledDateFunction(props.availableDates || [], props.courseId || '')
})

/**
 * 处理值变更
 */
const handleChange = (value: string | [string, string] | null) => {
    emit('update:modelValue', value)
    emit('change', value)
}
</script>