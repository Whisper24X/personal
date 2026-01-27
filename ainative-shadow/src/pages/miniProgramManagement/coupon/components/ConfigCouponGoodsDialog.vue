<template>
  <el-dialog
    :title="
      props.readonly
        ? `查看适用商品-${couponName}`
        : `配置优惠券适用商品-${couponName}`
    "
    v-model="dialogVisible"
    width="1200px"
    @close="handleClose"
    :close-on-click-modal="false"
  >
    <div class="config-goods-container">
      <!-- 左侧：已配置商品 -->
      <div class="configured-goods">
        <div class="section-header">
          <h3>适用商品 ({{ selectedGoods.length }})</h3>
          <div v-if="!props.readonly" class="header-actions">
            <el-button
              type="danger"
              size="small"
              @click="handleClearAll"
              :disabled="selectedGoods.length === 0"
            >
              全部清除
            </el-button>
          </div>
        </div>
        <div class="goods-list configured-list">
          <div
            v-for="item in selectedGoods"
            :key="item.id"
            class="goods-item configured-item"
          >
            <div class="goods-content">
              <div class="goods-image">
                <el-image
                  :src="item.imageUrl || '/default-product.png'"
                  fit="cover"
                  style="width: 60px; height: 60px; border-radius: 4px"
                >
                  <template #error>
                    <div class="image-error">
                      <el-icon>
                        <Picture />
                      </el-icon>
                    </div>
                  </template>
                </el-image>
              </div>
              <div class="goods-info">
                <div class="goods-name">{{ item.name }}</div>
                <div class="goods-price">¥{{ item.price }}</div>
              </div>
            </div>
            <div v-if="!props.readonly" class="goods-actions">
              <el-button
                type="text"
                size="small"
                @click="handleRemoveGoods(item)"
                style="color: #f56565"
                title="删除"
              >
                <el-icon>
                  <Delete />
                </el-icon>
              </el-button>
            </div>
          </div>
          <div v-if="selectedGoods.length === 0" class="empty-state">
            <el-empty description="暂无适用商品" :image-size="60" />
          </div>
        </div>
      </div>

      <!-- 右侧：可选商品 -->
      <div class="available-goods">
        <div class="section-header">
          <h3>可选商品</h3>
          <div class="search-box">
            <el-button
              v-if="!props.readonly"
              type="success"
              size="small"
              @click="handleAddAll"
              :disabled="availableGoodsForAdd.length === 0"
              style="margin-right: 12px"
            >
              全部添加
            </el-button>
            <el-input
              v-model="searchKeyword"
              placeholder="搜索商品..."
              clearable
              @input="handleSearch"
              @clear="handleSearchClear"
              prefix-icon="Search"
              style="width: 200px"
            />
          </div>
        </div>
        <div class="goods-list available-list" v-loading="goodsLoading">
          <div
            v-for="item in filteredAvailableGoods"
            :key="item.id"
            class="goods-item available-item"
            :class="{ disabled: isGoodsSelected(item.id) }"
          >
            <div class="goods-content">
              <div class="goods-image">
                <el-image
                  :src="item.imageUrl || '/default-product.png'"
                  fit="cover"
                  style="width: 60px; height: 60px; border-radius: 4px"
                >
                  <template #error>
                    <div class="image-error">
                      <el-icon>
                        <Picture />
                      </el-icon>
                    </div>
                  </template>
                </el-image>
              </div>
              <div class="goods-info">
                <div class="goods-name">{{ item.name }}</div>
                <div class="goods-price">¥{{ item.price }}</div>
              </div>
            </div>
            <div v-if="!props.readonly" class="goods-actions">
              <el-button
                type="primary"
                size="small"
                circle
                @click="handleAddGoods(item)"
                :disabled="isGoodsSelected(item.id)"
              >
                <el-icon>
                  <Plus />
                </el-icon>
              </el-button>
            </div>
          </div>
          <div
            v-if="filteredAvailableGoods.length === 0 && !goodsLoading"
            class="empty-state"
          >
            <el-empty description="暂无可选商品" :image-size="60" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="goods-total">
          商品总数：{{ filteredAvailableGoods.length }}
        </div>
        <div class="footer-buttons">
          <el-button @click="dialogVisible = false">
            {{ props.readonly ? '关闭' : '取消' }}
          </el-button>
          <el-button
            v-if="!props.readonly"
            type="primary"
            @click="handleSubmit"
            :loading="loading"
          >
            保存
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  defineProps,
  defineEmits,
  watch,
  computed,
  onMounted,
} from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Picture, Plus, Delete } from '@element-plus/icons-vue'
// 复用推荐管理的商品服务
import {
  getGoodList,
  processGoodListData,
} from '../../recommendation/components/ConfigGoodsDialog/service'
import { GoodItem } from '../../recommendation/components/ConfigGoodsDialog/service.type'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  couponData: {
    type: Object,
    default: undefined,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const goodsLoading = ref(false)
const couponName = ref('')
const searchKeyword = ref('')

// 已选中的商品
const selectedGoods = ref<GoodItem[]>([])

// 所有可选商品数据
const allAvailableGoods = ref<GoodItem[]>([])

// 筛选后的可选商品
const filteredAvailableGoods = computed(() => {
  if (!searchKeyword.value.trim()) {
    return allAvailableGoods.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return allAvailableGoods.value.filter(
    (item) =>
      item.name.toLowerCase().includes(keyword) ||
      item.category?.toLowerCase().includes(keyword) ||
      item.description?.toLowerCase().includes(keyword),
  )
})

// 可添加的商品（排除已选择的）
const availableGoodsForAdd = computed(() => {
  return filteredAvailableGoods.value.filter(
    (item) => !isGoodsSelected(item.id),
  )
})

watch(
  () => props.visible,
  async (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.couponData) {
      couponName.value = props.couponData.name || '未命名优惠券'
      // 先初始化商品数据，再加载已选商品
      await initGoodsData()
      loadSelectedGoods()
    }
  },
)

watch(
  () => dialogVisible.value,
  (newVal) => {
    emit('update:visible', newVal)
  },
)

/**
 * 加载已选中的商品
 */
const loadSelectedGoods = async () => {
  if (props.couponData && props.couponData.id) {
    try {
      // 如果优惠券数据中有适用商品信息，直接使用
      if (
        props.couponData?.adaptGoodInfo &&
        props.couponData.adaptGoodInfo.length > 0
      ) {
        console.log('从优惠券数据加载适用商品:', props.couponData.adaptGoodInfo)
        console.log('所有可选商品:', allAvailableGoods.value)
        // 从所有可选商品中找到匹配的商品
        const matchedGoods = allAvailableGoods.value.filter((goods) =>
          props.couponData!.adaptGoodInfo.includes(goods.id),
        )
        console.log('匹配到的商品:', matchedGoods)
        selectedGoods.value = matchedGoods.map((item) => ({
          ...item,
          expanded: false,
        }))
        console.log('已选商品:', selectedGoods.value)
      } else {
        console.log('优惠券数据中没有适用商品信息')
        selectedGoods.value = []
      }
    } catch (error) {
      console.error('加载已选商品失败:', error)
      ElMessage.error('加载已选商品失败')
      selectedGoods.value = []
    }
  } else {
    selectedGoods.value = []
  }
}

/**
 * 检查商品是否已选中
 */
const isGoodsSelected = (goodsId: string): boolean => {
  return selectedGoods.value.some((item) => item.id === goodsId)
}

/**
 * 添加商品
 */
const handleAddGoods = (goods: GoodItem) => {
  if (isGoodsSelected(goods.id)) {
    ElMessage.warning('该商品已经被选中')
    return
  }

  selectedGoods.value.push({
    ...goods,
    expanded: false,
  })

  ElMessage.success(`已添加商品：${goods.name}`)
}

/**
 * 移除商品
 */
const handleRemoveGoods = async (goods: GoodItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要移除商品"${goods.name}"吗？`,
      '移除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    const index = selectedGoods.value.findIndex((item) => item.id === goods.id)
    if (index > -1) {
      selectedGoods.value.splice(index, 1)
      ElMessage.success('移除成功')
    }
  } catch {
    // 用户取消操作
  }
}

/**
 * 全部添加
 */
const handleAddAll = async () => {
  const availableCount = availableGoodsForAdd.value.length

  if (availableCount === 0) {
    ElMessage.warning('没有可添加的商品')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要添加所有 ${availableCount} 个商品吗？`,
      '批量添加确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info',
      },
    )

    // 添加所有可用商品
    const newGoods = availableGoodsForAdd.value.map((item) => ({
      ...item,
      expanded: false,
    }))

    selectedGoods.value.push(...newGoods)
    ElMessage.success(`已添加 ${availableCount} 个商品`)
  } catch {
    // 用户取消操作
  }
}

