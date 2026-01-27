<template>
  <el-dialog
    :title="title"
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    width="1000px"
    append-to-body
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="150px">
      <el-form-item label="课程名称" prop="courseName">
        <el-input v-model="form.courseName" placeholder="请输入课程名称" />
      </el-form-item>
      <el-form-item label="课程类型" prop="courseType">
        <el-radio-group v-model="form.courseType" :disabled="isEdit">
          <el-radio value="single">单日</el-radio>
          <el-radio value="multi">多日</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="是否需要推送合同" prop="isPushContractRequired">
        <el-radio-group v-model="form.isPushContractRequired">
          <el-radio :value="true">需要</el-radio>
          <el-radio :value="false">不需要</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="价格" prop="price">
        <el-input-number
          v-model="form.price"
          :min="0"
          :precision="2"
          :step="10"
        />
        <span style="margin-left: 8px; color: #909399;">元</span>
      </el-form-item>
      <el-form-item label="主图" prop="mainImage" width="200">
        <FileUpload
          v-model="form.mainImage"
          :limit="4"
          accept=".jpg,.png,.jpeg"
          file-path="course/cover"
          tip-message="最多上传4张主图"
          list-type="picture-card"
          :hide-button-when-reached-limit="true"
        >
        </FileUpload>
      </el-form-item>
      <el-form-item label="详情图" prop="detailImages" width="200">
        <ImageSplitter
          :default-images="form.detailImages"
          @upload-complete="handleDetailImagesUpload"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('cancel')">取 消</el-button>
        <el-button type="primary" @click="handleSubmit">确 定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import FileUpload from '@/components/FileUpload/index.vue'
import ImageSplitter from '@/components/ImageSplitter/index.vue'
import { CreateCourseRequest } from '../service.type'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '新增课程',
  },
  formData: {
    type: Object as () => Partial<CreateCourseRequest>,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:visible', 'submit', 'cancel'])

const formRef = ref<FormInstance>()
const form = reactive<CreateCourseRequest>({
  courseName: '',
  courseType: 'single' as 'single' | 'multi',
  mainImage: [],
  detailImages: [],
  price: 0,
  isPushContractRequired: false,
})

// 监听外部传入的表单数据变化
watch(
  () => props.formData,
  (newVal) => {
    if (newVal) {
      Object.assign(form, newVal)
    }
  },
  { deep: true, immediate: true },
)

// 判断是否为编辑模式
const isEdit = computed(() => props.title === '编辑课程')

const rules: FormRules = {
  courseName: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  courseType: [
    { required: true, message: '请选择课程类型', trigger: 'change' },
  ],
  isPushContractRequired: [
    { required: true, message: '请选择是否需要推送合同', trigger: 'change' },
  ],
  // price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
  // mainImage: [{ required: true, message: '请上传主图', trigger: 'change' }],
  // detailImages: [
  //   { required: true, message: '请上传详情图', trigger: 'change' },
  // ],
}

// 处理详情图上传完成事件
const handleDetailImagesUpload = (imageList: any[]) => {
  form.detailImages = imageList.map((item) => item.url)
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    emit('submit', { ...form })
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
