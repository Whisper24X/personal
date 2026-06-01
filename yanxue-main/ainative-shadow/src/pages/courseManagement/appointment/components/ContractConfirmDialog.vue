<template>
  <el-dialog
    v-model="dialogVisible"
    title="请确认合同信息！"
    width="500px"
    center
  >
    <div class="contract-info">
      <p><span class="label">家长姓名：</span>{{ contractInfo.parentName }}</p>
      <p>
        <span class="label">家长手机号：</span>{{ contractInfo.parentPhone }}
      </p>
      <p><span class="label">孩子姓名：</span>{{ contractInfo.childName }}</p>
      <p><span class="label">身份证号：</span>{{ contractInfo.childId }}</p>
      <p>
        <span class="label">营期活动时间：</span
        >{{ contractInfo.activityStartDate }}～{{
          contractInfo.activityEndDate
        }}
      </p>
      <p class="fee">
        <span class="label">参营费用：</span>{{ contractInfo.cost }}
      </p>
      <p class="fee">
        <span class="label">大写人民币：</span>{{ contractInfo.costCapital }}
      </p>
      <p class="fee">
        <span class="label">付款日期：</span>{{ contractInfo.payEndDate }}
      </p>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="loading">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 合同信息接口
 */
export interface ContractInfo {
  /** 预约ID */
  courseAppointmentId: string
  /** 家长姓名 */
  parentName: string
  /** 家长手机号 */
  parentPhone: string
  /** 孩子姓名 */
  childName: string
  /** 孩子身份证号 */
  childId: string
  /** 活动开始日期 */
  activityStartDate: string
  /** 活动结束日期 */
  activityEndDate: string
  /** 活动费用 */
  cost: string
  /** 活动费用大写 */
  costCapital: string
  /** 付款截止日期 */
  payEndDate: string
}

// 组件属性定义
const props = defineProps<{
  visible: boolean
  contractInfo: ContractInfo
  loading: boolean
}>()

// 组件事件定义
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

// 计算属性 - 对话框显示状态
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

// 处理确认按钮点击
const handleConfirm = () => {
  emit('confirm')
}

// 处理取消按钮点击
const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.contract-info {
  background-color: #f5f7fa;
  padding: 20px;
  border-radius: 4px;
}

.contract-info p {
  margin: 10px 0;
  line-height: 24px;
}

.contract-info .label {
  display: inline-block;
  width: 120px;
  text-align: right;
  margin-right: 10px;
  font-weight: bold;
}

.contract-info .fee {
  color: #f56c6c;
  font-weight: bold;
}
</style>
