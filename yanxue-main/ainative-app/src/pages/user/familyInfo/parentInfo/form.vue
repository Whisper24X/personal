<template>
  <TabBarLayout
    tab-key="parent"
    :show-tab-bar="false"
    :show-custom-nav-bar="true"
    :nav-bar-config="{
      title: isEdit ? '编辑监护人信息' : '添加监护人信息'
    }"
  >
    <view class="parent-form-container">
      <view class="form-content">
        <!-- 监护人姓名 -->
        <view class="form-item">
          <view class="form-label">
            <text class="required">*</text>
            <text>监护人姓名</text>
          </view>
          <view class="form-input">
            <input
              :value="formData.parentName"
              type="text"
              placeholder="请输入监护人姓名"
              class="input-field"
              @input="handleNameInput"
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
              :class="{ active: formData.parentSex === 'M' }"
              @tap="() => handleSexChange('M')"
            >
              <image
                class="radio-icon"
                :src="formData.parentSex === 'M' ? checkedIcon : uncheckedIcon"
              />
              <text>男</text>
            </view>
            <view
              class="radio-item"
              :class="{ active: formData.parentSex === 'F' }"
              @tap="() => handleSexChange('F')"
            >
              <image
                class="radio-icon"
                :src="formData.parentSex === 'F' ? checkedIcon : uncheckedIcon"
              />
              <text>女</text>
            </view>
          </view>
        </view>

        <!-- 手机号 -->
        <view class="form-item">
          <view class="form-label">
            <text class="required">*</text>
            <text>手机号</text>
          </view>
          <view class="form-input">
            <input
              :value="formData.parentPhone"
              type="number"
              placeholder="请输入手机号"
              maxlength="11"
              class="input-field"
              @input="handlePhoneInput"
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
        >
          确认
        </OnionButton>
      </view>
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue"
import Taro, { useRouter } from "@tarojs/taro"
import TabBarLayout from "../../../../components/TabBarLayout/index.vue"
import OnionButton from "../../../../components/Ui/button/index.vue"
import { queryParentInfo, storeParentInfo, checkDuplicateParent } from "@/api/parent"
import { genGuid } from "@/utils/upload/index"

// 表单数据接口
interface ParentFormData {
  parentName: string
  parentSex: string
  parentPhone: string
}

// 获取路由参数
const router = useRouter()
const mode = router.params.mode as string
const parentId = router.params.id as string
const isEdit = computed(() => mode === "edit")

// 表单数据
const formData = reactive<ParentFormData>({
  parentName: "",
  parentSex: "",
  parentPhone: ""
})

// 状态
const submitting = ref(false)

// 图标
const checkedIcon = "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/check32__w.png"
const uncheckedIcon = "https://fp.yangcong345.com/middle/1.0.0/yanxueImg/uncheck32__w.png"

// 处理姓名输入
const handleNameInput = (e: any) => {
  formData.parentName = e.detail.value
}

// 处理性别选择
const handleSexChange = (sex: string) => {
  formData.parentSex = sex
}

// 处理手机号输入
const handlePhoneInput = (e: any) => {
  formData.parentPhone = e.detail.value
}

// 表单验证
const validateForm = () => {
  if (!formData.parentName.trim()) {
    Taro.showToast({
      title: "请输入监护人姓名",
      icon: "none"
    })
    return false
  }

  if (!formData.parentSex) {
    Taro.showToast({
      title: "请选择性别",
      icon: "none"
    })
    return false
  }

  if (!formData.parentPhone.trim()) {
    Taro.showToast({
      title: "请输入手机号",
      icon: "none"
    })
    return false
  }

  // 手机号格式验证
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(formData.parentPhone)) {
    Taro.showToast({
      title: "请输入正确的手机号",
      icon: "none"
    })
    return false
  }

  return true
}

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return
  if (!validateForm()) return

  try {
    submitting.value = true

    // 获取现有的监护人列表
    const res = await queryParentInfo()
    let parentInfoList = res.parentInfo || []

    // 准备要保存的监护人信息
    const newParentInfo = {
      id: isEdit.value ? parentId : genGuid(),
      parentName: formData.parentName,
      parentSex: formData.parentSex,
      parentPhone: formData.parentPhone
    }

    // 检查是否存在重复的监护人（手机号相同）
    const isDuplicate = checkDuplicateParent(
      newParentInfo,
      parentInfoList,
      isEdit.value ? parentId : undefined
    )

    if (isDuplicate) {
      Taro.showToast({
        title: "已存在相同手机号的监护人",
        icon: "none"
      })
      return
    }

    if (isEdit.value) {
      // 编辑模式：更新指定监护人信息
      const index = parentInfoList.findIndex(p => p.id === parentId)
      if (index >= 0) {
        parentInfoList[index] = newParentInfo
      }
    } else {
      // 新增模式：检查数量限制
      if (parentInfoList.length >= 5) {
        Taro.showToast({
          title: "最多添加5个监护人",
          icon: "none"
        })
        return
      }
      // 添加新的监护人信息
      parentInfoList.push(newParentInfo)
    }

    // 保存更新后的列表
    await storeParentInfo({
      parentInfo: parentInfoList
    })

    Taro.showToast({
      title: isEdit.value ? "更新成功" : "保存成功",
      icon: "success",
      mask: true
    })

    // 延迟返回上一页
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  } catch (error) {
    console.error("保存监护人信息失败", error)
    Taro.showToast({
      title: "保存失败，请重试",
      icon: "none"
    })
  } finally {
    submitting.value = false
  }
}

// 加载监护人信息（编辑模式）
const loadParentInfo = async () => {
  if (!isEdit.value) return

  try {
    const res = await queryParentInfo()
    if (res.parentInfo && res.parentInfo.length > 0) {
      const parentInfo = res.parentInfo.find(p => p.id === parentId)

      if (parentInfo) {
        formData.parentName = parentInfo.parentName
        formData.parentSex = parentInfo.parentSex
        formData.parentPhone = parentInfo.parentPhone
      }
    }
  } catch (error) {
    console.error("加载监护人信息失败", error)
    Taro.showToast({
      title: "加载数据失败，请重试",
      icon: "none"
    })
  }
}

// 初始化
onMounted(() => {
  loadParentInfo()
})
</script>

<style lang="less">
.parent-form-container {
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
    width: 200rpx;
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
