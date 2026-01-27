<template>
    <el-dialog :title="`配置推荐商品-${categoryName}`" v-model="dialogVisible" width="1200px" @close="handleClose"
        :close-on-click-modal="false">
        <div class="config-goods-container">
            <!-- 左侧：已配置商品 -->
            <div class="configured-goods">
                <div class="section-header">
                    <h3>已配置商品 ({{ selectedGoods.length }})</h3>
                    <span class="homepage-display-count">首页展示（{{ homepageDisplayCount }}）</span>
                </div>
                <div class="goods-list configured-list">
                    <div v-for="item in selectedGoods" :key="item.id" class="goods-item configured-item">
                        <div class="goods-content">
                            <div class="goods-image">
                                <el-image :src="item.imageUrl || '/default-product.png'" fit="cover"
                                    style="width: 60px; height: 60px; border-radius: 4px;">
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
                        <div class="goods-actions">
                            <el-checkbox v-model="item.isShowInHomepage" @change="handleHomepageChange(item)"
                                :disabled="!item.isShowInHomepage && homepageDisplayCount >= 8"
                                class="homepage-checkbox" />
                            <div class="sort-buttons">
                                <el-button type="text" size="small"
                                    @click="handleMoveUp(item, selectedGoods.indexOf(item))"
                                    :disabled="selectedGoods.indexOf(item) === 0" title="上移">
                                    <el-icon>
                                        <ArrowUp />
                                    </el-icon>
                                </el-button>
                                <el-button type="text" size="small"
                                    @click="handleMoveDown(item, selectedGoods.indexOf(item))"
                                    :disabled="selectedGoods.indexOf(item) === selectedGoods.length - 1" title="下移">
                                    <el-icon>
                                        <ArrowDown />
                                    </el-icon>
                                </el-button>
                            </div>
                            <el-button type="text" size="small" @click="handleRemoveGoods(item)" style="color: #f56565;"
                                title="删除">
                                <el-icon>
                                    <Delete />
                                </el-icon>
                            </el-button>
                        </div>
                    </div>
                    <div v-if="selectedGoods.length === 0" class="empty-state">
                        <el-empty description="暂无已配置商品" :image-size="60" />
                    </div>
                </div>
            </div>

            <!-- 右侧：可选商品 -->
            <div class="available-goods">
                <div class="section-header">
                    <h3>可选商品</h3>
                    <div class="search-box">
                        <el-input v-model="searchKeyword" placeholder="搜索商品..." clearable @input="handleSearch"
                            @clear="handleSearchClear" prefix-icon="Search" style="width: 200px;" />
                    </div>
                </div>
                <div class="goods-list available-list" v-loading="goodsLoading">
                    <div v-for="item in filteredAvailableGoods" :key="item.id" class="goods-item available-item"
                        :class="{ disabled: isGoodsSelected(item.id) }">
                        <div class="goods-content">
                            <div class="goods-image">
                                <el-image :src="item.imageUrl || '/default-product.png'" fit="cover"
                                    style="width: 60px; height: 60px; border-radius: 4px;">
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
                        <div class="goods-actions">
                            <el-button type="primary" size="small" circle @click="handleAddGoods(item)"
                                :disabled="isGoodsSelected(item.id)">
                                <el-icon>
                                    <Plus />
                                </el-icon>
                            </el-button>
                        </div>
                    </div>
                    <div v-if="filteredAvailableGoods.length === 0 && !goodsLoading" class="empty-state">
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
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="handleSubmit" :loading="loading">保存</el-button>
                </div>
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Picture, Plus, Delete, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import { configureGoods } from '../../service'
import { getGoodList, batchGetGoods, processGoodListData, processSelectedGoodsData, getRecommendationCategoryInfo, processRecommendationCategoryInfo, buildConfigureGoodsParams } from './service'
import { GoodItem } from './service.type'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    categoryData: {
        type: Object,
        default: undefined
    }
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const goodsLoading = ref(false)
const categoryName = ref('')
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
    return allAvailableGoods.value.filter(item =>
        item.name.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword)
    )
})

// 统计首页展示的商品数量
const homepageDisplayCount = computed(() => {
    return selectedGoods.value.filter(item => item.isShowInHomepage).length
})

watch(() => props.visible, (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.categoryData) {
        categoryName.value = props.categoryData.name
        // 加载当前分类已关联的商品
        loadSelectedGoods()
        // 初始化商品数据
        initGoodsData()
    }
})

watch(() => dialogVisible.value, (newVal) => {
    emit('update:visible', newVal)
})

/**
 * 加载已选中的商品
 */
const loadSelectedGoods = async () => {
    if (props.categoryData && props.categoryData.id) {
        try {
            // 获取推荐分类详情，包含已配置的商品信息
            const response = await getRecommendationCategoryInfo(props.categoryData.id);

            // 处理推荐分类详情数据，转换为已选商品列表
            selectedGoods.value = processRecommendationCategoryInfo(response);
        } catch (error) {
            console.error('加载已选商品失败:', error);
            ElMessage.error('加载已选商品失败');
            selectedGoods.value = [];
        }
    } else {
        selectedGoods.value = [];
    }
}

/**
 * 检查商品是否已选中
 */
const isGoodsSelected = (goodsId: string): boolean => {
    return selectedGoods.value.some(item => item.id === goodsId)
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
        isShowInHomepage: false // 默认不在首页展示
    })

    ElMessage.success(`已添加商品：${goods.name}`)
}

/**
 * 处理首页展示状态变化
 */
const handleHomepageChange = (goods: GoodItem) => {
    // 如果当前是勾选操作，且已经选择了8个，则阻止勾选
    if (goods.isShowInHomepage) {
        const currentCount = selectedGoods.value.filter(item => item.isShowInHomepage).length
        if (currentCount > 8) {
            // 如果超过8个，取消当前选择
            goods.isShowInHomepage = false
            ElMessage.warning('最多只能选择8个商品在首页展示')
            return
        }
    }
}

