<template>
    <el-dialog :title="title" v-model="dialogVisible" width="500px" @close="handleClose">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
            <el-form-item label="分类名称" prop="name">
                <el-input v-model="form.name" placeholder="请输入分类名称" />
            </el-form-item>
            <el-form-item label="分类图标" prop="icon">
                <FileUpload ref="fileUploadRef" v-model="form.icon" accept=".png,.jpg,.jpeg"
                    file-path="recommendation/icons" :tip-message="'支持的文件格式: png, jpg, jpeg，图片尺寸必须为 72x72 像素'"
                    placeholder="请上传分类图标" :limit="1" list-type="picture-card" @file-uploaded="handleIconUploaded"
                    @file-removed="handleIconRemoved" />
            </el-form-item>
            <el-form-item label="排序" prop="sortOrder">
                <el-input-number v-model="form.sortOrder" :min="1" :max="999" controls-position="right"
                    style="width: 100%" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSubmit" :loading="loading">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import FileUpload from '@/components/FileUpload/index.vue'
import { createRecommendation, updateRecommendation } from '../../service'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    editData: {
        type: Object,
        default: undefined
    }
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const formRef = ref<FormInstance>()
const fileUploadRef = ref()

const title = computed(() => {
    return props.editData ? '编辑推荐分类' : '新增推荐分类'
})

const form = reactive({
    name: '',
    icon: '',
    sortOrder: 1,
    goodItems: []
})

const rules = {
    name: [
        { required: true, message: '请输入分类名称', trigger: 'blur' },
        { min: 1, max: 50, message: '分类名称长度为1-50个字符', trigger: 'blur' }
    ],
    icon: [
        { required: true, message: '请上传分类图标', trigger: 'change' }
    ],
    sortOrder: [
        { required: true, message: '请输入排序', trigger: 'blur' },
        { type: 'number', min: 1, max: 999, message: '排序范围为1-999', trigger: 'blur' }
    ]
}

watch(() => props.visible, (newVal) => {
    dialogVisible.value = newVal
    if (newVal) {
        if (props.editData) {
            // 编辑模式，填充数据
            form.name = props.editData.name
            form.icon = props.editData.icon || ''
            form.sortOrder = props.editData.sortOrder
            form.goodItems = props.editData.goodItems || []
        } else {
            // 新增模式，重置表单
            resetForm()
        }
    }
})

watch(() => dialogVisible.value, (newVal) => {
    emit('update:visible', newVal)
})

const handleClose = () => {
    if (formRef.value) {
        formRef.value.resetFields()
    }
    resetForm()
}

const resetForm = () => {
    form.name = ''
    form.icon = ''
    form.sortOrder = 1
    form.goodItems = []
}

const handleSubmit = async () => {
    if (!formRef.value) return

    try {
        await formRef.value.validate()

        loading.value = true

        if (props.editData) {
            // 编辑模式
            await updateRecommendation({
                id: props.editData.id,
                ...form
            })
            ElMessage.success('推荐分类修改成功')
        } else {
            // 新增模式
            await createRecommendation(form)
            ElMessage.success('推荐分类创建成功')
        }

        dialogVisible.value = false
        emit('success')
    } catch (error) {
        console.error('操作失败:', error)
        ElMessage.error('操作失败，请稍后重试')
    } finally {
        loading.value = false
    }
}

// 文件上传成功处理
const handleIconUploaded = (file: any) => {
    if (file && file.url) {
        // 验证图片尺寸
        const img = new Image()
        img.onload = () => {
            if (img.width === 72 && img.height === 72) {
                form.icon = file.url
                // 手动触发验证
                if (formRef.value) {
                    formRef.value.validateField('icon')
                }
            } else {
                ElMessage.error(`图片尺寸必须为 72x72 像素，当前尺寸为 ${img.width}x${img.height} 像素`)
                // 清除已上传的文件
                if (fileUploadRef.value) {
                    fileUploadRef.value.clearFiles()
                }
                if (formRef.value) {
                    formRef.value.validateField('icon')
                }
            }
        }
        img.onerror = () => {
            ElMessage.error('图片加载失败，请重新上传')
        }
        img.src = file.url
    }
}

// 文件移除处理
const handleIconRemoved = () => {
    form.icon = ''
    // 手动触发验证
    if (formRef.value) {
        formRef.value.validateField('icon')
    }
}
</script>