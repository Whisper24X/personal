import {
  getChannelList,
  getCsvMappingConfig,
  saveCsvMappingConfig,
} from '../../service'
import type { ChannelOption, CsvMappingForm } from './types'
import { ElMessage } from 'element-plus'

export async function fetchChannelList(): Promise<ChannelOption[]> {
  try {
    const res = await getChannelList()
    if (res && res.list && res.list.length > 0) {
      return res.list.map((item) => ({
        label: item.name,
        value: item.id,
      }))
    }
    return []
  } catch (error) {
    console.error('获取渠道列表失败:', error)
    ElMessage.error('获取渠道列表失败')
    return []
  }
}

export async function fetchMappingConfig(channelName: string) {
  try {
    const res = await getCsvMappingConfig(channelName)
    if (!res || !res.list || res.list.length === 0) {
      return null
    }

    const result = {
      fieldMappings: [{ systemField: '', csvField: '', required: true }],
      statusMappings: [{ csvValue: '', systemValue: '' }],
      serviceStatusMappings: [{ csvValue: '', systemValue: '' }],
      fieldMappingId: '',
      statusMappingId: '',
      serviceStatusMappingId: '',
    }

    // 处理字段映射数据 (mappingType = 'field')
    const fieldMappingItem = res.list.find(
      (item) => item.mappingType === 'field',
    )
    if (
      fieldMappingItem &&
      fieldMappingItem.data &&
      fieldMappingItem.data.length > 0
    ) {
      result.fieldMappingId = fieldMappingItem.id
      result.fieldMappings = fieldMappingItem.data.map((item) => ({
        systemField: item.sysDynamicFieldName,
        csvField: item.csvDynamicFieldName,
        required: true,
      }))
    }

    // 处理订单状态映射数据 (mappingType = 'enum')
    const statusMappingItem = res.list.find(
      (item) => item.mappingType === 'enum',
    )
    if (
      statusMappingItem &&
      statusMappingItem.data &&
      statusMappingItem.data.length > 0
    ) {
      result.statusMappingId = statusMappingItem.id
      result.statusMappings = statusMappingItem.data.map((item) => ({
        systemValue: item.sysDynamicFieldName,
        csvValue: item.csvDynamicFieldName,
      }))
    }

    // 处理服务状态映射数据 (mappingType = 'serviceStatusEnum')
    const serviceStatusMappingItem = res.list.find(
      (item) => item.mappingType === 'serviceStatusEnum',
    )
    if (
      serviceStatusMappingItem &&
      serviceStatusMappingItem.data &&
      serviceStatusMappingItem.data.length > 0
    ) {
      result.serviceStatusMappingId = serviceStatusMappingItem.id
      result.serviceStatusMappings = serviceStatusMappingItem.data.map(
        (item) => ({
          systemValue: item.sysDynamicFieldName,
          csvValue: item.csvDynamicFieldName,
        }),
      )
    }

    return result
  } catch (error) {
    console.error('获取映射配置失败:', error)
    ElMessage.error('获取映射配置失败')
    return null
  }
}

export async function submitMappingConfig(data: {
  channelId: string
  channelName: string
  fieldMappings: any[]
  statusMappings: any[]
  serviceStatusMappings?: any[]
  fieldMappingId: string
  statusMappingId: string
  serviceStatusMappingId?: string
}) {
  try {
    await saveCsvMappingConfig(data)
    ElMessage.success('保存成功')
    return true
  } catch (error) {
    console.error('保存映射配置失败:', error)
    ElMessage.error('保存映射配置失败')
    return false
  }
}
