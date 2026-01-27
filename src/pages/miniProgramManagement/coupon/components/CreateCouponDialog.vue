<template>
  <el-dialog
    v-model="dialogVisible"
    title="新建优惠券"
    width="800px"
    :before-close="handleClose"
    :close-on-click-modal="false"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
      class="create-coupon-form"
    >
      <!-- 名称 -->
      <el-form-item label="名称" prop="name" required>
        <el-input
          v-model="formData.name"
          placeholder="请输入优惠券名称"
          maxlength="20"
          show-word-limit
          clearable
        />
      </el-form-item>

      <!-- 优惠金额 -->
      <el-form-item label="优惠金额" prop="discountAmount" required>
        <el-input
          v-model="formData.discountAmount"
          placeholder="请输入优惠金额"
          maxlength="6"
          clearable
        >
          <template #append>元</template>
        </el-input>
      </el-form-item>

      <!-- 推送方式 -->
      <el-form-item label="推送方式" prop="pushType" required>
        <el-radio-group v-model="formData.pushType">
          <el-radio value="public">公开推送</el-radio>
          <el-radio value="private">私密推送</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 券类型 -->
      <el-form-item label="券类型" prop="couponType" required>
        <el-row :gutter="16">
          <el-col :span="10">
            <el-radio-group
              v-model="formData.couponType"
              @change="handleTypeChange"
              class="type-radio-group"
            >
              <el-radio value="common">通用</el-radio>
              <el-radio value="good">商品</el-radio>
            </el-radio-group>
          </el-col>
          <el-col :span="14">
            <div
              v-if="formData.couponType === 'good'"
              class="config-goods-section"
            >
              <el-button type="primary" size="small" @click="handleConfigGoods">
                {{
                  selectedGoodsCount > 0 ? '重新配置商品' : '配置优惠券适用商品'
                }}
              </el-button>
              <div v-if="selectedGoodsCount > 0" class="selected-goods-info">
                已选择 {{ selectedGoodsCount }} 个商品
              </div>
            </div>
          </el-col>
        </el-row>
      </el-form-item>

      <!-- 门槛 -->
      <el-form-item label="门槛" prop="minAmount" required>
        <el-input
          v-model="formData.minAmount"
          placeholder="请输入门槛金额，0表示无门槛"
          clearable
        >
          <template #append>元</template>
        </el-input>
      </el-form-item>

      <!-- 使用时间 -->
      <el-form-item
        label="使用时间"
        :prop="
          formData.useTimeType === '绝对时间'
            ? 'validTimeRange'
            : 'couponValidDays'
        "
        required
      >
        <el-row :gutter="16">
          <el-col :span="24">
            <el-radio-group
              v-model="formData.useTimeType"
              @change="handleUseTimeTypeChange"
            >
              <el-radio value="绝对时间">绝对时间</el-radio>
              <el-radio value="领取后几天内使用">领取后几天内使用</el-radio>
            </el-radio-group>
          </el-col>
          <el-col v-if="formData.useTimeType === '绝对时间'" :span="24">
            <el-date-picker
              v-model="formData.validTimeRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 400px"
            />
          </el-col>
          <el-col v-if="formData.useTimeType === '领取后几天内使用'" :span="8">
            <el-input
              v-model="formData.couponValidDays"
              placeholder="请输入天数"
              clearable
            >
              <template #append>天</template>
            </el-input>
          </el-col>
        </el-row>
      </el-form-item>

      <!-- 领取时间 -->
      <el-form-item
        label="领取时间"
        :prop="
          formData.receiveTimeType === '限时'
            ? 'claimTimeRange'
            : 'claimTimeRangeFake'
        "
      >
        <el-row :gutter="16">
          <el-col :span="24">
            <el-radio-group
              v-model="formData.receiveTimeType"
              @change="handleReceiveTimeTypeChange"
            >
              <el-radio value="不限时">不限时</el-radio>
              <el-radio value="限时">限时</el-radio>
            </el-radio-group>
          </el-col>
          <el-col v-if="formData.receiveTimeType === '限时'" :span="24">
            <el-date-picker
              v-model="formData.claimTimeRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 400px"
            />
          </el-col>
        </el-row>
      </el-form-item>

      <!-- 投放张数和每人限领 -->
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="投放张数" prop="totalStock" required>
            <el-input
              v-model="formData.totalStock"
              placeholder="请输入投放张数"
              maxlength="8"
              clearable
            >
              <template #append>张</template>
            </el-input>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="每人限领" prop="limitPerUser" required>
            <el-input
              v-model="formData.limitPerUser"
              placeholder="请输入限领数量"
              maxlength="2"
              clearable
            >
              <template #append>张</template>
            </el-input>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 备注 -->
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="3"
          placeholder="请输入备注信息"
          maxlength="200"
          show-word-limit
          clearable
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          创建优惠券
        </el-button>
      </div>
    </template>

    <!-- 配置商品对话框 -->
    <ConfigCouponGoodsDialog
      v-model:visible="configGoodsDialogVisible"
      :couponData="{ name: formData.name || '新建优惠券' }"
      @success="handleGoodsConfigSuccess"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import ConfigCouponGoodsDialog from './ConfigCouponGoodsDialog.vue'
