<template>
    <el-select v-model="modelValue" placeholder="请选择课程名称" clearable filterable style="width: 100%" :loading="loading"
        :disabled="disabled" @change="handleChange">
        <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getCourseSelector } from '../service'
import type { CourseOption } from '../types'

const props = defineProps<{
    modelValue: string
    disabled?: boolean
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'change', value: string): void
}>()

// 课程选项
const options = ref<CourseOption[]>([])
const loading = ref(false)

/**
 * 加载课程选项
 */
const loadOptions = async () => {
    if (props.disabled) return

    try {
        loading.value = true
        const res = await getCourseSelector()
        if (res && res.list) {
            options.value = res.list.map((item) => ({
                label: item.courseName,
                value: item.id,
            }))
        }
    } catch (error) {
        console.error('获取课程选项失败:', error)
        ElMessage.error('获取课程选项失败')
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

// 监听props.disabled变化
watch(
    () => props.disabled,
    (disabled) => {
        if (!disabled && options.value.length === 0) {
            loadOptions()
        }
    }
)

// 初始化加载课程选项
onMounted(() => {
    loadOptions()
})
</script>