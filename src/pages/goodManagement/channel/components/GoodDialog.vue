<template>
  <el-dialog
    :title="title"
    v-model="visible"
    width="65%"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      label-position="right"
      v-loading="loading"
    >
      <!-- 基本信息 -->
      <el-divider content-position="left">基本信息</el-divider>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="渠道" prop="channelId">
            <el-select
              v-model="form.channelId"
              placeholder="请选择渠道"
              clearable
            >
              <el-option
                v-for="item in channelOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col v-if="!isMiniprogramChannel" :span="8">
          <el-form-item label="渠道商品ID" prop="channelGoodId">
            <el-input
              v-model="form.channelGoodId"
              placeholder="请输入渠道商品ID"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="售价" prop="price">
            <el-input-number
              v-model="form.price"
              :min="0.01"
              :precision="2"
              :step="1"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 商品标签 -->
      <el-divider content-position="left">商品标签</el-divider>
      <el-row :gutter="20">
        <el-col :span="16">
          <el-form-item label="商品标签" prop="label">
            <div class="tags-input-container">
              <div
                v-for="(tag, index) in form.label || []"
                :key="index"
                class="tag-input-item"
              >
                <el-input
                  v-model="form.label![index]"
                  placeholder="请输入标签"
                  maxlength="4"
                  show-word-limit
                  style="width: 150px"
                />
                <el-button
                  type="danger"
                  circle
                  size="small"
                  @click="removeTag(index)"
                >
                  <el-icon>
                    <Minus />
                  </el-icon>
                </el-button>
              </div>
              <el-button
                v-if="(form.label || []).length < 2"
                type="primary"
                plain
                size="small"
                @click="addTag"
              >
                添加标签
              </el-button>
            </div>
            <div class="tip">
              一个商品最多配置2个标签，至少配置1个，每个标签最多4个字符
            </div>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 购买页推送信息 -->
      <el-divider v-if="isMiniprogramChannel" content-position="left"
        >购买页推送信息</el-divider
      >
      <el-row v-if="isMiniprogramChannel" :gutter="20">
        <el-col :span="12">
          <el-form-item
            label="是否推送预约信息"
            prop="isPushAppointmentInfo"
            label-width="150"
          >
            <el-radio-group v-model="form.isPushAppointmentInfo">
              <el-radio :value="true">是</el-radio>
              <el-radio :value="false">否</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 图片信息 -->
      <el-divider content-position="left">图片信息</el-divider>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="主图" prop="mainImages">
            <FileUpload
              ref="mainImagesRef"
              v-model="form.mainImages"
              accept=".jpg,.png,.jpeg,.webp"
              :limit="5"
              list-type="picture-card"
              file-path="good/main"
              :file-name-type="5"
              :tip-message="'支持的图片格式: jpg, png, jpeg, webp'"
              :placeholder="'点击上传主图'"
              :hide-button-when-reached-limit="true"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="详情图" prop="detailImages">
            <ImageSplitter
              ref="imageSplitterRef"
              :default-images="form.detailImages"
              @upload-complete="handleDetailImagesUpload"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 商品内容 -->
      <el-divider content-position="left">商品内容</el-divider>
      <el-form-item
        v-for="(category, index) in form.content.goodCategories"
        :key="category.categoryId"
        :label="'类别' + (index + 1)"
        class="category-item"
      >
        <el-row :gutter="10">
          <el-col :span="12">
            <!-- 限制20个字 -->
            <el-input
              v-model="category.categoryName"
              placeholder="类别名称"
              :maxlength="20"
            />
          </el-col>
          <el-col :span="6">
            <el-input-number
              v-model="category.useTimes"
              :min="1"
              :step="1"
              :precision="0"
              placeholder="使用次数"
              style="width: 100%"
            />
          </el-col>
          <el-col :span="2">
            <el-button type="danger" @click="removeCategory(index)">
              <el-icon>
                <Delete />
              </el-icon>
            </el-button>
          </el-col>
        </el-row>
        <div class="course-items">
          <div
            v-for="(course, courseIndex) in category.courses"
            :key="courseIndex"
            class="course-item"
          >
            <el-select
              v-model="category.courses[courseIndex]"
              placeholder="添加课程"
              value-key="courseId"
              filterable
              style="width: 180px"
            >
              <el-option
                v-for="item in filteredCourseOptions"
                :key="item.courseId"
                :label="item.courseName"
                :value="item"
              />
            </el-select>
            <el-button
              type="danger"
              circle
              size="small"
              @click="removeCourse(index, courseIndex)"
            >
              <el-icon>
                <Minus />
              </el-icon>
            </el-button>
          </div>
          <el-row :gutter="10" style="margin-top: 10px">
            <el-col>
              <el-button type="primary" @click="addCourse(index)"
                >添加课程</el-button
              >
            </el-col>
          </el-row>
        </div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="addCategory">添加商品类别</el-button>
      </el-form-item>

      <!-- 购买协议(仅小程序渠道) -->
      <el-divider v-if="isMiniprogramChannel" content-position="left"
        >购买协议</el-divider
      >
      <el-row v-if="isMiniprogramChannel" :gutter="20">
        <el-col :span="12">
          <el-form-item label="协议名称" prop="purchaseAgreementName">
            <el-input
              v-model="form.purchaseAgreementName"
              placeholder="请输入购买协议名称"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="协议链接" prop="purchaseAgreementLink">
            <el-input
              v-model="form.purchaseAgreementLink"
              placeholder="请输入购买协议链接"
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, nextTick, computed } from 'vue'
import { ElMessage, FormInstance } from 'element-plus'
import { Plus, Delete, Minus } from '@element-plus/icons-vue'
import {
  getChannelList,
  createGood,
  updateGood,
  getCourseListOptions,
} from '../service'
import type { CreateGoodReq, UpdateGoodReq, GoodInfo } from '../service.type'
import FileUpload from '@/components/FileUpload/index.vue'
import ImageSplitter from '@/components/ImageSplitter/index.vue'
import type { UploadFile } from '@/components/ImageSplitter/utils/uploader'