/**
 * 全部清除
 */
const handleClearAll = async () => {
  if (selectedGoods.value.length === 0) {
    ElMessage.warning('没有已选择的商品')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要清除所有 ${selectedGoods.value.length} 个已选商品吗？`,
      '批量清除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    selectedGoods.value = []
    ElMessage.success('已清除所有商品')
  } catch {
    // 用户取消操作
  }
}

/**
 * 搜索商品
 */
const handleSearch = () => {
  // 搜索逻辑已在 computed 中实现
  console.log(`搜索关键词: ${searchKeyword.value}`)
}

/**
 * 清空搜索
 */
const handleSearchClear = () => {
  searchKeyword.value = ''
}

/**
 * 初始化商品数据
 */
const initGoodsData = async () => {
  try {
    goodsLoading.value = true

    // 调用API获取商品列表
    const response = await getGoodList({
      page: 1,
      pageSize: 100, // 获取足够多的商品数据
      channelName: '小程序',
    })

    // 处理商品列表数据
    allAvailableGoods.value = processGoodListData(response)

    console.log('商品数据初始化完成')
  } catch (error) {
    console.error('初始化商品数据失败:', error)
    ElMessage.error('加载商品数据失败')
  } finally {
    goodsLoading.value = false
  }
}

const handleClose = () => {
  selectedGoods.value = []
  couponName.value = ''
  searchKeyword.value = ''
}

const handleSubmit = async () => {
  if (!props.couponData) return

  try {
    loading.value = true

    // 这里应该调用保存优惠券适用商品的接口
    // 目前只是模拟保存
    console.log('保存优惠券适用商品:', {
      couponId: props.couponData.id,
      goodsIds: selectedGoods.value.map((item) => item.id),
    })

    ElMessage.success('商品配置成功')
    dialogVisible.value = false
    // 传递选中的商品数据给父组件
    emit('success', selectedGoods.value)
  } catch (error) {
    console.error('配置商品失败:', error)
    ElMessage.error('配置商品失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 组件加载时初始化数据
onMounted(() => {
  initGoodsData()
})
</script>

<style lang="scss" scoped>
.config-goods-container {
  display: flex;
  gap: 20px;
  height: 600px;
  min-height: 500px;

  // 响应式设计
  @media (max-width: 1200px) {
    gap: 16px;
  }

  @media (max-width: 1024px) {
    flex-direction: column;
    height: auto;
    gap: 16px;

    .configured-goods,
    .available-goods {
      height: 300px;
      padding: 12px;
    }

    .goods-list {
      max-height: 240px;
    }
  }

  @media (max-width: 768px) {
    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .search-box {
      width: 100%;
      flex-direction: column;
      gap: 8px;

      .el-input {
        width: 100% !important;
      }
    }

    .goods-item {
      padding: 8px 12px;
    }

    .goods-image {
      width: 50px;
      height: 50px;
    }

    .goods-name {
      font-size: 13px;
    }

    .goods-price {
      font-size: 14px;
    }
  }
}

// 已配置商品区域
.configured-goods {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: #fafbfc;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e4e7ed;

  .section-header h3 {
    color: #409eff;
  }
}

// 可选商品区域
.available-goods {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e4e7ed;

  .section-header h3 {
    color: #67c23a;
  }
}

// 区域标题
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e4e7ed;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

// 搜索框
.search-box {
  display: flex;
  align-items: center;
}

// 商品列表
.goods-list {
  flex: 1;
  overflow-y: auto;
  border-radius: 6px;
  background-color: #ffffff;
  max-height: 480px;
  border: 1px solid #dcdfe6;

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
}

// 商品项
.goods-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.2s ease;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: #f5f7fa;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
}

// 已配置商品项
.configured-item {
  background-color: #ffffff;
  border-left: 3px solid #409eff;

  &:hover {
    background-color: #ecf5ff;
    border-left-color: #66b1ff;
  }
}

// 可选商品项
.available-item {
  border-left: 3px solid transparent;

  &:hover {
    background-color: #f0f9ff;
    border-left-color: #67c23a;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: #f5f5f5;

    &:hover {
      background-color: #f5f5f5;
      transform: none;
      box-shadow: none;
      border-left-color: transparent;
    }
  }
}

// 商品内容
.goods-content {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 12px;
  min-width: 0;
}

// 商品图片
.goods-image {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e4e7ed;
  flex-shrink: 0;

  .image-error {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c0c4cc;
    font-size: 20px;
  }
}

// 商品信息
.goods-info {
  flex: 1;
  min-width: 0;

  .goods-name {
    font-size: 14px;
    color: #303133;
    margin-bottom: 6px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }

  .goods-price {
    font-size: 16px;
    color: #e6a23c;
    font-weight: 600;
  }
}

// 商品操作按钮
.goods-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  flex-shrink: 0;
}

// 空状态
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #909399;
}

// 对话框底部
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-top: 1px solid #e4e7ed;
  margin-top: 16px;

  .goods-total {
    font-size: 14px;
    color: #606266;
    font-weight: 500;
    padding: 8px 16px;
    background-color: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
  }

  .footer-buttons {
    display: flex;
    gap: 12px;
  }
}

/* 按钮样式调整 */
:deep(.el-button.is-circle) {
  width: 28px;
  height: 28px;
  transition: all 0.2s ease;
}

:deep(.el-button--small.is-circle) {
  width: 24px;
  height: 24px;
}

:deep(.el-button.is-circle:hover) {
  transform: scale(1.1);
}

/* 加载状态样式 */
:deep(.el-loading-mask) {
  border-radius: 6px;
}

/* 空状态样式 */
:deep(.el-empty) {
  padding: 20px;
}

:deep(.el-empty__description) {
  margin-top: 12px;
}
</style>