import { createCoupon } from '../service'
import type { CreateCouponParams } from '../service.type'

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
const configGoodsDialogVisible = ref(false)
const selectedGoodsCount = ref(0)
const selectedGoods = ref<any[]>([])

// 表单数据
const formData = reactive({
  name: '',
  discountAmount: '',
  pushType: 'public',
  couponType: 'common',
  minAmount: '0',
  useTimeType: '绝对时间',
  validTimeRange: null,
  couponValidDays: '',
  receiveTimeType: '不限时',
  claimTimeRange: null,
  totalStock: '',
  limitPerUser: '',
  remark: '',
})

// 表单验证规则 - 汇总所有规则
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入优惠券名称', trigger: 'blur' },
    { min: 1, max: 20, message: '长度在 1 到 20 个字符', trigger: 'blur' },
    {
      pattern: /^[\u4e00-\u9fa5a-zA-Z0-9]+$/,
      message: '只能输入汉字、数字、字母',
      trigger: 'blur',
    },
  ],
  discountAmount: [
    { required: true, message: '请输入优惠金额', trigger: 'blur' },
    { pattern: /^\d{1,6}$/, message: '请输入1-6位数字', trigger: 'blur' },
  ],
  pushType: [{ required: true, message: '请选择推送方式', trigger: 'change' }],
  couponType: [{ required: true, message: '请选择券类型', trigger: 'change' }],
  minAmount: [
    { required: true, message: '请输入门槛金额', trigger: 'blur' },
    { pattern: /^\d+$/, message: '请输入有效数字', trigger: 'blur' },
  ],
  useTimeType: [
    { required: true, message: '请选择使用时间类型', trigger: 'change' },
  ],
  validTimeRange: [
    {
      required: true,
      message: '请选择使用时间范围',
      trigger: 'change',
      validator: (rule, value, callback) => {
        if (
          formData.useTimeType === '绝对时间' &&
          (!value || value.length !== 2)
        ) {
          callback(new Error('请选择使用时间范围'))
        } else {
          callback()
        }
      },
    },
  ],
  couponValidDays: [
    {
      required: true,
      message: '请输入有效天数',
      trigger: 'blur',
      validator: (rule, value, callback) => {
        if (formData.useTimeType === '领取后几天内使用') {
          if (!value || value === '') {
            callback(new Error('请输入有效天数'))
          } else if (!/^\d+$/.test(value)) {
            callback(new Error('请输入有效数字'))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
    },
  ],
  receiveTimeType: [
    { required: true, message: '请选择领取时间类型', trigger: 'change' },
  ],
  claimTimeRange: [
    {
      required: true,
      message: '请选择领取时间范围',
      trigger: 'blur',
      validator: (rule, value, callback) => {
        if (
          formData.receiveTimeType === '限时' &&
          (!value || value.length !== 2)
        ) {
          callback(new Error('请选择领取时间范围'))
        } else {
          callback()
        }
      },
    },
  ],
  totalStock: [
    { required: true, message: '请输入投放张数', trigger: 'blur' },
    { pattern: /^\d{1,8}$/, message: '请输入1-8位数字', trigger: 'blur' },
  ],
  limitPerUser: [
    { required: true, message: '请输入每人限领数量', trigger: 'blur' },
    { pattern: /^\d{1,2}$/, message: '请输入1-2位数字', trigger: 'blur' },
  ],
  remark: [{ max: 200, message: '备注长度不能超过200个字符', trigger: 'blur' }],
}

// 不再需要动态验证规则，所有规则已在初始化时汇总

watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal
  },
)

watch(
  () => dialogVisible.value,
  (newVal) => {
    emit('update:visible', newVal)
  },
)

/**
 * 处理券类型改变
 */
const handleTypeChange = (value: string) => {
  if (value === 'common') {
    selectedGoodsCount.value = 0
    selectedGoods.value = []
  }
}

/**
 * 处理使用时间类型改变
 */
