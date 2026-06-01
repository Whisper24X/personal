<template>
  <OlSheet :show="show" :title="currentTitle" @click-close="handleClose">
    <!-- 列表状态 -->
    <view v-if="currentMode === 'list'" class="guardian-manager">
      <view v-if="guardianList.length > 0" class="guardian-list">
        <view v-for="guardian in guardianList" :key="guardian.id" class="guardian-item">
          <view class="guardian-info">
            <view class="guardian-name">{{ guardian.parentName }}</view>
            <view class="guardian-phone">手机号 {{ guardian.parentPhone }}</view>
          </view>
          <image
            class="edit-icon"
            src="https://fp.yangcong345.com/middle/1.0.0/yanxue/editInfo__w.png"
            @tap="editGuardian(guardian)"
          />
        </view>
      </view>
      <view class="add-guardian-btn-wrapper">
        <OnionButton
          class="add-guardian-btn"
          size="huge"
          type="default"
          theme="yellow"
          round
          shadow
          @click="addGuardian"
        >
          添加监护人
        </OnionButton>
      </view>
    </view>

    <!-- 表单状态 -->
    <view v-else-if="currentMode === 'add' || currentMode === 'edit'" class="guardian-form">
      <view class="form-content">
        <view class="form-item">
          <view class="form-label">姓名<text class="required">*</text></view>
          <input
            v-model="formData.parentName"
            class="form-input"
            placeholder="请填写"
            maxlength="15"
            placeholder-class="placeholder"
          />
        </view>
        <view class="form-item">
          <view class="form-label">性别<text class="required">*</text></view>
          <view class="radio-group">
            <view
              v-for="sex in genders"
              :key="sex"
              class="radio-option"
              @tap="formData.parentSex = sex"
            >
              <OlRadio :checked="formData.parentSex === sex" />
              <text class="radio-text" :class="{ active: formData.parentSex === sex }">{{
                sex
              }}</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <view class="form-label">手机号<text class="required">*</text></view>
          <input
            v-model="formData.parentPhone"
            class="form-input"
            placeholder="请填写"
            placeholder-class="placeholder"
            type="number"
          />
        </view>
      </view>
      <view class="save-btn-wrapper">
        <OnionButton
          class="save-btn"
          size="huge"
          type="default"
          theme="yellow"
          round
          shadow
          @click="saveGuardian"
        >
          保存
        </OnionButton>
      </view>
    </view>
  </OlSheet>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from "vue"
import Taro from "@tarojs/taro"
import OlSheet from "@/components/Ui/sheet/index.vue"
import OnionButton from "@/components/Ui/button/index.vue"
import OlRadio from "@/components/OlRadio/index.vue"
import { queryParentInfo, storeParentInfo, checkDuplicateParent } from "@/api/parent"
import { genGuid } from "@/utils/upload/index"

interface GuardianInfo {
  id: string
  parentName: string
  parentPhone: string
  parentSex: string
}

interface Props {
  show: boolean
}