/**
 * 移除商品
 */
const handleRemoveGoods = async (goods: GoodItem) => {
    try {
        await ElMessageBox.confirm(
            `确定要移除商品“${goods.name}”吗？`,
            '移除确认',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }
        )

        const index = selectedGoods.value.findIndex(item => item.id === goods.id)
        if (index > -1) {
            selectedGoods.value.splice(index, 1)
            ElMessage.success('移除成功')
        }
    } catch {
        // 用户取消操作
    }
}

/**
 * 展开/折叠商品
 */
const handleExpandGoods = (goods: GoodItem) => {
    goods.expanded = !goods.expanded
}

/**
 * 上移商品
 */
const handleMoveUp = (goods: GoodItem, currentIndex: number) => {
    if (currentIndex <= 0) {
        ElMessage.warning('已经是第一个商品，无法上移')
        return
    }

    // 交换位置
    const temp = selectedGoods.value[currentIndex]
    selectedGoods.value[currentIndex] = selectedGoods.value[currentIndex - 1]
    selectedGoods.value[currentIndex - 1] = temp

    ElMessage.success(`商品“${goods.name}”已上移`)
}

/**
 * 下移商品
 */
const handleMoveDown = (goods: GoodItem, currentIndex: number) => {
    if (currentIndex >= selectedGoods.value.length - 1) {
        ElMessage.warning('已经是最后一个商品，无法下移')
        return
    }

    // 交换位置
    const temp = selectedGoods.value[currentIndex]
    selectedGoods.value[currentIndex] = selectedGoods.value[currentIndex + 1]
    selectedGoods.value[currentIndex + 1] = temp

    ElMessage.success(`商品“${goods.name}”已下移`)
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
            channelName: "小程序"
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
    categoryName.value = ''
    searchKeyword.value = ''
}

const handleSubmit = async () => {
    if (!props.categoryData) return

    try {
        loading.value = true

        // 构造商品配置参数
        const params = buildConfigureGoodsParams(props.categoryData, selectedGoods.value)

        await configureGoods(params)

        ElMessage.success('商品配置成功')
        dialogVisible.value = false
        emit('success')
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

<style scoped>
.config-goods-container {
    display: flex;
    gap: 20px;
    height: 600px;
    min-height: 500px;
}

.configured-goods,
.available-goods {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    /* 防止flex子元素溢出 */
}

/* 左侧已配置商品区域 */
.configured-goods {
    background-color: #fafbfc;
    border-radius: 8px;
    padding: 16px;
    border: 1px solid #e4e7ed;
}

/* 右侧可选商品区域 */
.available-goods {
    background-color: #ffffff;
    border-radius: 8px;
    padding: 16px;
    border: 1px solid #e4e7ed;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e4e7ed;
}

.section-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
}

.configured-goods .section-header h3 {
    color: #409eff;
}

.available-goods .section-header h3 {
    color: #67c23a;
}

.search-box {
    display: flex;
    align-items: center;
}

.goods-list {
    flex: 1;
    overflow-y: auto;
    border-radius: 6px;
    background-color: #ffffff;
    max-height: 480px;
}

.configured-list {
    background-color: #ffffff;
    border: 1px solid #dcdfe6;
}

.available-list {
    background-color: #ffffff;
    border: 1px solid #dcdfe6;
}

.goods-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    transition: all 0.2s ease;
    cursor: pointer;
}

.goods-item:last-child {
    border-bottom: none;
}

.goods-item:hover {
    background-color: #f5f7fa;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.configured-item {
    background-color: #ffffff;
    border-left: 3px solid #409eff;
}

.configured-item:hover {
    background-color: #ecf5ff;
    border-left-color: #66b1ff;
}

.available-item {
    border-left: 3px solid transparent;
}

.available-item:hover {
    background-color: #f0f9ff;
    border-left-color: #67c23a;
}

.available-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: #f5f5f5;
}

.available-item.disabled:hover {
    background-color: #f5f5f5;
    transform: none;
    box-shadow: none;
    border-left-color: transparent;
}

.goods-content {
    display: flex;
    align-items: center;
    flex: 1;
    gap: 12px;
    min-width: 0;
}

.homepage-checkbox {
    margin-right: 8px;
    flex-shrink: 0;
}

.homepage-display-count {
    font-size: 14px;
    color: #606266;
    font-weight: 500;
}

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
}

.image-error {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c0c4cc;
    font-size: 20px;
}

.goods-info {
    flex: 1;
    min-width: 0;
}

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

.goods-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 12px;
    flex-shrink: 0;
}

.sort-buttons {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.sort-buttons .el-button {
    margin-left: 0;
    padding: 2px 4px;
    min-height: auto;
    height: 18px;
    width: 20px;
    font-size: 12px;
}

.sort-buttons .el-button:hover:not(.is-disabled) {
    background-color: #409eff;
    color: white;
}

.sort-buttons .el-button.is-disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #909399;
}

.dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-top: 1px solid #e4e7ed;
    margin-top: 16px;
}

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

/* 响应式设计 */
@media (max-width: 1200px) {
    .config-goods-container {
        gap: 16px;
    }
}

@media (max-width: 1024px) {
    .config-goods-container {
        flex-direction: column;
        height: auto;
        gap: 16px;
    }

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
    }

    .search-box .el-input {
        width: 100% !important;
    }

    .goods-item {
        padding: 10px 12px;
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

/* 滚动条样式 */
.goods-list::-webkit-scrollbar {
    width: 6px;
}

.goods-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

.goods-list::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
    transition: background 0.2s;
}

.goods-list::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
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