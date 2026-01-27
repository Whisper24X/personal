<template>
  <div class="login">
    <div class="login__container">
      <div class="login__container__title">
        <h1>洋葱研学管理后台</h1>
      </div>
      <div class="login__container__form">
        <el-form ref="formRef" :model="model" :rules="rules">
          <el-form-item path="username" label="账号" prop="username">
            <el-input v-model="model.username" @keydown.enter.prevent />
          </el-form-item>
          <el-form-item path="password" label="密码" prop="password">
            <el-input v-model="model.password" type="password" @keydown.enter.prevent />
          </el-form-item>
          <div class="login__container__form__button">
            <el-button round type="primary" @click="handleValidateButtonClick">
              登录
            </el-button>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, inject } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import Logger from '@/utils/logger'
const logger = inject<Logger>('logger') // 获取 logger 实例

import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/userStore'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance | null>(null)
const model = ref({
  username: '',
  password: '',
})
const rules = ref<FormRules>({
  username: [
    {
      required: true,
      message: '请输入用户名',
      trigger: 'blur',
    },
  ],
  password: [
    {
      required: true,
      message: '请输入密码',
      trigger: 'blur',
    },
  ],
})

const handleValidateButtonClick = async () => {
  await formRef.value?.validate((valid, fields) => {
    if (valid) {
      userStore.login(model.value).then(() => {
        ElMessage({
          message: '登录成功',
          type: 'success',
        })
        router.push('/')
      })
    } else {
      logger?.error('error submit!', fields)
    }
  })
}
</script>
<style scoped lang="scss">
.login {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: url('./assets/login-bg.jpg') no-repeat;
  background-color: #2282fe;
  background-size: cover;

  .login__container {
    width: 400px;
    background-color: #fff;
    border-radius: 10px;
    padding: 24px;

    .login__container__title {
      text-align: center;
      margin-bottom: 24px;
    }

    .login__container__form {
      .el-form-item {
        margin-bottom: 24px;
      }

      &__button {
        padding-left: 20px;
        text-align: right;

        .el-button {
          border-radius: 10px;
          width: 100%;
          height: 40px;
        }
      }
    }
  }
}
</style>