interface Emits {
  (e: "close"): void
  (e: "guardian-added", guardian: GuardianInfo): void
  (e: "guardian-updated", guardian: GuardianInfo): void
  (e: "guardian-selected", guardian: GuardianInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const currentMode = ref<"list" | "add" | "edit">("list")
const guardianList = ref<GuardianInfo[]>([])
const editingGuardian = ref<GuardianInfo | null>(null)
const genders = ["男", "女"]

const formData = reactive({
  parentName: "",
  parentSex: "男",
  parentPhone: ""
})

// 计算当前标题
const currentTitle = computed(() => {
  switch (currentMode.value) {
    case "list":
      return "监护人信息"
    case "add":
      return "添加监护人"
    case "edit":
      return "编辑监护人"
    default:
      return "监护人信息"
  }
})

// 监听弹窗显示状态
watch(
  () => props.show,
  async show => {
    if (show) {
      await loadGuardianList()
      // 如果没有监护人信息，直接进入添加模式
      if (guardianList.value.length === 0) {
        currentMode.value = "add"
        resetForm()
      } else {
        currentMode.value = "list"
      }
    }
  }
)

// 加载监护人列表
const loadGuardianList = async () => {
  try {
    const res = await queryParentInfo()
    if (res.parentInfo) {
      guardianList.value = res.parentInfo
    }
  } catch (error) {
    console.error("获取监护人列表失败", error)
    Taro.showToast({
      title: "获取数据失败，请重试",
      icon: "none"
    })
  }
}

// 添加监护人
const addGuardian = () => {
  // 检查数量限制
  if (guardianList.value.length >= 5) {
    Taro.showToast({
      title: "最多添加5个监护人",
      icon: "none"
    })
    return
  }
  currentMode.value = "add"
  resetForm()
}

// 编辑监护人
const editGuardian = (guardian: GuardianInfo) => {
  currentMode.value = "edit"
  editingGuardian.value = guardian
  formData.parentName = guardian.parentName
  formData.parentSex = guardian.parentSex === "M" ? "男" : "女"
  formData.parentPhone = guardian.parentPhone.toString()
}

// 重置表单
const resetForm = () => {
  formData.parentName = ""
  formData.parentSex = "男"
  formData.parentPhone = ""
  editingGuardian.value = null
}

// 保存监护人
const saveGuardian = async () => {
  // 表单验证
  if (!formData.parentName.trim()) {
    Taro.showToast({
      title: "请输入姓名",
      icon: "none"
    })
    return
  }

  const parentPhoneStr = String(formData.parentPhone || "")
  if (!parentPhoneStr.trim()) {
    Taro.showToast({
      title: "请输入手机号",
      icon: "none"
    })
    return
  }

  // 验证手机号格式
  if (!/^1\d{10}$/.test(formData.parentPhone)) {
    Taro.showToast({
      title: "请输入正确的手机号",
      icon: "none"
    })
    return
  }

  try {
    // 转换性别格式
    const genderCode = formData.parentSex === "男" ? "M" : "F"

    const guardianData: GuardianInfo = {
      id:
        currentMode.value === "edit" && editingGuardian.value
          ? editingGuardian.value.id
          : genGuid(),
      parentName: formData.parentName,
      parentSex: genderCode,
      parentPhone: formData.parentPhone.toString()
    }

    if (currentMode.value === "add") {
      // 检查重复
      if (checkDuplicateParent(guardianData, guardianList.value)) {
        Taro.showToast({
          title: "手机号已存在",
          icon: "none"
        })
        return
      }

      // 添加监护人逻辑
      const newGuardianList = [...guardianList.value, guardianData]
      await storeParentInfo({ parentInfo: newGuardianList })

      guardianList.value = newGuardianList
      emit("guardian-added", guardianData)

      Taro.showToast({
        title: "添加成功",
        icon: "success"
      })
    } else if (currentMode.value === "edit" && editingGuardian.value) {
      // 检查重复（排除当前编辑的监护人）
      if (
        checkDuplicateParent(guardianData, guardianList.value, editingGuardian.value.parentPhone)
      ) {
        Taro.showToast({
          title: "手机号已存在",
          icon: "none"
        })
        return
      }

      // 编辑监护人逻辑
      const updatedGuardianList = guardianList.value.map(guardian =>
        guardian.id === editingGuardian.value!.id ? guardianData : guardian
      )

      await storeParentInfo({ parentInfo: updatedGuardianList })

      guardianList.value = updatedGuardianList
      emit("guardian-updated", guardianData)

      Taro.showToast({
        title: "更新成功",
        icon: "success",
        mask: true
      })
    }

    // 返回列表状态
    currentMode.value = "list"
    resetForm()
  } catch (error) {
    console.error("保存监护人失败", error)
    Taro.showToast({
      title: "保存失败，请重试",
      icon: "none"
    })
  }
}

// 关闭弹窗
const handleClose = () => {
  currentMode.value = "list"
  resetForm()
  emit("close")
}
</script>

<style lang="less">
.guardian-manager {
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #fff;

  .guardian-list {
    max-height: 800rpx;
    overflow: auto;
    padding: 52rpx 32rpx 40rpx 32rpx;
    display: flex;
    flex-direction: column;
    gap: 32rpx;

    .guardian-item {
      position: relative;
      border-radius: 18px;
      padding: 24rpx 32rpx;
      background: #f7f7f9;
      display: flex;
      justify-content: space-between;

      .guardian-info {
        display: flex;
        flex-direction: column;
        gap: 24rpx;
        font-family: PingFang SC;
        font-size: 28rpx;
        color: #3d3d3d;
        .guardian-name {
          font-size: 32px;
          font-weight: 600;
        }
      }

      .edit-icon {
        position: absolute;
        right: 32rpx;
        top: 81rpx;
        transform: translateY(-50%);
        width: 40rpx;
        height: 40rpx;
      }
    }
  }
  .add-guardian-btn-wrapper {
    border-top: 2rpx solid #efeef3;
    padding: 24rpx 32rpx;
    .add-guardian-btn {
      width: 100%;
    }
  }
}

.guardian-form {
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #fff;

  .form-content {
    padding: 48rpx 32rpx 46rpx 32rpx;
    .form-item {
      padding: 32rpx 0;
      border-bottom: 1px solid #efeef3;
      display: flex;
      gap: 80rpx;
      align-items: center;

      .form-label {
        width: 156px;
        font-family: PingFang SC;
        font-size: 28px;
        font-weight: normal;
        line-height: 28px;
        color: #848096;
        .required {
          color: #fa5a65;
        }
      }

      .form-input {
        flex: 1;
        height: 32rpx;
        font-family: PingFang SC;
        font-size: 28px;
        line-height: 28px;
        color: #393548;

        .placeholder {
          color: #848096;
        }
      }

      .radio-group {
        display: flex;
        align-items: center;
        gap: 48rpx;
        .radio-option {
          display: inline-flex;
          align-items: center;
          gap: 12rpx;
        }
        .radio-text {
          font-family: PingFang SC;
          font-size: 28px;
          line-height: 28px;
          color: #848096;

          &.active {
            color: #393548;
          }
        }
      }
      &:first-child {
        padding-top: 0;
      }
    }
  }
  .save-btn-wrapper {
    border-top: 2rpx solid #efeef3;
    padding: 24rpx 32rpx;
    .save-btn {
      width: 100%;
    }
  }
}
</style>
