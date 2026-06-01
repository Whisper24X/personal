<template>
  <el-dialog
    v-model="visible"
    title="修改密码"
    width="500px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="!isForceChange"
  >
    <el-form
      ref="passwordFormRef"
      :model="passwordForm"
      :rules="passwordRules"
      label-width="100px"
    >
      <el-form-item label="原密码" prop="oldPassword">
        <el-input
          v-model="passwordForm.oldPassword"
          type="password"
          show-password
          placeholder="请输入原密码"
        />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="passwordForm.newPassword"
          type="password"
          show-password
          placeholder="密码长度至少6位，必须包含大小写字母和数字"
        />
      </el-form-item>
      <el-form-item label="确认新密码" prop="confirmPassword">
        <el-input
          v-model="passwordForm.confirmPassword"
          type="password"
          show-password
          placeholder="请再次输入新密码"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        确认
      </el-button>
      <el-button v-if="!isForceChange" @click="handleCancel"> 取消 </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FormInstance } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/modules/userStore'
import { useRouter } from 'vue-router'

const props = defineProps<{
  modelValue: boolean
  isForceChange?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const userStore = useUserStore()
const passwordFormRef = ref<FormInstance>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

// 密码复杂度校验
const validatePassword = (rule: any, value: string, callback: Function) => {
  const pattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z\d]{6,}$/
  if (!pattern.test(value)) {
    callback(new Error('密码长度至少6位，必须包含大小写字母和数字'))
  } else {
    callback()
  }
}

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { validator: validatePassword, trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: Function) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

const router = useRouter()
const loading = ref(false)

const handleSubmit = async () => {
  if (!passwordFormRef.value) return

  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        await userStore.changePassword({
          password: passwordForm.value.newPassword,
          oldPassword: passwordForm.value.oldPassword,
        })
        ElMessage.success('密码修改成功')
        emit('success')

        // 提示用户重新登录
        await ElMessageBox.alert('密码修改成功，请重新登录', '提示', {
          type: 'success',
          showClose: false,
          callback: () => {
            userStore.reset()
            router.push('/login')
          },
        })
      } catch (error: any) {
        ElMessage.error(error.message || '密码修改失败')
      } finally {
        loading.value = false
      }
    }
  })
}

const handleCancel = () => {
  passwordForm.value = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
  visible.value = false
}
</script>

<style scoped>
.el-dialog :deep(.el-form) {
  padding: 20px;
}
</style>
