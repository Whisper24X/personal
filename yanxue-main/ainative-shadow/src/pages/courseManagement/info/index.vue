<template>
  <div class="course-info">
    <CommonTable
      :fetch-data="getList"
      :search-form="queryParams"
      :default-search-form="defaultQueryParams"
      ref="tableRef"
      @selection-change="handleSelectionChange"
    >
      <!-- 搜索项 -->
      <template #search-items>
        <el-form-item label="课程名称">
          <el-input
            v-model="queryParams.courseName"
            :style="{ width: '200px' }"
            placeholder="请输入课程名称"
            clearable
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="queryParams.status"
            :style="{ width: '200px' }"
            placeholder="全部"
            clearable
          >
            <el-option
              v-for="item in COURSE_STATUS_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="课程类型">
          <el-select
            v-model="queryParams.courseType"
            :style="{ width: '200px' }"
            placeholder="全部"
            clearable
          >
            <el-option
              v-for="item in COURSE_TYPE_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </template>

      <!-- 操作按钮 -->
      <template #extra-buttons>
        <el-button type="primary" @click="handleAdd">新增</el-button>
        <el-button
          type="success"
          @click="handleBatchOnline"
          :disabled="!selectedRows.length"
          >批量上架</el-button
        >
        <el-button
          type="warning"
          @click="handleBatchOffline"
          :disabled="!selectedRows.length"
          >批量下架</el-button
        >
      </template>

      <!-- 表格列 -->
      <el-table-column type="selection" width="55" />
      <el-table-column
        type="index"
        label="课程编号"
        min-width="100"
        align="center"
      />
      <el-table-column
        prop="courseName"
        label="课程名称"
        min-width="150"
        align="center"
      />
      <el-table-column
        prop="courseType"
        label="课程类型"
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          <el-tag :type="row.courseType === 'single' ? 'success' : 'primary'">
            {{ row.courseType === 'single' ? '单日' : '多日' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="mainImage"
        label="主图"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-image
            v-for="(img, idx) in row.mainImage"
            :key="img"
            :src="img"
            preview-teleported
            :preview-src-list="row.mainImage"
            style="
              width: 40px;
              height: 40px;
              margin-right: 4px;
              border-radius: 4px;
            "
            fit="cover"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="detailImages"
        label="详情图"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-image
            v-for="(img, idx) in row.detailImages"
            :key="img"
            :src="img"
            style="
              width: 40px;
              height: 40px;
              margin-right: 4px;
              border-radius: 4px;
            "
            preview-teleported
            :preview-src-list="row.detailImages"
            fit="cover"
          />
        </template>
      </el-table-column>
      <el-table-column prop="price" label="价格" min-width="100" align="center">
        <template #default="{ row }"> {{ formatMoney(row.price) }} </template>
      </el-table-column>
      <el-table-column
        prop="createdAt"
        label="创建时间"
        min-width="150"
        align="center"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="updatedAt"
        label="更新时间"
        min-width="150"
        align="center"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="updatedByName"
        label="最后编辑人"
        min-width="100"
      />
      <el-table-column prop="status" label="状态" min-width="80" align="center">
        <template #default="{ row }">
          <el-tag
            :type="row.status === CourseStatus.ONLINE ? 'success' : 'info'"
          >
            {{ row.status === CourseStatus.ONLINE ? '上架' : '下架' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right" align="center">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleEdit(row)"
            >修改</el-button
          >
          <el-button type="primary" link @click="handleStatusChange(row)">
            {{ row.status === CourseStatus.ONLINE ? '下架' : '上架' }}
          </el-button>
          <!-- <el-button type="danger" link @click="handleDelete(row)"
            >删除</el-button
          > -->
        </template>
      </el-table-column>
    </CommonTable>

    <!-- 新增/编辑对话框 -->
    <CourseFormDialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :form-data="form"
      @submit="handleSubmit"
      @cancel="dialogVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommonTable from '@/components/CommonTable/index.vue'
import CourseFormDialog from './components/CourseFormDialog.vue'
import {
  getCourseList,
  getCourseInfo,
  createCourse,
  updateCourse,
  deleteCourse,
  updateCourseStatus,
} from './service'
import type {
  CourseInfo,
  CourseListQuery,
  CreateCourseRequest,
  UpdateCourseRequest,
} from './service.type'
import {
  CourseStatus,
  COURSE_STATUS_OPTIONS,
  COURSE_TYPE_OPTIONS,
} from './service.type'
import { formatDateTime } from '@/utils/date'
import { formatMoney, yuanToCents, centsToYuanNumber } from '@/utils/money'
import { useRouter } from 'vue-router'

const router = useRouter()
const queryParams = reactive<CourseListQuery>({
  page: 1,
  pageSize: 10,
  status: '',
  courseName: '',
  courseType: '',
})

const defaultQueryParams = reactive<CourseListQuery>({
  page: 1,
  pageSize: 10,
  status: '',
  courseName: '',
  courseType: '',
})

const tableRef = ref()
const dialogVisible = ref(false)
const dialogTitle = ref('')
const form = reactive<CreateCourseRequest>({
  courseName: '',
  courseType: 'single' as 'single' | 'multi',
  mainImage: [],
  detailImages: [],
  price: 0,
  isPushContractRequired: false,
})
const selectedRows = ref<CourseInfo[]>([])

const getList = async (params: CourseListQuery) => {
  const res = await getCourseList({
    ...params,
    page: params.page || 1,
    pageSize: params.pageSize || 10,
  })
  return {
    list: res.list,
    total: res.total,
  }
}

const handleQuery = () => {
  tableRef.value?.refresh()
}

const handleAdd = () => {
  dialogTitle.value = '新增课程'
  dialogVisible.value = true
  Object.assign(form, {
    courseName: '',
    courseType: 'single' as 'single' | 'multi',
    mainImage: [],
    detailImages: [],
    price: 0,
    isPushContractRequired: false,
  })
}

const handleEdit = async (row: CourseInfo) => {
  dialogTitle.value = '编辑课程'
  dialogVisible.value = true
  const res = await getCourseInfo(row.id)
  const courseInfo = res.info

  // 复制数据到表单
  Object.assign(form, {
    id: courseInfo.id,
    courseName: courseInfo.courseName,
    courseType: courseInfo.courseType, // 老数据默认为单日
    mainImage: courseInfo.mainImage,
    detailImages: courseInfo.detailImages,
    price: centsToYuanNumber(courseInfo.price), // 使用工具函数将分转换为元
    isPushContractRequired: courseInfo.isPushContractRequired ?? false, // 老数据默认为不需要推送合同
  })
}

const handleSubmit = async (
  formData: CreateCourseRequest | UpdateCourseRequest,
) => {
  try {
    // 使用工具函数将元转换为分
    const submitData = {
      ...formData,
      price: yuanToCents(formData.price),
    }
    
    if (dialogTitle.value === '新增课程') {
      await createCourse(submitData as CreateCourseRequest)
      ElMessage.success('新增成功')
    } else {
      await updateCourse(submitData as UpdateCourseRequest)
      ElMessage.success('修改成功')
    }
    dialogVisible.value = false
    handleQuery()
  } catch (error) {
    console.error('提交失败:', error)
  }
}

const handleDelete = (row: CourseInfo) => {
  ElMessageBox.confirm('确认要删除该课程吗？', '提示', {
    type: 'warning',
  }).then(async () => {
    await deleteCourse([row.id])
    ElMessage.success('删除成功')
    handleQuery()
  })
}

const handleStatusChange = async (row: CourseInfo) => {
  //增加二次确认
  ElMessageBox.confirm(
    `确认要${row.status === CourseStatus.ONLINE ? '下架' : '上架'}该课程吗？`,
    '提示',
    {
      type: 'warning',
    },
  )
    .then(async () => {
      const newStatus =
        row.status === CourseStatus.ONLINE
          ? CourseStatus.OFFLINE
          : CourseStatus.ONLINE
      await updateCourseStatus([row.id], newStatus)
      ElMessage.success(
        row.status === CourseStatus.ONLINE
          ? '下架成功！ 该课程已无法预约'
          : '上架成功',
      )
      handleQuery()
    })
    .catch((error: any) => {
      console.error('操作失败:', error)
      if (error.data?.reason === 'CourseStockNotSet') {
        //是否去设置
        ElMessageBox.confirm(
          '目前课程没有设置库存，无法上架，是否去设置库存？',
          '提示',
          {
            type: 'warning',
          },
        ).then(() => {
          router.push('/course/inventory')
        })
      }
    })
}

// 处理表格选择变化
const handleSelectionChange = (rows: CourseInfo[]) => {
  selectedRows.value = rows
}

// 批量上架
const handleBatchOnline = () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要上架的课程')
    return
  }

  // 过滤出已经是上架状态的课程
  const alreadyOnlineCourses = selectedRows.value.filter(
    (item) => item.status === CourseStatus.ONLINE,
  )

  if (alreadyOnlineCourses.length > 0) {
    ElMessage.warning(`已有${alreadyOnlineCourses.length}个课程处于上架状态`)
  }

  // 过滤出需要上架的课程
  const coursesToOnline = selectedRows.value.filter(
    (item) => item.status !== CourseStatus.ONLINE,
  )

  if (coursesToOnline.length === 0) {
    ElMessage.warning('没有需要上架的课程')
    return
  }

  ElMessageBox.confirm(
    `确认要上架选中的${coursesToOnline.length}个课程吗？`,
    '批量上架',
    {
      type: 'warning',
    },
  ).then(async () => {
    try {
      await updateCourseStatus(
        coursesToOnline.map((item) => item.id),
        CourseStatus.ONLINE,
      )
      ElMessage.success(`成功上架${coursesToOnline.length}个课程`)
      handleQuery()
    } catch (error: any) {
      console.error('批量上架失败:', error)
      if (error.data?.reason === 'CourseStockNotSet') {
        ElMessageBox.confirm(
          '部分课程没有设置库存，无法上架，是否去设置库存？',
          '提示',
          {
            type: 'warning',
          },
        ).then(() => {
          router.push('/course/inventory')
        })
      }
    }
  })
}

// 批量下架
const handleBatchOffline = () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要下架的课程')
    return
  }

  // 过滤出已经是下架状态的课程
  const alreadyOfflineCourses = selectedRows.value.filter(
    (item) => item.status === CourseStatus.OFFLINE,
  )

  if (alreadyOfflineCourses.length > 0) {
    ElMessage.warning(`已有${alreadyOfflineCourses.length}个课程处于下架状态`)
  }

  // 过滤出需要下架的课程
  const coursesToOffline = selectedRows.value.filter(
    (item) => item.status !== CourseStatus.OFFLINE,
  )

  if (coursesToOffline.length === 0) {
    ElMessage.warning('没有需要下架的课程')
    return
  }

  ElMessageBox.confirm(
    `确认要下架选中的${coursesToOffline.length}个课程吗？下架后这些课程将无法被预约。`,
    '批量下架',
    {
      type: 'warning',
    },
  ).then(async () => {
    try {
      await updateCourseStatus(
        coursesToOffline.map((item) => item.id),
        CourseStatus.OFFLINE,
      )
      ElMessage.success(`成功下架${coursesToOffline.length}个课程`)
      handleQuery()
    } catch (error: any) {
      console.error('批量下架失败:', error)
    }
  })
}
</script>

<style scoped>
.course-info {
  padding: 16px;
}
</style>