const handleUseTimeTypeChange = (value: string) => {
  if (value === '绝对时间') {
    formData.couponValidDays = ''
    // 清除有效天数的验证提示
    nextTick(() => {
      if (formRef.value) {
        formRef.value.clearValidate(['validTimeRange'])
      }
    })
  } else {
    formData.validTimeRange = null
    // 清除时间范围的验证提示
    nextTick(() => {
      if (formRef.value) {
        formRef.value.clearValidate(['couponValidDays'])
      }
    })
  }
}

/**
 * 处理领取时间类型改变
 */
const handleReceiveTimeTypeChange = (value: string) => {
  if (value !== '限时') {
    formData.claimTimeRange = null
    // 清除领取时间范围的验证提示
    nextTick(() => {
      if (formRef.value) {
        formRef.value.clearValidate(['claimTimeRangeFake'])
      }
    })
  }
}

/**
 * 处理配置商品
 */
const handleConfigGoods = () => {
  configGoodsDialogVisible.value = true
}

/**
 * 处理商品配置成功
 */
const handleGoodsConfigSuccess = (goods: any[]) => {
  selectedGoods.value = goods || []
  selectedGoodsCount.value = selectedGoods.value.length
  ElMessage.success(`已配置 ${selectedGoodsCount.value} 个适用商品`)
}

/**
 * 重置表单
 */
const resetForm = () => {
  Object.assign(formData, {
    name: '',
    discountAmount: '',
    pushType: 'public',
    couponType: 'common',
    minAmount: '0',
    useTimeType: '绝对时间',
    validTimeRange: null,
    couponValidDays: '',
    receiveTimeType: '不限时',
    claimTimeRange: null,
    totalStock: '',
    limitPerUser: '',
    remark: '',
  })
  selectedGoodsCount.value = 0
  selectedGoods.value = []
}

/**
 * 处理对话框关闭
 */
const handleClose = () => {
  dialogVisible.value = false
  if (formRef.value) {
    formRef.value.resetFields()
  }
  resetForm()
}

/**
 * 生成唯一ID (UUID格式)
 */
const generateUniqueId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 处理表单提交
 */
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    // 验证商品类型必须选择商品
    if (formData.couponType === 'good' && selectedGoods.value.length === 0) {
      ElMessage.error('请先配置优惠券适用商品')
      return
    }

    loading.value = true

    // 构造提交数据
    const submitData: any = {
      id: generateUniqueId(),
      name: formData.name,
      discountAmount: parseInt(formData.discountAmount),
      pushType: formData.pushType,
      couponType: formData.couponType,
      minAmount: parseInt(formData.minAmount),
      totalStock: parseInt(formData.totalStock),
      limitPerUser: parseInt(formData.limitPerUser),
      remark: formData.remark || '',
      shareQRCode: '', // 暂时为空，后续可能需要生成二维码
    }

    // 只有选择商品券类型时才添加适用商品参数
    if (formData.couponType === 'good') {
      submitData.adaptGoodInfo = selectedGoods.value.map((item) => item.id)
    }

    // 只有选择绝对时间时才添加时间参数
    if (formData.useTimeType === '绝对时间' && formData.validTimeRange) {
      submitData.validStartTime = formData.validTimeRange[0]
      submitData.validEndTime = formData.validTimeRange[1]
    }

    // 只有选择限时时才添加领取时间参数
    if (formData.receiveTimeType === '限时' && formData.claimTimeRange) {
      submitData.claimStartTime = formData.claimTimeRange[0]
      submitData.claimEndTime = formData.claimTimeRange[1]
    }

    // 只有选择领取后几天内使用时才添加有效天数参数
    if (
      formData.useTimeType === '领取后几天内使用' &&
      formData.couponValidDays
    ) {
      submitData.couponValidDays = parseInt(formData.couponValidDays)
    }

    console.log('创建优惠券:', submitData)

    // 调用创建优惠券的API
    await createCoupon(submitData)

    ElMessage.success('优惠券创建成功')
    handleClose()
    emit('success')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.create-coupon-form {
  max-height: 600px;
  overflow-y: auto;
  padding-right: 8px;

  // 滚动条样式
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
    transition: background 0.2s;

    &:hover {
      background: #a8a8a8;
    }
  }
  .type-radio-group {
    width: 280px;
  }
}

// 商品配置区域
.config-goods-section {
  margin-left: 16px;

  .selected-goods-info {
    color: #67c23a;
    font-size: 12px;
    margin-top: 4px;
  }
}

// 时间分隔符样式
.time-separator {
  color: #606266;
  font-size: 14px;
}

// 对话框底部
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

// 表单项样式优化
:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-form-item__content) {
  align-items: flex-start;
}

// 单选按钮组样式
:deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

// 时间选择器通用样式
:deep(.el-date-editor) {
  width: 200px;
}
</style>
