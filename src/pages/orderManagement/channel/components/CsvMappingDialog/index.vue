<template>
  <el-dialog
    :title="title"
    v-model="dialogVisible"
    width="900px"
    @close="handleClose"
    destroy-on-close
  >
    <el-tabs v-model="activeChannelId" @tab-change="handleTabClick">
      <el-tab-pane
        v-for="channel in channelOptions"
        :key="channel.value"
        :label="channel.label"
        :name="channel.value"
      >
        <el-form :model="form" label-width="120px">
          <el-divider content-position="left"
            >系统字段与CSV文件字段映射</el-divider
          >

          <div class="mapping-container">
            <el-table :data="form.fieldMappings" border style="width: 100%">
              <el-table-column label="系统字段" prop="systemField" width="180">
                <template #default="{ row, $index }">
                  <el-select
                    v-model="row.systemField"
                    placeholder="选择系统字段"
                    style="width: 100%"
                    @change="(val: string) => handleFieldChange(val, $index)"
                  >
                    <el-option
                      v-for="field in SYSTEM_FIELDS"
                      :key="field.value"
                      :label="field.label"
                      :value="field.value"
                      :disabled="isFieldUsed(field.value, $index)"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="CSV文件字段" prop="csvField" width="180">
                <template #default="{ row }">
                  <el-input
                    v-model="row.csvField"
                    placeholder="输入CSV文件字段名"
                  />
                </template>
              </el-table-column>
              <el-table-column label="必填" prop="required" width="80">
                <template #default="{ row }">
                  <el-checkbox v-model="row.required" />
                </template>
              </el-table-column>
              <el-table-column label="操作">
                <template #default="{ $index }">
                  <el-button
                    type="danger"
                    link
                    @click="removeFieldMapping($index)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="add-mapping-btn">
              <el-button type="primary" @click="addFieldMapping"
                >添加字段映射</el-button
              >
            </div>
          </div>

          <el-divider content-position="left">订单状态值映射</el-divider>

          <div class="mapping-container">
            <el-table :data="form.statusMappings" border style="width: 100%">
              <el-table-column
                label="系统状态值"
                prop="systemValue"
                width="180"
              >
                <template #default="{ row }">
                  <el-select
                    v-model="row.systemValue"
                    placeholder="选择系统状态值"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="status in ORDER_STATUS_MAPPING_OPTIONS"
                      :key="status.value"
                      :label="status.label"
                      :value="status.value"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column
                label="CSV文件状态值"
                prop="csvValue"
                width="180"
              >
                <template #default="{ row }">
                  <el-input
                    v-model="row.csvValue"
                    placeholder="输入CSV文件中的状态值"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作">
                <template #default="{ $index }">
                  <el-button
                    type="danger"
                    link
                    @click="removeStatusMapping($index)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="add-mapping-btn">
              <el-button type="primary" @click="addStatusMapping"
                >添加状态映射</el-button
              >
            </div>
          </div>

          <el-divider content-position="left">服务状态值映射</el-divider>

          <div class="mapping-container">
            <el-table
              :data="form.serviceStatusMappings"
              border
              style="width: 100%"
            >
              <el-table-column
                label="系统状态值"
                prop="systemValue"
                width="180"
              >
                <template #default="{ row }">
                  <el-select
                    v-model="row.systemValue"
                    placeholder="选择系统状态值"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="status in SERVICE_STATUS_MAPPING_OPTIONS"
                      :key="status.value"
                      :label="status.label"
                      :value="status.value"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column
                label="CSV文件状态值"
                prop="csvValue"
                width="180"
              >
                <template #default="{ row }">
                  <el-input
                    v-model="row.csvValue"
                    placeholder="输入CSV文件中的状态值"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作">
                <template #default="{ $index }">
                  <el-button
                    type="danger"
                    link
                    @click="removeServiceStatusMapping($index)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="add-mapping-btn">
              <el-button type="primary" @click="addServiceStatusMapping"
                >添加状态映射</el-button
              >
            </div>
          </div>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading"
        >保存</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import {
  fetchChannelList,
  fetchMappingConfig,
  submitMappingConfig,
} from './service'
import type { CsvMappingForm, ChannelOption } from './types'
import {
  SYSTEM_FIELDS,
  ORDER_STATUS_MAPPING_OPTIONS,
  SERVICE_STATUS_MAPPING_OPTIONS,
} from './types'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  channelId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:visible', 'refresh'])

// 状态
const dialogVisible = ref(props.visible)
const loading = ref(false)
const title = ref('CSV文件映射配置')
const channelOptions = ref<ChannelOption[]>([])
const activeChannelId = ref('') // 当前激活的渠道ID

// 表单数据
const form = reactive<CsvMappingForm>({
  channelId: props.channelId,
  fieldMappings: [{ systemField: '', csvField: '', required: true }],
  statusMappings: [{ csvValue: '', systemValue: '' }],
  serviceStatusMappings: [{ csvValue: '', systemValue: '' }],
  fieldMappingId: '',
  statusMappingId: '',
  serviceStatusMappingId: '',
})

// 监听visible属性变化
watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
    if (newVal) {
      initializeData()
    }
  },
)

// 监听dialogVisible变化
watch(
  () => dialogVisible.value,
  (newVal) => {
    emit('update:visible', newVal)
  },
)

// 监听channelId变化
watch(
  () => props.channelId,
  (newVal) => {
    if (newVal && dialogVisible.value) {
      activeChannelId.value = newVal
      loadMappingConfig(newVal)
    }
  },
)

