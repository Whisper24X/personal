<template>
  <el-dialog
    v-model="dialogVisible"
    :title="couponData?.name || '优惠券详情'"
    width="1000px"
    :before-close="handleClose"
    :close-on-click-modal="false"
  >
    <div v-if="couponData" class="coupon-detail-container">
      <!-- 数量统计栏 -->
      <div class="stats-section">
        <div class="stats-row">
          <span class="stats-label">剩余数量</span>
          <span class="stats-label">投放数量</span>
          <span class="stats-label">领取数量</span>
          <span class="stats-label">核销数量</span>
        </div>
        <div class="stats-row values">
          <span class="stats-value">{{ couponStats.remainingQuantity }}</span>
          <span class="stats-value">{{ couponStats.totalQuantity }}</span>
          <span class="stats-value">{{ couponStats.receivedQuantity }}</span>
          <span class="stats-value">{{ couponStats.usedQuantity }}</span>
        </div>
      </div>

      <!-- 优惠券详细信息 -->
      <el-form
        :model="couponData"
        label-width="120px"
        class="coupon-detail-form"
      >
        <el-form-item label="名称">
          <el-input v-model="couponData.name" readonly />
        </el-form-item>

        <el-form-item label="优惠金额">
          <el-input :value="couponData.discountAmount" readonly>
            <template #append>元</template>
          </el-input>
        </el-form-item>

        <el-form-item label="推送方式">
          <el-radio-group v-model="couponData.pushType" disabled>
            <el-radio value="public">公开</el-radio>
            <el-radio value="private">私密</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="券类型">
          <el-radio-group v-model="couponData.couponType" disabled>
            <el-radio value="common">通用</el-radio>
            <el-radio value="good">商品</el-radio>
          </el-radio-group>
          <el-button
            v-if="couponData.couponType === 'good'"
            type="primary"
            link
            class="view-goods-btn"
            @click="handleViewGoods"
          >
            点击查看
          </el-button>
        </el-form-item>

        <el-form-item label="门槛">
          <el-input :value="couponData.minAmount" readonly>
            <template #append>元</template>
          </el-input>
          <div class="threshold-tip">
            {{
              couponData.minAmount === 0
                ? '无门槛'
                : `满${couponData.minAmount}元可用`
            }}
          </div>
        </el-form-item>

        <el-form-item label="使用时间">
          <el-row :gutter="16">
            <el-col :span="24">
              <el-radio-group v-model="useTimeType" disabled>
                <el-radio value="绝对时间">绝对时间</el-radio>
                <el-radio value="领取后几天内使用">领取后几天内使用</el-radio>
              </el-radio-group>
            </el-col>
            <el-col v-if="useTimeType === '绝对时间'" :span="24">
              <el-date-picker
                v-model="validTimeRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
                disabled
              />
            </el-col>
            <el-col v-if="useTimeType === '领取后几天内使用'" :span="8">
              <el-input v-model="couponValidDays" readonly>
                <template #append>天内使用</template>
              </el-input>
            </el-col>
          </el-row>
        </el-form-item>

        <el-form-item label="领取时间">
          <el-row :gutter="16">
            <el-col :span="24">
              <el-radio-group v-model="receiveTimeType" disabled>
                <el-radio value="不限时">不限时</el-radio>
                <el-radio value="限时">限时</el-radio>
              </el-radio-group>
            </el-col>
            <el-col v-if="receiveTimeType === '限时'" :span="24">
              <el-date-picker
                v-model="claimTimeRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
                disabled
              />
            </el-col>
          </el-row>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="投放张数">
              <el-input :value="couponData.totalStock" readonly>
                <template #append>张</template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每人限领">
              <el-input :value="couponData.limitPerUser" readonly>
                <template #append>张</template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input
            v-model="couponData.remark"
            type="textarea"
            :rows="3"
            readonly
            placeholder="请输入备注信息"
          />
        </el-form-item>
      </el-form>

      <!-- 私密推送分享图 -->
      <div v-if="couponData.pushType === 'private'" class="share-section">
        <div class="share-preview">
          <img
            :src="shareImageUrl"
            alt="分享图预览"
            @error="handleImageError"
          />
        </div>
        <div class="share-actions">
          <el-button type="default" @click="togglePreview">
            {{ showPreview ? '隐藏预览' : '显示预览' }}
          </el-button>
          <el-button
            class="download-btn"
            type="primary"
            @click="handleDownloadImage"
            :loading="downloadLoading"
          >
            下载分享图
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>

    <!-- 适用商品查看对话框 -->
    <ConfigCouponGoodsDialog
      v-if="couponData"
      v-model:visible="goodsDialogVisible"
      :couponData="couponData"
      :readonly="true"
      @success="() => {}"
    />

    <!-- 分享图组件(隐藏,仅用于生成图片) -->
    <CouponShareImage
      v-if="shareImageConfig"
      ref="shareImageComponentRef"
      v-bind="shareImageConfig"
      :showPreview="showPreview"
      @closePreview="handleClosePreview"
    />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import ConfigCouponGoodsDialog from './ConfigCouponGoodsDialog.vue'
