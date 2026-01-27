<template>
  <div class="evaluation-display">
    <CommonTable
      ref="tableRef"
      :fetch-data="fetchData"
      :search-form="searchForm"
      :default-search-form="defaultSearchForm"
      :show-search="true"
    >
      <template #search-items>
        <el-form :inline="true" :model="searchForm">
          <el-form-item label="反馈时间">
            <el-date-picker
              v-model="searchForm.feedbackTime"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD HH:mm:ss"
              :defaultTime="defaultTime"
            />
          </el-form-item>
          <el-form-item label="手机号">
            <el-input
              v-model="searchForm.phone"
              placeholder="搜索手机号"
              clearable
              class="w-200"
            />
          </el-form-item>
          <el-form-item label="家长姓名">
            <el-input
              v-model="searchForm.parentName"
              placeholder="搜索家长姓名"
              clearable
              class="w-200"
            />
          </el-form-item>
          <el-form-item label="孩子姓名">
            <el-input
              v-model="searchForm.childName"
              placeholder="搜索孩子姓名"
              clearable
              class="w-200"
            />
          </el-form-item>
          <el-form-item label="课程名称">
            <el-input
              v-model="searchForm.courseName"
              placeholder="搜索课程名称"
              clearable
              class="w-200"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #extra-buttons>
        <el-button
          v-auth="'evaluation_display_export'"
          type="primary"
          icon="Download"
          @click="handleExport"
          >导出数据</el-button
        >
      </template>
      <el-table-column
        prop="appointmentId"
        label="预约编号"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="parentName"
        label="家长姓名"
        min-width="100"
        align="center"
      />
      <el-table-column
        prop="phone"
        label="联系方式"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="childName"
        label="孩子姓名"
        min-width="100"
        align="center"
      />
      <el-table-column
        prop="courseName"
        label="课程名称"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="courseTime"
        label="上课时间"
        min-width="120"
        align="center"
      />
      <el-table-column
        prop="totalScore"
        label="总评分"
        min-width="80"
        align="center"
      />
      <el-table-column
        prop="dimensionScore"
        label="维度评分"
        min-width="300"
        align="center"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.dimensionScore.join(';') }}
        </template>
      </el-table-column>
      <el-table-column
        prop="feedBack"
        label="反馈内容"
        min-width="150"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="feedBackImage"
        label="反馈图片"
        min-width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-image
            v-for="(img, idx) in row.feedBackImage"
            :key="img"
            :src="img"
            style="width: 40px; margin-right: 4px"
            :preview-src-list="row.feedBackImage"
            preview-teleported
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="evaluationLabel"
        label="快捷标签"
        min-width="200"
        show-overflow-tooltip
        :tooltip-formatter="({ row }: { row: any }) => row.evaluationLabel.join(' | ')"
        align="center"
      >
        <template #default="{ row }">
          <el-tag
            v-for="(tag, idx) in row.evaluationLabel"
            :key="tag"
            class="tag-item"
            >{{ tag }}</el-tag
          >
        </template>
      </el-table-column>
      <el-table-column
        prop="createdAt"
        label="反馈时间"
        min-width="150"
        align="center"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.createdAt) }}
        </template>
      </el-table-column>
    </CommonTable>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive } from 'vue'
import CommonTable from '@/components/CommonTable/index.vue'
import { getEvaluationList, exportEvaluationList } from './service'
import { formatDateTime } from '@/utils/date'
import { ElMessage } from 'element-plus'

const tableRef = ref()
const loading = ref(false)

const defaultSearchForm = {
  childName: undefined,
  courseName: undefined,
  parentName: undefined,
  phone: undefined,
  feedbackTime: [],
}
const searchForm = reactive({ ...defaultSearchForm })

const defaultTime: [Date, Date] = [
  new Date(2000, 1, 1, 0, 0, 0),
  new Date(2000, 2, 1, 23, 59, 59),
]
const fetchData = async (params: any) => {
  loading.value = true
  try {
    const { page, pageSize, ...rest } = params
    const [startTime, endTime] = rest.feedbackTime || []
    const query = {
      ...rest,
      page,
      pageSize,
      startTime,
      endTime,
    }
    delete query.feedbackTime
    const res = await getEvaluationList(query)
    return {
      list: res.list || [],
      total: res.total || 0,
    }
  } finally {
    loading.value = false
  }
}

/**
 * 处理导出
 */
const handleExport = async () => {
  let loadingMessage: any = null
  try {
    loadingMessage = ElMessage({
      message: '正在导出，请稍候...',
      duration: 0,
    })

    const [startTime, endTime] = searchForm.feedbackTime || []
    const params = {
      childName: searchForm.childName,
      courseName: searchForm.courseName,
      parentName: searchForm.parentName,
      phone: searchForm.phone,
      startTime,
      endTime,
    }

    // 调用导出API获取下载URL
    let times = 0
    const getDownloadUrl = async () => {
      const res = await exportEvaluationList(params)
      if (res && res.DownloadUrl) {
        // 创建一个链接元素并模拟点击下载
        const link = document.createElement('a')
        link.href = res.DownloadUrl
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        loadingMessage.close()
        ElMessage.success('导出成功')
      } else {
        // 休眠一秒后继续轮训
        await new Promise((resolve) => setTimeout(resolve, 1000))
        times++
        if (times > 30) {
          loadingMessage.close()
          ElMessage.error('导出失败：未获取到下载链接')
          return
        }
        getDownloadUrl()
      }
    }
    getDownloadUrl()
  } catch (error) {
    console.error('导出失败:', error)
    loadingMessage.close()
    ElMessage.error('导出失败，请稍后重试')
  }
}
</script>
<style lang="scss" scoped>
.w-200 {
  width: 200px;
}
.tag-item + .tag-item {
  margin-left: 5px;
}
</style>
<style lang="scss"></style>
