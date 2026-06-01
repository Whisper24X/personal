<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    width="600px"
    destroy-on-close
    @closed="handleDialogClosed"
  >
    <div class="template-form-container">
      <el-form
        ref="formRef"
        :model="localFormData"
        :rules="rules"
        label-width="100px"
        label-position="left"
      >
        <el-form-item label="模板名称:" prop="templateName">
          <el-input
            v-model="localFormData.templateName"
            placeholder="请输入模板名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="所属业务:" prop="business">
          <el-select
            v-model="localFormData.business"
            placeholder="请选择所属业务"
            style="width: 100%"
            disabled
          >
            <el-option
              v-for="item in businessOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="评价对象:" prop="evaluationObject">
          <el-select
            v-model="localFormData.evaluationObject"
            placeholder="请选择评价对象"
            style="width: 100%"
          >
            <el-option
              v-for="item in evaluationObjectOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <!-- 评价维度 -->
        <el-form-item label="评价维度:" prop="evaluationDimension">
          <div class="dimensions-container">
            <p class="form-tip">（最多5项）</p>
            <div
              v-for="(_dimension, index) in localFormData.evaluationDimension"
              :key="index"
              class="dimension-item"
            >
              <el-input
                v-model="localFormData.evaluationDimension[index]"
                placeholder="请输入评价维度"
                maxlength="20"
                show-word-limit
              />
              <div class="dimension-actions">
                <el-button
                  type="primary"
                  circle
                  :icon="Plus"
                  size="small"
                  @click="addDimension"
                  :disabled="localFormData.evaluationDimension.length >= 5"
                />
                <el-button
                  type="danger"
                  circle
                  :icon="Minus"
                  size="small"
                  @click="removeDimension(index)"
                  :disabled="localFormData.evaluationDimension.length <= 1"
                />
              </div>
            </div>
            <el-button
              v-if="localFormData.evaluationDimension.length === 0"
              type="primary"
              plain
              @click="addDimension"
              >添加评价维度</el-button
            >
          </div>
        </el-form-item>

        <!-- 评价标签 -->
        <el-form-item label="评价标签:" prop="evaluationLabel">
          <div class="tags-container">
            <p class="form-tip">（最多7项）</p>
            <div
              v-for="(_tag, index) in localFormData.evaluationLabel"
              :key="index"
              class="tag-item"
            >
              <el-input
                v-model="localFormData.evaluationLabel[index]"
                placeholder="请输入评价标签"
                maxlength="20"
                show-word-limit
              />
              <div class="tag-actions">
                <el-button
                  type="primary"
                  circle
                  :icon="Plus"
                  size="small"
                  @click="addTag"
                  :disabled="localFormData.evaluationLabel.length >= 7"
                />
                <el-button
                  type="danger"
                  circle
                  :icon="Minus"
                  size="small"
                  @click="removeTag(index)"
                  :disabled="localFormData.evaluationLabel.length <= 1"
                />
              </div>
            </div>
            <el-button
              v-if="localFormData.evaluationLabel.length === 0"
              type="primary"
              plain
              @click="addTag"
              >添加评价标签</el-button
            >
          </div>
        </el-form-item>

        <!-- 温馨提示 -->
        <el-form-item label="温馨提示:" prop="tips">
          <el-input
            v-model="localFormData.tips"
            type="textarea"
            placeholder="请输入温馨提示内容"
            maxlength="500"
            show-word-limit
            :rows="4"
          />
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, reactive, watch } from 'vue'
import { Plus, Minus } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'

// 定义props
const props = defineProps({
  formData: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '新建评价模板',
  },
})

// 定义emit
const emit = defineEmits(['update:visible', 'submit', 'cancel'])

// 表单引用
const formRef = ref<FormInstance | null>(null)

// 对话框可见状态
const dialogVisible = ref(false)

// 监听props.visible变化
watch(
  () => props.visible,
  (newVal) => {
    if (dialogVisible.value !== newVal) {
      dialogVisible.value = newVal
    }
  },
)

// 监听内部dialogVisible变化
watch(
  () => dialogVisible.value,
  (newVal) => {
    if (newVal !== props.visible) {
      emit('update:visible', newVal)
    }
  },
)

// 监听对话框打开状态，打开时初始化本地表单数据
watch(
  () => dialogVisible.value,
  (newVal) => {
    if (newVal && props.formData) {
      // 当对话框打开时，从props深拷贝数据到本地
      initLocalFormData()
    }
  },
)

/**
 * 处理表单提交
 */