import CouponShareImage from '@/components/CouponShareImage/index.vue'
import { CouponItem, CouponQuantitySummaryResponse } from '../service.type'
import {
  generateCouponShareImage,
  downloadCouponShareImage,
} from '@/utils/couponShareImage'
import { getCouponQuantitySummary } from '../service'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  couponData: {
    type: Object as () => CouponItem | null,
    default: null,
  },
})

const emit = defineEmits(['update:visible'])

const dialogVisible = ref(props.visible)
const goodsDialogVisible = ref(false)
const downloadLoading = ref(false)
const showPreview = ref(false)
const shareImageComponentRef = ref<InstanceType<typeof CouponShareImage>>()

// 统计数据
const couponStats = ref<CouponQuantitySummaryResponse>({
  remainingQuantity: 0,
  totalQuantity: 0,
  receivedQuantity: 0,
  usedQuantity: 0,
})

// 加载统计数据
const loadQuantitySummary = async () => {
  if (!props.couponData?.id) return

  try {
    const res = await getCouponQuantitySummary(props.couponData.id)
    couponStats.value = res as CouponQuantitySummaryResponse
  } catch (error) {
    console.error('获取优惠券数量统计失败:', error)
    ElMessage.error('获取优惠券数量统计失败')
  }
}

// 分享图URL
const shareImageUrl = ref('')

// 格式化有效期时间
const formatValidTime = () => {
  if (
    props.couponData?.couponValidDays &&
    props.couponData.couponValidDays > 0
  ) {
    return `领取后${props.couponData.couponValidDays}天内使用`
  }
  if (props.couponData?.validStartTime && props.couponData?.validEndTime) {
    const startTime = props.couponData.validStartTime.replace(/-/g, '.')
    const endTime = props.couponData.validEndTime.replace(/-/g, '.')
    return `${startTime}-${endTime}`
  }
  return props.couponData?.validStartTime || ''
}

// 获取分享图配置
const shareImageConfig = computed(() => {
  if (!props.couponData) return null
  console.log(props.couponData, 'props.couponData')
  return {
    couponId: props.couponData.id,
    couponName: props.couponData.name,
    amount: props.couponData.discountAmount.toString(),
    limitPerUser: props.couponData.limitPerUser,
    threshold:
      props.couponData.minAmount === 0
        ? '无门槛使用'
        : `满${props.couponData.minAmount}可用`,
    validTime: formatValidTime(),
    miniProgramName: '洋葱星球研学家长服务',
  }
})

// 生成分享图
const generateShareImage = async () => {
  if (!props.couponData || props.couponData.pushType !== 'private') {
    return
  }

  try {
    const element = shareImageComponentRef.value?.shareImageRef
    if (!element) {
      console.error('分享图DOM元素未找到')
      return
    }

    const dataURL = await generateCouponShareImage(element)
    shareImageUrl.value = dataURL
  } catch (error) {
    console.error('生成分享图失败:', error)
    ElMessage.error('生成分享图失败')
  }
}

