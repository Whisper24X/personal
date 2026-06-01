<template>
  <TabBarLayout
    tab-key="child"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: isEdit ? '编辑营员信息' : '添加营员信息'
    }"
  >
    <view class="child-form-container">
      <view class="form-content">
        <!-- 真实姓名 -->
        <view class="form-item">
          <view class="form-label">
            <text class="required">*</text>
            <text>真实姓名</text>
          </view>
          <view class="form-input">
            <input
              :value="formData.studentName"
              type="text"
              placeholder="请输入身份证中的真实姓名"
              class="input-field"
              @input="handleNameInput"
            />
          </view>
        </view>

        <!-- 身份证号 -->
        <view class="form-item">
          <view class="form-label">
            <text>身份证号</text>
          </view>
          <view class="form-input">
            <input
              :value="formData.studentIdentityCard"
              type="text"
              placeholder="请输入身份证号"
              maxlength="18"
              class="input-field"
              @input="handleIdCardInput"
            />
          </view>
        </view>

        <!-- 性别 -->
        <view class="form-item">
          <view class="form-label">
            <text class="required">*</text>
            <text>性别</text>
          </view>
          <view class="form-radio-group">
            <view
              class="radio-item"
              :class="{ active: formData.studentSex === 'M' }"
              @tap="() => handleSexChange('M')"
            >
              <image
                class="radio-icon"
                :src="formData.studentSex === 'M' ? checkedIcon : uncheckedIcon"
              />
              <text>男</text>
            </view>
            <view
              class="radio-item"
              :class="{ active: formData.studentSex === 'F' }"
              @tap="() => handleSexChange('F')"
            >
              <image
                class="radio-icon"
                :src="formData.studentSex === 'F' ? checkedIcon : uncheckedIcon"
              />
              <text>女</text>
            </view>
          </view>
        </view>

        <!-- 年龄 -->
        <view class="form-item">
          <view class="form-label">
            <text class="required">*</text>
            <text>年龄</text>
          </view>
          <view class="form-input">
            <input
              :value="
                formData.studentAge === null || formData.studentAge === undefined
                  ? ''
                  : String(formData.studentAge)
              "
              type="digit"
              placeholder="请输入年龄"
              class="input-field"
              @input="handleAgeInput"
            />
          </view>
        </view>
      </view>

      <!-- 提交按钮 -->
      <view class="btn-container">
        <OnionButton
          size="huge"
          type="default"
          round
          shadow
          :loading="submitting"
          @click="handleSubmit"
          >确认
        </OnionButton>
      </view>
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import Taro, { useRouter } from "@tarojs/taro"
import { createUserBindStudent, getUserBindStudentInfo, getUserBindStudentList } from "@/api/child"
import OnionButton from "@/components/Ui/button/index.vue"
import TabBarLayout from "@/components/TabBarLayout/index.vue"

// 路由信息
const router = useRouter()
const isEdit = computed(() => router.params.mode === "edit")
const childId = computed(() => router.params.id || "")

// 页面状态
const loading = ref(false)
const submitting = ref(false)

// 表单数据
interface FormData {
  id?: string
  studentName: string
  studentIdentityCard: string
  studentSex: string
  studentAge: number | null
}

const formData = ref<FormData>({
  studentName: "",
  studentIdentityCard: "",
  studentSex: "M",
  studentAge: null
})

// 图标资源
const checkedIcon = "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/check32__w.png"
const uncheckedIcon = "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/uncheck32__w.png"

// 表单输入处理函数
const handleNameInput = (e: any) => {
  formData.value.studentName = e.detail.value
}

const handleIdCardInput = (e: any) => {
  formData.value.studentIdentityCard = e.detail.value

  // 当身份证号输入完整时，自动解析年龄
  if (e.detail.value.length === 18 && !isEdit.value && !formData.value.studentAge) {
    parseIdCard(e.detail.value)
  }
}

const handleSexChange = (sex: string) => {
  formData.value.studentSex = sex
}

const handleAgeInput = (e: any) => {
  const value = e.detail.value
  // 只允许输入数字，过滤掉非数字字符
  const numericValue = value.replace(/[^\d]/g, "")
  if (numericValue === "") {
    formData.value.studentAge = null
  } else {
    const age = parseInt(numericValue, 10)
    formData.value.studentAge = isNaN(age) ? null : age
  }
}