// 处理Tab点击
const handleTabClick = () => {
  if (activeChannelId.value) {
    loadMappingConfig(activeChannelId.value)
  }
}

// 初始化数据
const initializeData = async () => {
  await loadChannels()

  if (props.channelId) {
    activeChannelId.value = props.channelId
  } else {
    const douyinChannel = channelOptions.value.find(
      (channel) =>
        channel.label.includes('抖音') || channel.label.includes('抖店'),
    )

    if (douyinChannel) {
      activeChannelId.value = douyinChannel.value
    } else if (channelOptions.value.length > 0) {
      activeChannelId.value = channelOptions.value[0].value
    }
  }

  if (activeChannelId.value) {
    loadMappingConfig(activeChannelId.value)
  }
}

// 加载渠道列表
const loadChannels = async () => {
  try {
    loading.value = true
    channelOptions.value = await fetchChannelList()
  } finally {
    loading.value = false
  }
}

// 加载映射配置
const loadMappingConfig = async (channelId: string) => {
  try {
    loading.value = true
    form.channelId = channelId

    const selectedChannel = channelOptions.value.find(
      (c) => c.value === channelId,
    )
    if (!selectedChannel) {
      ElMessage.error('找不到对应的渠道信息')
      return
    }

    const config = await fetchMappingConfig(selectedChannel.label)
    if (config) {
      Object.assign(form, config)
    } else {
      // 重置表单
      form.fieldMappings = [{ systemField: '', csvField: '', required: true }]
      form.statusMappings = [{ csvValue: '', systemValue: '' }]
      form.serviceStatusMappings = [{ csvValue: '', systemValue: '' }]
      form.fieldMappingId = ''
      form.statusMappingId = ''
      form.serviceStatusMappingId = ''
    }
  } finally {
    loading.value = false
  }
}

// 添加字段映射
const addFieldMapping = () => {
  form.fieldMappings.push({ systemField: '', csvField: '', required: false })
}

// 删除字段映射
const removeFieldMapping = (index: number) => {
  form.fieldMappings.splice(index, 1)
  if (form.fieldMappings.length === 0) {
    form.fieldMappings.push({ systemField: '', csvField: '', required: false })
  }
}

// 添加状态映射
const addStatusMapping = () => {
  form.statusMappings.push({ csvValue: '', systemValue: '' })
}

// 删除状态映射
const removeStatusMapping = (index: number) => {
  form.statusMappings.splice(index, 1)
  if (form.statusMappings.length === 0) {
    form.statusMappings.push({ csvValue: '', systemValue: '' })
  }
}

// 添加服务状态映射
const addServiceStatusMapping = () => {
  form.serviceStatusMappings.push({ csvValue: '', systemValue: '' })
}

// 删除服务状态映射
const removeServiceStatusMapping = (index: number) => {
  form.serviceStatusMappings.splice(index, 1)
  if (form.serviceStatusMappings.length === 0) {
    form.serviceStatusMappings.push({ csvValue: '', systemValue: '' })
  }
}

// 检查字段是否已经被使用
const isFieldUsed = (fieldValue: string, currentIndex: number): boolean => {
  if (!fieldValue) return false
  return form.fieldMappings.some(
    (item, index) => index !== currentIndex && item.systemField === fieldValue,
  )
}

// 处理提交
const handleSubmit = async () => {
  try {
    const validFieldMappings = form.fieldMappings.filter(
      (item) => item.systemField && item.csvField,
    )

    if (validFieldMappings.length === 0) {
      ElMessage.warning('请至少添加一个有效的字段映射')
      return
    }

    const validStatusMappings = form.statusMappings.filter(
      (item) => item.csvValue && item.systemValue,
    )

    if (validStatusMappings.length === 0) {
      ElMessage.warning('请至少添加一个有效的订单状态映射')
      return
    }

    const validServiceStatusMappings = form.serviceStatusMappings.filter(
      (item) => item.csvValue && item.systemValue,
    )

    if (validServiceStatusMappings.length === 0) {
      ElMessage.warning('请至少添加一个有效的服务状态映射')
      return
    }

    loading.value = true

    const selectedChannel = channelOptions.value.find(
      (c) => c.value === activeChannelId.value,
    )
    if (!selectedChannel) {
      ElMessage.error('找不到对应的渠道信息')
      return
    }

    const success = await submitMappingConfig({
      channelId: activeChannelId.value,
      channelName: selectedChannel.label,
      fieldMappings: validFieldMappings,
      statusMappings: validStatusMappings,
      serviceStatusMappings: validServiceStatusMappings,
      fieldMappingId: form.fieldMappingId,
      statusMappingId: form.statusMappingId,
      serviceStatusMappingId: form.serviceStatusMappingId,
    })

    if (success) {
      dialogVisible.value = false
      emit('refresh')
    }
  } finally {
    loading.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  dialogVisible.value = false
}

// 处理字段变更
const handleFieldChange = (value: string, index: number) => {
  if (value && isFieldUsed(value, index)) {
    ElMessage.warning(`字段 "${value}" 已被使用，请选择其他字段`)
    form.fieldMappings[index].systemField = ''
  }
}
</script>

<style scoped>
.mapping-container {
  margin-bottom: 20px;
}

.add-mapping-btn {
  margin-top: 10px;
  text-align: center;
}
</style>
