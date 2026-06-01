<template>
  <el-dialog
    v-model="dialogVisible"
    title="渠道配置"
    width="500px"
    @opened="handleOpen"
    @close="handleClose"
  >
    <div class="channel-config-content">
      <div class="add-channel-section">
        <el-input
          v-model="newChannelName"
          placeholder="请输入新渠道名称"
          clearable
          maxlength="64"
          show-word-limit
          style="width: 260px; margin-right: 12px"
        />
        <el-button type="primary" :loading="creating" @click="handleCreate">
          确定
        </el-button>
        <el-button @click="clearInput">取消</el-button>
      </div>
      <el-divider content-position="left">渠道列表</el-divider>
      <el-table :data="channelList" border style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="渠道名称" min-width="120" />
      </el-table>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { getChannelList, createChannel } from '../../service'

function isRequestCanceled(err: unknown) {
  return (
    axios.isCancel(err) ||
    (err as { __CANCEL__?: boolean })?.__CANCEL__ === true ||
    (err as { name?: string })?.name === 'CanceledError' ||
    (err as { code?: string })?.code === 'ERR_CANCELED'
  )
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const dialogVisible = ref(props.visible)
const loading = ref(false)
const creating = ref(false)
const channelList = ref<{ id: string; name: string }[]>([])
const newChannelName = ref('')
/** 合并并发渠道列表请求，避免与 filterRepeatHttp 重复请求取消冲突 */
let channelListInflight: Promise<void> | null = null

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
  },
)

watch(
  () => dialogVisible.value,
  (val) => {
    emit('update:visible', val)
  },
)

const loadChannelList = (): Promise<void> => {
  if (channelListInflight) {
    return channelListInflight
  }
  const p = (async () => {
    try {
      loading.value = true
      const res = await getChannelList()
      channelList.value = res?.list ?? []
    } catch (error) {
      if (isRequestCanceled(error)) {
        return
      }
      console.error('获取渠道列表失败:', error)
      ElMessage.error('获取渠道列表失败，请刷新重试')
    } finally {
      loading.value = false
    }
  })()
  channelListInflight = p
  p.finally(() => {
    channelListInflight = null
  })
  return p
}

const handleOpen = () => {
  loadChannelList()
  clearInput()
}

const handleClose = () => {
  clearInput()
  channelList.value = []
}

const clearInput = () => {
  newChannelName.value = ''
}

const handleCreate = async () => {
  const name = newChannelName.value?.trim()
  if (!name) {
    ElMessage.warning('请输入渠道名称')
    return
  }
  try {
    creating.value = true
    await createChannel(name)
    ElMessage.success('创建成功')
    clearInput()
    await loadChannelList()
    emit('success')
  } catch (error: any) {
    const msg =
      error?.data?.message ??
      error?.response?.data?.message ??
      error?.message ??
      '创建失败'
    ElMessage.error(msg)
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.channel-config-content {
  padding: 0 8px;
}

.add-channel-section {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
</style>