// 表单验证
const validateForm = () => {
  if (!formData.value.studentName.trim()) {
    Taro.showToast({
      title: "请输入姓名",
      icon: "none"
    })
    return false
  }

  if (!formData.value.studentSex) {
    Taro.showToast({
      title: "请选择性别",
      icon: "none"
    })
    return false
  }

  if (!formData.value.studentAge) {
    Taro.showToast({
      title: "请输入年龄",
      icon: "none"
    })
    return false
  }

  return true
}

// 解析身份证号
const parseIdCard = (idCard: string) => {
  if (idCard.length !== 18) return

  try {
    // 提取出生日期，计算年龄
    const birthYear = parseInt(idCard.substring(6, 10))
    const birthMonth = parseInt(idCard.substring(10, 12))
    const birthDay = parseInt(idCard.substring(12, 14))

    if (!isNaN(birthYear) && !isNaN(birthMonth) && !isNaN(birthDay)) {
      const birthDate = new Date(birthYear, birthMonth - 1, birthDay)
      const today = new Date()

      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }

      // 自动计算年龄
      if (age > 0 && age < 150) {
        formData.value.studentAge = age
      }
    }
  } catch (error) {
    console.error("解析身份证号失败", error)
  }
}

// 加载营员信息详情（编辑模式）
const loadChildDetail = async () => {
  if (!isEdit.value || !childId.value) return

  loading.value = true
  try {
    const res = await getUserBindStudentInfo(childId.value)
    if (res.info) {
      const info = res.info
      formData.value = {
        id: info.id,
        studentName: info.studentName || "",
        studentIdentityCard: info.studentIdentityCard || "",
        studentSex: info.studentSex || "M",
        studentAge: info.studentAge || null
      }
    }
  } catch (error) {
    console.error("获取营员信息失败:", error)
    Taro.showToast({
      title: "获取信息失败",
      icon: "none"
    })
  } finally {
    loading.value = false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return
  if (!validateForm()) return
  submitting.value = true
  try {
    // 新增模式下，检查数量限制
    if (!isEdit.value) {
      const res = await getUserBindStudentList()
      if (res.list && res.list.length >= 5) {
        Taro.showToast({
          title: "最多添加5个营员",
          icon: "none"
        })
        return
      }
    }

    // 统一使用创建接口，通过是否传id来区分新增还是更新
    await createUserBindStudent({
      id: isEdit.value ? formData.value.id : undefined, // 编辑时传id，新增时不传
      studentName: formData.value.studentName,
      studentIdentityCard: formData.value.studentIdentityCard,
      studentSex: formData.value.studentSex,
      studentAge: formData.value.studentAge || 0
    })

    Taro.showToast({
      title: isEdit.value ? `更新信息成功` : `添加信息成功`,
      icon: "success",
      mask: true
    })

    // 返回上一页
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  } catch (error: any) {
    console.error("提交失败:", error)
    Taro.showToast({
      title: error.message || "操作失败",
      icon: "none"
    })
  } finally {
    submitting.value = false
  }
}

// 页面加载时
onMounted(() => {
  if (isEdit.value) {
    loadChildDetail()
  }
})
</script>

<style lang="less">
.child-form-container {
  min-height: 100%;
  background: #f9f9f9;
  padding: 32rpx;
  position: relative;
}

// 表单内容
.form-content {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 40rpx 32rpx;
  margin-bottom: 40rpx;
}

// 表单项
.form-item {
  margin-bottom: 48rpx;
  display: flex;
  align-items: center;

  &:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: flex;
    align-items: center;
    width: 160rpx;
    font-size: 32rpx;
    color: #393548;
    font-weight: 500;

    .required {
      color: #ff4d4f;
      margin-right: 8rpx;
    }
  }

  .form-input {
    flex: 1;

    .input-field {
      text-align: right;
      width: 100%;
      height: 88rpx;
      font-size: 32rpx;
      color: #504b64;

      &:focus {
        border-color: #4a90e2;
      }

      &::placeholder {
        color: #b8b4c7;
      }
    }
  }
}

// 单选按钮组
.form-radio-group {
  display: flex;
  gap: 48rpx;
  flex: 1;
  justify-content: flex-end;

  .radio-item {
    display: flex;
    align-items: center;

    .radio-icon {
      width: 32rpx;
      height: 32rpx;
      margin-right: 10rpx;
    }

    text {
      font-size: 32rpx;
      color: #504b64;
    }
  }
}

// 提交按钮容器
.btn-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 32rpx;

  .oi-button {
    width: 100%;
  }
}
</style>