// 自定义事件
const emit = defineEmits(['update:modelValue', 'success'])

// 组件属性
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    type?: 'add' | 'edit' | 'copy'
    platformGoodId: string
    data?: GoodInfo | null
    goodType: 'single' | 'multi'
  }>(),
  {
    title: '渠道商品',
    type: 'add',
    data: null,
  },
)

// 内部状态
const visible = ref(false)
const loading = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const channelOptions = ref<{ label: string; value: string }[]>([])
const tempId = ref<string>('')
const courseOptions = ref<
  { courseName: string; courseId: string; courseType?: string }[]
>([])
const filteredCourseOptions = ref<
  { courseName: string; courseId: string; courseType?: string }[]
>([])
const mainImagesRef = ref()
const imageSplitterRef = ref()
const usedCategoryIds = ref<Set<string>>(new Set())

// 计算属性:判断当前选择的渠道是否为小程序
const isMiniprogramChannel = computed(() => {
  const selectedChannel = channelOptions.value.find(
    (option) => option.value === form.channelId,
  )
  return selectedChannel?.label === '小程序'
})

// 生成唯一ID的函数
const generateUniqueId = (): string => {
  const timestamp = new Date().getTime().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 8)
  const uniqueId = `cat_${timestamp}_${randomStr}`

  // 确保ID不重复
  if (usedCategoryIds.value.has(uniqueId)) {
    return generateUniqueId()
  }

  usedCategoryIds.value.add(uniqueId)
  return uniqueId
}

// 表单数据
const form = reactive<CreateGoodReq>({
  platformGoodId: '',
  channelId: '',
  channelGoodId: '',
  mainImages: [],
  detailImages: [],
  price: 0,
  content: {
    goodCategories: [],
  },
  // 新增：是否推送预约信息
  isPushAppointmentInfo: false,
  // 新增：商品标签
  label: [] as string[],
  // 新增：购买协议
  purchaseAgreementName: '',
  purchaseAgreementLink: '',
})