const handleSubmit = () => {
  if (!formRef.value) return

  formRef.value.validate((valid) => {
    if (valid) {
      emit('submit', JSON.parse(JSON.stringify(localFormData)))
    }
  })
}

// 所属业务选项
const businessOptions = [
  { label: '研学', value: '研学' },
  { label: '自习室', value: '自习室' },
]

const evaluationObjectOptions = [
  { label: '单日营', value: '单日营' },
  { label: '单日营课包', value: '单日营课包' },
  { label: '多日营', value: '多日营' },
  { label: '研学老师', value: '研学老师' },
]

// 当前表单数据
const localFormData = reactive({
  id: '',
  templateName: '',
  business: '研学',
  evaluationObject: '',
  evaluationDimension: [''],
  evaluationLabel: [''],
  tips: '',
  isEdit: false,
})

/**
 * 初始化本地表单数据
 */
const initLocalFormData = () => {
  // 深拷贝props.formData到localFormData
  localFormData.id = props.formData.id || ''
  localFormData.templateName = props.formData.templateName || ''
  localFormData.business = props.formData.business || '研学'
  localFormData.evaluationObject = props.formData.evaluationObject || ''
  localFormData.evaluationDimension = props.formData.evaluationDimension || []
  localFormData.evaluationLabel = props.formData.evaluationLabel || []
  localFormData.tips = props.formData.tips || ''
  localFormData.isEdit = props.formData.isEdit || false
}

// 表单校验规则
const rules = {
  templateName: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { max: 50, message: '长度不能超过50个字符', trigger: 'blur' },
  ],
  evaluationObject: [
    { required: true, message: '请输入评价对象', trigger: 'blur' },
    { max: 50, message: '长度不能超过50个字符', trigger: 'blur' },
  ],
  business: [{ required: true, message: '请选择所属业务', trigger: 'change' }],
  evaluationDimension: [
    {
      type: 'array',
      required: true,
      trigger: 'change',
      validator: (_rule: any, value: any, callback: any) => {
        if (value.length === 0) {
          callback(new Error('请至少添加一个评价维度'))
        } else if (value.some((item: any) => item.trim() === '')) {
          callback(new Error('评价维度不能为空'))
        } else {
          callback()
        }
      },
    },
  ],
  evaluationLabel: [
    {
      type: 'array',
      required: true,
      trigger: 'change',
      validator: (_rule: any, value: any, callback: any) => {
        if (value.length === 0) {
          callback(new Error('请至少添加一个评价标签'))
        } else if (value.some((item: any) => item.trim() === '')) {
          callback(new Error('评价标签不能为空'))
        } else {
          callback()
        }
      },
    },
  ],
  tips: [{ max: 500, message: '长度不能超过500个字符', trigger: 'blur' }],
}

// 添加评价维度
const addDimension = () => {
  if (localFormData.evaluationDimension.length < 5) {
    localFormData.evaluationDimension.push('')
  }
}

// 删除评价维度
const removeDimension = (index: number) => {
  if (localFormData.evaluationDimension.length > 1) {
    localFormData.evaluationDimension.splice(index, 1)
  }
}

// 添加评价标签
const addTag = () => {
  if (localFormData.evaluationLabel.length < 7) {
    localFormData.evaluationLabel.push('')
  }
}

// 删除评价标签
const removeTag = (index: number) => {
  if (localFormData.evaluationLabel.length > 1) {
    localFormData.evaluationLabel.splice(index, 1)
  }
}

// 表单校验方法
const validate = async () => {
  if (!formRef.value) return false

  try {
    await formRef.value.validate()
    return true
  } catch (error) {
    return false
  }
}

// 处理取消
const handleCancel = () => {
  dialogVisible.value = false
}

// 处理对话框关闭
const handleDialogClosed = () => {
  console.log('handleDialogClosed')

  // 重置表单
  if (formRef.value) {
    formRef.value.resetFields()
  }

  // 重置本地数据
  Object.assign(localFormData, {
    id: '',
    templateName: '',
    business: '',
    evaluationObject: '',
    evaluationDimension: [''] as string[],
    evaluationLabel: [''] as string[],
    tips: '',
    isEdit: false,
  })

  emit('cancel')
}

// 暴露方法给父组件
defineExpose({
  validate,
  formRef,
  initLocalFormData,
})
</script>

<style scoped>
.template-form-container {
  padding: 10px;
}

.form-tip {
  color: #909399;
  font-size: 12px;
  margin: 0 0 10px 0;
}

.dimensions-container,
.tags-container {
  width: 100%;
}

.dimension-item,
.tag-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.dimension-actions,
.tag-actions {
  display: flex;
  gap: 5px;
  margin-left: 10px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