// 监听优惠券数据变化，重新生成分享图和加载统计数据
watch(
  () => props.couponData,
  async () => {
    if (props.couponData) {
      // 加载数量统计
      loadQuantitySummary()

      // 生成分享图
      if (props.couponData.pushType === 'private') {
        // 等待DOM更新和图片加载
        await nextTick()
        setTimeout(() => {
          generateShareImage()
        }, 500) // 给图片加载留出时间
      } else {
        shareImageUrl.value = ''
      }
    }
  },
  { immediate: true },
)

// 使用时间类型和相关数据
const useTimeType = computed(() => {
  if (!props.couponData) return '绝对时间'
  // 根据使用时间格式判断类型
  if (
    props.couponData.couponValidDays &&
    props.couponData.couponValidDays > 0
  ) {
    return '领取后几天内使用'
  }
  return '绝对时间'
})

const validTimeRange = computed(() => {
  if (!props.couponData || useTimeType.value !== '绝对时间') return null
  return [props.couponData.validStartTime, props.couponData.validEndTime]
})

const couponValidDays = computed(() => {
  if (!props.couponData || useTimeType.value !== '领取后几天内使用') return ''
  return props.couponData.couponValidDays?.toString() || ''
})

// 领取时间类型和相关数据
const receiveTimeType = computed(() => {
  if (!props.couponData) return '不限时'
  return props.couponData.claimStartTime ? '限时' : '不限时'
})

const claimTimeRange = computed(() => {
  if (!props.couponData || receiveTimeType.value !== '限时') return null
  return [props.couponData.claimStartTime, props.couponData.claimEndTime]
})

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
 * 处理查看适用商品
 */
const handleViewGoods = () => {
  console.log('查看适用商品，优惠券数据:', props.couponData)
  console.log('适用商品信息:', props.couponData?.adaptGoodInfo)
  goodsDialogVisible.value = true
}

/**
 * 处理图片加载错误
 */
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  // 设置默认图片
  img.src = '/default-share-image.png'
}

/**
 * 切换预览显示
 */
const togglePreview = () => {
  showPreview.value = !showPreview.value
}

/**
 * 处理关闭预览（通过蒙层点击）
 */
const handleClosePreview = () => {
  showPreview.value = false
}

/**
 * 处理下载分享图
 */
const handleDownloadImage = async () => {
  if (!props.couponData) return

  try {
    downloadLoading.value = true

    const element = shareImageComponentRef.value?.shareImageRef
    if (!element) {
      ElMessage.error('分享图DOM元素未找到')
      return
    }

    const filename = `${props.couponData.name}-分享图.png`
    await downloadCouponShareImage(element, filename)
    ElMessage.success('分享图下载成功')
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败，请稍后重试')
  } finally {
    downloadLoading.value = false
  }
}

/**
 * 处理对话框关闭
 */
const handleClose = () => {
  dialogVisible.value = false
  showPreview.value = false // 重置预览状态
}
</script>

<style lang="scss" scoped>
.coupon-detail-container {
  padding: 0;
}

// 统计区域
.stats-section {
  border: 1px solid #e4e7ed;
  margin-bottom: 20px;

  .stats-row {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    border-bottom: 1px solid #e4e7ed;

    &.values {
      border-bottom: none;
    }

    .stats-label,
    .stats-value {
      flex: 1;
      text-align: center;
      padding: 8px;
    }

    .stats-label {
      font-weight: 500;
      color: #606266;
    }

    .stats-value {
      font-weight: 600;
      font-size: 16px;
      color: #303133;
    }
  }
}

// 表单区域
.coupon-detail-form {
  margin-bottom: 20px;
  .view-goods-btn {
    margin-left: 16px;
  }

  .threshold-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}

// 分享图区域
.share-section {
  padding: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  display: flex;
  gap: 20px;
  align-items: center;

  .share-preview {
    width: 180px;
    height: 320px;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
    background: #fafbfc;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }

  .share-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    .download-btn {
      margin-left: 0;
    }
  }
}

// 对话框底部
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