// 表单验证规则 - 使用计算属性动态生成
const rules = computed(() => ({
  channelId: [{ required: true, message: '请选择渠道', trigger: 'change' }],
  channelGoodId: isMiniprogramChannel.value
    ? []
    : [{ required: true, message: '请输入渠道商品ID', trigger: 'blur' }],
  price: [
    { required: true, message: '请输入售价', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '售价必须大于0', trigger: 'blur' },
  ],
  mainImages: [{ required: true, message: '请上传主图', trigger: 'change' }],
  detailImages: [
    { required: true, message: '请上传详情图', trigger: 'change' },
  ],
  isPushAppointmentInfo: [
    { required: true, message: '请选择是否推送预约信息', trigger: 'change' },
  ],
  label: [
    {
      validator: (rule: any, value: string[], callback: any) => {
        if (!value || value.length === 0) {
          callback(new Error('请至少添加一个标签'))
        } else if (value.length > 2) {
          callback(new Error('最多只能添加2个标签'))
        } else if (value.some((tag) => !tag || tag.trim() === '')) {
          callback(new Error('标签不能为空'))
        } else if (value.some((tag) => tag.length > 4)) {
          callback(new Error('标签最多4个字符'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
  purchaseAgreementLink: isMiniprogramChannel.value
    ? [
        {
          validator: (rule: any, value: string, callback: any) => {
            if (!value || value.trim() === '') {
              callback()
              return
            }
            // 校验链接格式: https://7to12.yangcong345.com/onion-learning/user-setting/agreementGeneralPage?navTitle=xx&agreementId=xxx
            const urlPattern = /^https:\/\/7to12\.yangcong345\.com\/onion-learning\/user-setting\/agreementGeneralPage\?navTitle=.+&agreementId=.+$/
            if (!urlPattern.test(value)) {
              callback(new Error('协议链接格式不正确,应为: https://7to12.yangcong345.com/onion-learning/user-setting/agreementGeneralPage?navTitle=xx&agreementId=xxx'))
            } else {
              callback()
            }
          },
          trigger: 'blur',
        },
      ]
    : [],
}))

// 监听visible状态
watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
    if (val) {
      getCourseList()
    }
  },
)

// 监听内部visible变化并同步到父组件
watch(visible, (val) => {
  emit('update:modelValue', val)
})

// 监听渠道变化,当切换到小程序时清空渠道商品ID,切换到其他渠道时清空购买协议
watch(
  () => form.channelId,
  (newChannelId, oldChannelId) => {
    if (oldChannelId && newChannelId !== oldChannelId) {
      const newChannel = channelOptions.value.find(
        (option) => option.value === newChannelId,
      )
      if (newChannel?.label === '小程序') {
        // 切换到小程序渠道,清空渠道商品ID
        form.channelGoodId = ''
      } else {
        // 切换到其他渠道,清空购买协议字段
        form.purchaseAgreementName = ''
        form.purchaseAgreementLink = ''
      }
    }
  },
)

// 初始化表单
watch(
  () => props.platformGoodId,
  (val) => {
    if (val) {
      form.platformGoodId = val
    }
  },
  { immediate: true },
)

// 监听商品类型变化，重新过滤课程
watch(
  () => props.goodType,
  () => {
    if (courseOptions.value.length > 0) {
      filterCoursesByGoodType()
      // 清空已选择的课程，因为类型变了
      form.content.goodCategories.forEach((category) => {
        category.courses = []
      })
    }
  },
  { immediate: true },
)

// 初始化渠道列表
const fetchChannelList = async () => {
  try {
    const { list } = await getChannelList()
    channelOptions.value = (list || []).map((item) => ({
      label: item.name,
      value: item.id,
    }))
  } catch (error) {
    console.error('获取渠道列表失败', error)
  }
}

// 根据商品信息初始化表单
const initFormData = (good: GoodInfo) => {
  // 清空已使用的ID集合
  usedCategoryIds.value.clear()

  // 基本信息
  form.channelGoodId = good.channelGoodId
  form.price = good.price
  // 新增：预约推送信息
  form.isPushAppointmentInfo = good.isPushAppointmentInfo || false
  // 新增：商品标签
  form.label = good.label && good.label.length > 0 ? [...good.label] : []
  // 新增：购买协议
  form.purchaseAgreementName = good.purchaseAgreementName || ''
  form.purchaseAgreementLink = good.purchaseAgreementLink || ''

  if (props.type === 'edit') {
    tempId.value = good.id
    form.channelId = good.channelId
  } else if (props.type === 'copy') {
    tempId.value = ''
    form.channelId = ''
    form.channelGoodId = ''
  }
  // 图片信息
  form.mainImages = good.mainImage || []
  form.detailImages = good.detailImages || []

  // 商品内容
  if (good.content?.goodCategories) {
    form.content.goodCategories = good.content.goodCategories.map((cat) => {
      // 为每个类别添加或保留categoryId
      const categoryId = cat.categoryId || generateUniqueId()
      if (cat.categoryId) {
        usedCategoryIds.value.add(cat.categoryId)
      }

      return {
        ...cat,
        categoryId,
        courses: cat.courses || [],
      }
    })
  } else {
    form.content.goodCategories = []
  }
}

// 重置表单
const resetForm = () => {
  // 清空已使用的ID集合
  usedCategoryIds.value.clear()

  // 基本信息
  form.channelId = ''
  form.channelGoodId = ''
  form.price = 0
  tempId.value = ''

  // 新增：预约推送信息
  form.isPushAppointmentInfo = false

  // 新增：商品标签
  form.label = []

  // 新增：购买协议
  form.purchaseAgreementName = ''
  form.purchaseAgreementLink = ''

  // 图片信息
  form.mainImages = []
  form.detailImages = []

  // 商品内容
  form.content.goodCategories = []
}
// 当type为edit且data不为空时，初始化表单数据
watch(
  () => props.data,
  (val) => {
    if (val && ['edit', 'copy'].includes(props.type)) {
      console.log(val)
      initFormData(val)
    } else {
      resetForm()
    }
  },
  { immediate: true },
)

// 获取课程列表选项
const getCourseList = async () => {
  const { list = [] } = await getCourseListOptions()
  console.log(list)
  courseOptions.value = list.map((item) => ({
    courseName: item.courseName,
    courseId: item.id,
    courseType: item.courseType,
  }))
  // 根据商品类型过滤课程
  filterCoursesByGoodType()
}

// 根据商品类型过滤课程
const filterCoursesByGoodType = () => {
  if (props.goodType === 'single') {
    // 单日类型商品只能添加单日营课程
    filteredCourseOptions.value = courseOptions.value.filter(
      (course) => course.courseType === 'single',
    )
  } else if (props.goodType === 'multi') {
    // 多日类型商品只能添加多日营课程
    filteredCourseOptions.value = courseOptions.value.filter(
      (course) => course.courseType === 'multi',
    )
  } else {
    // 默认显示所有课程
    filteredCourseOptions.value = [...courseOptions.value]
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error('请完善表单信息')
      return
    }

    // 验证商品类别和课程
    if (form.content.goodCategories.length === 0) {
      ElMessage.error('请添加至少一个商品类别')
      return
    }

    // 验证每个类别都必须有名称、使用次数和至少一个课程
    for (let i = 0; i < form.content.goodCategories.length; i++) {
      const category = form.content.goodCategories[i]
      if (!category.categoryName) {
        ElMessage.error(`请输入第${i + 1}个类别的名称`)
        return
      }
      if (!category.useTimes || category.useTimes <= 0) {
        ElMessage.error(`请设置第${i + 1}个类别的使用次数`)
        return
      }
      if (category.courses.length === 0) {
        ElMessage.error(`请为第${i + 1}个类别添加至少一个课程`)
        return
      }
      // 检查每个课程是否已选择
      for (let j = 0; j < category.courses.length; j++) {
        if (!category.courses[j].courseId) {
          ElMessage.error(`请选择第${i + 1}个类别的第${j + 1}个课程`)
          return
        }
      }
    }

    // 只在渠道为小程序时进行购买页推送信息校验
    if (isMiniprogramChannel.value) {
      const totalCoursesCount = form.content.goodCategories.reduce(
        (total, category) => {
          return total + category.courses.length * (category.useTimes || 1)
        },
        0,
      )

      // 获取所有课程的类型信息
      const allCourses = form.content.goodCategories.flatMap(
        (category) => category.courses,
      )
      const courseTypeCounts = allCourses.reduce((acc, course) => {
        const courseInfo = courseOptions.value.find(
          (option) => option.courseId === course.courseId,
        )
        if (courseInfo && courseInfo.courseType) {
          acc[courseInfo.courseType] = (acc[courseInfo.courseType] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      // 新规则：小程序渠道包含多种课程的商品，商品数=1时可选择推送预约
      // 校验规则1：多日营类型的商品最多只能包含一个课程，且购买页推送信息的选项必须选择"是"
      if (props.goodType === 'multi') {
        if (totalCoursesCount > 1) {
          ElMessage.error(
            '这是一个多日营商品，推送预约信息选项应该选择是，且只能包含一个课程',
          )
          return
        }
        if (form.isPushAppointmentInfo === false) {
          ElMessage.error(
            '这是一个多日营商品，推送预约信息选项应该选择是，且只能包含一个课程',
          )
          return
        }
      }

      // 校验规则2：当发布一个商品为推送预约且包含多个课程且使用数量大于1时
      if (
        form.isPushAppointmentInfo === true &&
        (form.content.goodCategories.length > 1 ||
          form.content.goodCategories.some((category) => category.useTimes > 1))
      ) {
        debugger
        ElMessage.error(
          '这是一个包含多个课程且数量大于1的商品，推送预约信息选项应该选择否',
        )
        return
      }
    }

    submitting.value = true
    try {
      let result = { success: false, message: '' }

      // 如果是小程序渠道,清空渠道商品ID;如果不是小程序渠道,清空购买协议字段
      const submitData = {
        ...form,
        channelGoodId: isMiniprogramChannel.value
          ? undefined
          : form.channelGoodId,
        purchaseAgreementName: isMiniprogramChannel.value
          ? form.purchaseAgreementName
          : undefined,
        purchaseAgreementLink: isMiniprogramChannel.value
          ? form.purchaseAgreementLink
          : undefined,
      }

      if (['add', 'copy'].includes(props.type)) {
        const res = await createGood(submitData)
        result.success = !!res.id
        result.message = res.id ? '新增成功' : '新增失败'
      } else {
        const updateData: UpdateGoodReq = {
          ...submitData,
          id: tempId.value,
        }
        const res = await updateGood(updateData)
        result.success = res.isSucceed
        result.message = res.isSucceed ? '编辑成功' : '编辑失败'
      }

      if (result.success) {
        ElMessage.success(result.message)
        emit('success')
      } else {
        ElMessage.error(result.message)
      }
    } catch (error) {
      console.error(props.type === 'add' ? '新增失败' : '编辑失败', error)
      ElMessage.error(props.type === 'add' ? '新增失败' : '编辑失败')
    } finally {
      submitting.value = false
    }
  })
}

// 取消操作
const handleCancel = () => {
  visible.value = false
}

// 组件挂载时获取渠道列表
fetchChannelList()

// 添加商品类别
const addCategory = () => {
  form.content.goodCategories.push({
    categoryId: generateUniqueId(),
    categoryName: '',
    useTimes: 1,
    courses: [],
  })
}

// 移除商品类别
const removeCategory = (index: number) => {
  const category = form.content.goodCategories[index]
  if (category.categoryId) {
    usedCategoryIds.value.delete(category.categoryId)
  }
  form.content.goodCategories.splice(index, 1)
}

// 添加课程
const addCourse = (index: number) => {
  form.content.goodCategories[index].courses.push({
    courseId: '',
    courseName: '',
  })
}

// 移除课程
const removeCourse = (index: number, courseIndex: number) => {
  form.content.goodCategories[index].courses.splice(courseIndex, 1)
}

// 处理详情图上传完成
const handleDetailImagesUpload = (images: UploadFile[]) => {
  // 将 UploadFile[] 转换为 string[]，只保留 url
  console.log('handleDetailImagesUpload', images)
  form.detailImages = images.map((image) => image.url || '')
}

// 添加标签
const addTag = () => {
  if (!form.label) {
    form.label = []
  }
  if (form.label.length < 2) {
    form.label.push('')
  }
}

// 移除标签
const removeTag = (index: number) => {
  if (!form.label) {
    return
  }
  if (form.label.length > 1) {
    form.label.splice(index, 1)
  }
}
</script>

<style lang="scss" scoped>
.category-item {
  margin-bottom: 10px;
  padding: 10px 0;
  border-radius: 8px;
  background: #fafafa;
  border: 1px solid #e5e5e5;

  &:last-child {
    margin-bottom: 0;
  }

  .course-items {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .course-item {
      display: flex;
      gap: 10px;
      align-items: center;
    }
  }
}

.tip {
  color: #909399;
  font-size: 12px;
  margin-top: 5px;
}

.tags-input-container {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .tag-input-item {
    display: flex;
    gap: 10px;
    align-items: center;
  }
}

:deep(.el-upload--picture-card) {
  --el-upload-picture-card-size: 100px;
}
</style>
