<template>
  <div class="channel-list-container">
    <div class="page-header">
      <div class="left-area">
        <el-page-header @back="goBack">
          <template #content>
            <div class="title">
              {{ platformGoodName }}
            </div>
          </template>
        </el-page-header>
      </div>
      <div class="right-area">
        <el-button type="primary" @click="handleAddChannel"
          >新增渠道商品</el-button
        >
      </div>
    </div>

    <CommonTable
      ref="tableRef"
      :fetch-data="fetchData"
      :search-form="searchForm"
      :show-search="false"
    >
      <el-table-column label="商品ID" prop="id" width="100" align="center" />
      <el-table-column label="渠道" prop="channel" width="120" align="center" />
      <el-table-column
        label="渠道商品ID"
        prop="channelGoodId"
        width="120"
        align="center"
      >
        <template #default="scope">
          <span v-if="scope.row.channel !== '小程序'">
            {{ scope.row.channelGoodId }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="主图" align="center">
        <template #default="scope">
          <el-image
            v-for="(img, idx) in scope.row.mainImage"
            :key="idx"
            style="width: 80px; height: 80px"
            :src="img"
            fit="cover"
            :preview-src-list="scope.row.mainImage"
            :preview-teleported="true"
          />
        </template>
      </el-table-column>
      <el-table-column label="详情图" align="center">
        <template #default="scope">
          <el-image
            v-for="(img, idx) in scope.row.detailImages"
            :key="idx"
            style="width: 80px; height: 80px"
            :src="img"
            fit="cover"
            :preview-src-list="scope.row.detailImages"
            :preview-teleported="true"
          />
        </template>
      </el-table-column>
      <el-table-column label="售价" prop="price" width="100" align="center">
        <template #default="scope">
          {{ formatPrice(scope.row.price) }}
        </template>
      </el-table-column>
      <el-table-column
        label="商品内容"
        width="200"
        align="center"
        show-overflow-tooltip
      >
        <template #default="scope">
          <div v-if="scope.row.content?.goodCategories?.length">
            <div
              v-for="(category, index) in scope.row.content.goodCategories"
              :key="index"
              class="category-item"
            >
              <div>{{ category.categoryName }}:</div>
              <span
                v-for="(course, courseIndex) in category.courses"
                :key="courseIndex"
                class="course-name"
                :class="{ 'first-course': courseIndex === 0 }"
              >
                {{ course.courseName }};
              </span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        label="是否推送预约信息"
        prop="isPushAppointmentInfo"
        width="150"
        align="center"
      >
        <template #default="scope">
          <el-tag :type="scope.row.isPushAppointmentInfo ? 'success' : 'info'">
            {{ scope.row.isPushAppointmentInfo ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="销量" prop="sales" width="80" align="center" />
      <el-table-column
        label="创建时间"
        prop="createdAt"
        width="180"
        align="center"
      >
        <template #default="scope">
          {{ formatDateTime(scope.row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column
        label="更新时间"
        prop="updatedAt"
        width="180"
        align="center"
      >
        <template #default="scope">
          {{ formatDateTime(scope.row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column
        label="最后编辑人"
        prop="updatedByName"
        width="100"
        align="center"
      />
      <el-table-column label="状态" prop="status" width="100" align="center">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">
            {{ getStatusText(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" align="center" width="200">
        <template #default="scope">
          <el-button type="primary" link @click="handleEdit(scope.row)"
            >编辑</el-button
          >
          <!-- 复制 -->
          <el-button type="primary" link @click="handleCopy(scope.row)"
            >复制</el-button
          >
          <el-button
            v-if="
              scope.row.status === 'putOff' || scope.row.status === 'pending'
            "
            type="primary"
            link
            @click="handleChangeStatus(scope.row, 'putOn')"
            >上架</el-button
          >
          <el-button
            v-if="scope.row.status === 'putOn'"
            type="primary"
            link
            @click="handleChangeStatus(scope.row, 'putOff')"
            >下架</el-button
          >
        </template>
      </el-table-column>
    </CommonTable>

    <!-- 渠道商品弹窗 -->
    <GoodDialog
      v-model="dialogVisible"
      :platform-good-id="platformGoodId"
      :good-type="platformGoodType"
      :title="dialogTitle"
      :type="dialogType"
      :data="currentGood"
      @success="handleDialogSuccess"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import GoodDialog from './components/GoodDialog.vue'
import { getGoodList, updateGoodStatus } from './service'
import type { GoodInfo } from './service.type'
import { formatDateTime } from '@/utils/date'

const route = useRoute()
const router = useRouter()
const tableRef = ref()

// 获取平台商品ID、名称和类型
const platformGoodId = computed(() => route.params.id as string)
const platformGoodName = computed(
  () => (route.query.name as string) || '商品渠道列表',
)
const platformGoodType = computed(
  () => (route.query.goodType as 'single' | 'multi' | 'deposit') || 'single',
)

// 搜索表单
const searchForm = reactive({
  platformGoodId: computed(() => platformGoodId.value),
})

// 渠道商品表格数据
const fetchData = async (params: any) => {
  try {
    const res = await getGoodList({
      page: params.page,
      pageSize: params.pageSize,
      platformGoodId: params.platformGoodId,
    })
    return {
      list: res.list || [],
      total: res.total || 0,
    }
  } catch (error) {
    console.error('获取商品列表失败', error)
    ElMessage.error('获取商品列表失败')
    return {
      list: [],
      total: 0,
    }
  }
}

// 返回上一页
const goBack = () => {
  router.push('/good/list')
}

// 弹窗相关
const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogType = ref<'add' | 'edit' | 'copy'>('add')
const currentGood = ref<GoodInfo | null>(null)

// 新增渠道商品
const handleAddChannel = () => {
  dialogTitle.value = '新增渠道商品'
  dialogType.value = 'add'
  currentGood.value = null
  dialogVisible.value = true
}

// 编辑渠道商品
const handleEdit = (row: GoodInfo) => {
  dialogTitle.value = '编辑渠道商品'
  dialogType.value = 'edit'
  currentGood.value = row
  dialogVisible.value = true
}

// 弹窗操作成功回调
const handleDialogSuccess = () => {
  dialogVisible.value = false
  tableRef.value?.refresh()
}

// 修改渠道商品状态
const handleChangeStatus = async (row: GoodInfo, status: string) => {
  const statusText = getStatusText(status)
  try {
    await ElMessageBox.confirm(
      `确定要将${row.channel}渠道商品"${row.name}"${statusText.slice(
        1,
        3,
      )}吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    const res = await updateGoodStatus({
      id: row.id,
      status,
    })

    if (res.isSucceed) {
      ElMessage.success(`${statusText}成功`)
      tableRef.value?.refresh()
    } else {
      ElMessage.error(`${statusText}失败`)
    }
  } catch (error) {
    console.log('操作取消')
  }
}

// 复制渠道商品
const handleCopy = (row: GoodInfo) => {
  dialogTitle.value = '复制渠道商品'
  dialogType.value = 'copy'
  currentGood.value = { ...row, id: '' }
  dialogVisible.value = true
}

// 格式化价格
const formatPrice = (price: number) => {
  return `¥${price.toFixed(2)}`
}

// 获取状态类型
const getStatusType = (status: string) => {
  const statusMap: Record<string, string> = {
    putOn: 'success',
    putOff: 'info',
    pending: 'warning',
    delete: 'danger',
  }
  return statusMap[status] || ''
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    putOn: '已上架',
    putOff: '已下架',
    pending: '待上架',
    delete: '已删除',
  }
  return statusMap[status] || ''
}
</script>

<style lang="scss" scoped>
.channel-list-container {
  padding: 20px;
  // height: 100%;
  display: flex;
  flex-direction: column;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .title {
      text-align: center;
      font-size: 20px;
      font-weight: bold;
    }
  }

  .category-item {
    margin-bottom: 5px;
    font-size: 12px;
    text-align: left;

    .course-name {
      margin-right: 5px;
    }

    .first-course {
      margin-left: 10px;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
<style>
.el-popper.is-dark {
  width: 240px;
  /* 设置提示信息的宽度 */
}
</style>
