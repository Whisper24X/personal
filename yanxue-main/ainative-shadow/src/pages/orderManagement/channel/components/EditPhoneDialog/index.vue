<template>
    <el-dialog title="修改手机号" v-model="dialogVisible" width="500px" @close="handleClose">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
            <el-form-item label="渠道订单编号">
                <span>{{ form.orderNumber }}</span>
            </el-form-item>
            <el-form-item label="商品名称">
                <span>{{ form.goodName }}</span>
            </el-form-item>
            <el-form-item label="当前手机号">
                <span>{{ form.currentPhone }}</span>
            </el-form-item>
            <el-form-item label="新手机号" prop="newPhone">
                <el-input v-model="form.newPhone" placeholder="请输入新手机号" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSubmit" :loading="loading">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { updateOrderPhone } from '../../service'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    orderData: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:visible', 'success'])

const dialogVisible = ref(props.visible)
const loading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
    id: '',
    orderNumber: '',
    goodName: '',
    currentPhone: '',
    newPhone: ''
})

const rules = {
    newPhone: [
        { required: true, message: '请输入新手机号', trigger: 'blur' },
        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式', trigger: 'blur' }
    ]
}

watch(() => props.visible, (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.orderData) {
        form.id = props.orderData.id
        form.orderNumber = props.orderData.orderNumber
        form.goodName = props.orderData.goodName
        form.currentPhone = props.orderData.phone
        form.newPhone = ''
    }
})

watch(() => dialogVisible.value, (newVal) => {
    emit('update:visible', newVal)
})

const handleClose = () => {
    if (formRef.value) {
        formRef.value.resetFields()
    }
    form.id = ''
    form.orderNumber = ''
    form.goodName = ''
    form.currentPhone = ''
    form.newPhone = ''
}

const handleSubmit = async () => {
    if (!formRef.value) return

    try {
        await formRef.value.validate()

        if (form.currentPhone === form.newPhone) {
            ElMessage.warning('新手机号与当前手机号相同，无需修改')
            return
        }

        loading.value = true

        await updateOrderPhone({
            id: form.id,
            phone: form.newPhone
        })

        ElMessage.success('手机号修改成功')
        dialogVisible.value = false
        emit('success')
    } catch (error) {
        console.error('修改手机号失败:', error)
        ElMessage.error('修改手机号失败，请稍后重试')
    } finally {
        loading.value = false
    }
}
</script>