<template>
  <el-dialog
    title="导出小程序流水"
    v-model="dialogVisible"
    width="500px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="日期区间" prop="dateRange">
        <el-date-picker
          v-model="form.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          :disabled-date="disabledDate"
          style="width: 100%"
        />
        <div class="tip">最长可导出近一年的数据</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading"
        >确认导出</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { exportMiniProgramFlow } from '../../service'
import dayjs from 'dayjs'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const formRef = ref<FormInstance>()

// 计算默认日期（最近60天）
const getDefaultDateRange = (): [string, string] => {
  const end = dayjs().format('YYYY-MM-DD')
  const start = dayjs().subtract(59, 'day').format('YYYY-MM-DD')
  return [start, end]
}

const form = reactive<{
  dateRange: [string, string] | null
}>({
  dateRange: getDefaultDateRange(),
})

// 日期验证规则
const validateDateRange = (_rule: any, value: any, callback: any) => {
  if (!value || !value[0] || !value[1]) {
    callback(new Error('请选择日期区间'))
    return
  }
  const start = dayjs(value[0])
  const end = dayjs(value[1])

  if (start.isAfter(end)) {
    callback(new Error('开始日期不能晚于结束日期'))
    return
  }

  // 验证时间范围不超过1年
  const daysDiff = end.diff(start, 'day')
  if (daysDiff > 365) {
    callback(new Error('时间范围不能超过1年'))
    return
  }

  callback()
}

const rules: FormRules = {
  dateRange: [
    { required: true, validator: validateDateRange, trigger: 'change' },
  ],
}

// 禁用日期：只禁用今天之后的日期
const disabledDate = (time: Date) => {
  return dayjs(time).isAfter(dayjs(), 'day')
}

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal) {
      form.dateRange = getDefaultDateRange()
    }
  },
)

watch(
  () => dialogVisible.value,
  (newVal) => {
    emit('update:visible', newVal)
  },
)

const handleClose = () => {
  formRef.value?.resetFields()
  form.dateRange = getDefaultDateRange()
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    if (!form.dateRange || !form.dateRange[0] || !form.dateRange[1]) {
      ElMessage.error('请选择日期区间')
      return
    }

    loading.value = true

    const res = await exportMiniProgramFlow({
      startDate: form.dateRange[0],
      endDate: form.dateRange[1],
    })

    if (res && res.downloadUrl) {
      // 创建一个链接元素并模拟点击下载
      const link = document.createElement('a')
      link.href = res.downloadUrl
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      ElMessage.success('导出成功')
      dialogVisible.value = false
      emit('success')
    } else {
      ElMessage.error('导出失败：当前选择时间段无数据')
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>
