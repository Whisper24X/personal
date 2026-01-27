<template>
    <el-select v-model="modelValue" placeholder="请选择时间段" clearable filterable style="width: 100%" :loading="loading"
        :disabled="disabled || options.length === 0" @change="handleChange">
        <el-option v-for="item in options" :key="item" :label="item" :value="item" />
    </el-select>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getCourseStockSelector } from '../service'
import { extractPeriodsForDate } from '../utils'

const props = defineProps<{
    modelValue: string
    disabled?: boolean
    courseId?: string
    date?: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'change', value: string): void
}>()

// 时间段选项
const options = ref<string[]>([])
const loading = ref(false)

/**
 * 加载时间段选项
 */
const loadOptions = async () => {
    if (!props.courseId || !props.date || props.disabled) {
        options.value = []
        return
    }

    try {
        loading.value = true
        const res = await getCourseStockSelector(props.courseId, {
            startDate: props.date,
            endDate: props.date
        })

        if (res && res.items && res.items.length > 0) {
            // 提取指定日期的时间段
            options.value = extractPeriodsForDate(res.items, props.date)

            // 如果当前选择的时间段不在可选范围内，则清空
            if (props.modelValue && !options.value.includes(props.modelValue)) {
                emit('update:modelValue', '')
            }

            if (options.value.length === 0) {
                ElMessage.warning('当前日期没有可用时间段')
            }
        } else {
            options.value = []
            ElMessage.warning('当前课程没有可用时间段')
        }
    } catch (error) {
        console.error('获取时间段选项失败:', error)
        ElMessage.error('获取时间段选项失败')
        options.value = []
    } finally {
        loading.value = false
    }
}

/**
 * 处理值变更
 */
const handleChange = (value: string) => {
    emit('update:modelValue', value)
    emit('change', value)
}

// 监听courseId和date变化
watch(
    [() => props.courseId, () => props.date],
    ([courseId, date]) => {
        if (courseId && date) {
            loadOptions()
        } else {
            options.value = []
        }
    },
    { immediate: true }
)
</script>