<template>
  <OlSheet :show="show" title="营员信息" @click-close="handleClose">
    <!-- 列表状态 -->
    <view v-if="currentMode === 'list'" class="child-manager">
      <view v-if="childList.length > 0" class="child-list">
        <view v-for="child in childList" :key="child.id" class="child-item">
          <view class="child-info">
            <view class="child-name">{{ child.name }}</view>
            <view class="child-details">
              <text class="gender"
                >{{ child.gender === "男" ? "男" : "女" }} {{ child.age }}岁</text
              >
            </view>
            <view class="child-id">身份证 {{ child.idCard }}</view>
          </view>
          <image
            class="edit-icon"
            src="https://fp.yangcong345.com/middle/1.0.0/yanxue/editInfo__w.png"
            @tap="editChild(child)"
          />
        </view>
      </view>
      <view class="add-child-btn-wrapper">
        <OnionButton
          class="add-child-btn"
          size="huge"
          type="default"
          theme="yellow"
          round
          shadow
          @click="addChild"
        >
          添加营员
        </OnionButton>
      </view>
    </view>

    <!-- 表单状态 -->
    <view v-else-if="currentMode === 'add' || currentMode === 'edit'" class="child-form">
      <view class="form-content">
        <view class="form-item">
          <view class="form-label">姓名<text class="required">*</text></view>
          <input
            v-model="formData.name"
            class="form-input"
            maxlength="15"
            placeholder="请填写"
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
              @tap="formData.gender = sex"
            >
              <OlRadio :checked="formData.gender === sex" />
              <text class="radio-text" :class="{ active: formData.gender === sex }">{{ sex }}</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <view class="form-label">年龄<text class="required">*</text></view>
          <input
            v-model="formData.age"
            class="form-input"
            placeholder="请填写"
            placeholder-class="placeholder"
            type="number"
          />
        </view>
        <view class="form-item">
          <view class="form-label">身份证号</view>
          <input
            :value="formData.idCard"
            class="form-input"
            placeholder="请填写"
            maxlength="18"
            placeholder-class="placeholder"
            @input="handleIdCardInput"
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
          @click="saveChild"
        >
          保存
        </OnionButton>
      </view>
    </view>
  </OlSheet>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from "vue"
import Taro from "@tarojs/taro"
import OlSheet from "@/components/Ui/sheet/index.vue"
import OnionButton from "@/components/Ui/button/index.vue"
import OlRadio from "@/components/OlRadio/index.vue"
import { getUserBindStudentList, createUserBindStudent } from "@/api/child"

interface ChildInfo {
  id: string
  name: string
  gender: string
  age: number
  idCard: string
}

interface Props {
  show: boolean
}

interface Emits {
  (e: "close"): void
  (e: "child-added", child: ChildInfo): void
  (e: "child-updated", child: ChildInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const currentMode = ref<"list" | "add" | "edit">("add")
const childList = ref<ChildInfo[]>([])
const editingChild = ref<ChildInfo | null>(null)
const genders = ["男", "女"]

const formData = reactive({
  name: "",
  gender: "男",
  age: "",
  idCard: ""
})

// 监听弹窗显示状态
watch(
  () => props.show,
  async show => {
    if (show) {
      await loadChildList()
      // 如果没有营员信息，直接进入添加模式
      if (childList.value.length === 0) {
        currentMode.value = "add"
        resetForm()
      } else {
        currentMode.value = "list"
      }
    }
  }
)

// 加载营员列表
const loadChildList = async () => {
  try {
    const res = await getUserBindStudentList()
    if (res.list) {
      childList.value = res.list.map(item => ({
        id: item.id,
        name: item.studentName,
        gender: item.studentSex,
        age: item.studentAge,
        idCard: item.studentIdentityCard
      }))
    }
  } catch (error) {
    console.error("获取营员列表失败", error)
    Taro.showToast({
      title: error.message || "获取数据失败，请重试",
      icon: "none"
    })
  }
}

// 添加营员
const addChild = () => {
  // 检查数量限制
  if (childList.value.length >= 5) {
    Taro.showToast({
      title: "最多添加5个营员",
      icon: "none"
    })
    return
  }
  currentMode.value = "add"
  resetForm()
}

// 处理身份证号输入
const handleIdCardInput = (e: any) => {
  formData.idCard = e.detail.value

  // 当身份证号输入完整时，自动解析年龄（仅在添加模式下）
  if (e.detail.value.length === 18 && currentMode.value === "add" && !formData.age) {
    parseIdCard(e.detail.value)
  }
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

      // 自动设置年龄
      formData.age = age.toString()
    }
  } catch (error) {
    console.error("解析身份证号失败", error)
  }
}

// 编辑营员
const editChild = (child: ChildInfo) => {
  currentMode.value = "edit"
  editingChild.value = child
  formData.name = child.name
  formData.gender = child.gender === "M" ? "男" : "女"
  formData.age = child.age.toString()
  formData.idCard = child.idCard
}

// 重置表单
const resetForm = () => {
  formData.name = ""
  formData.gender = "男"
  formData.age = ""
  formData.idCard = ""
  editingChild.value = null
}

// 保存营员
const saveChild = async () => {
  // 表单验证
  if (!formData.name.trim()) {
    Taro.showToast({
      title: "请输入姓名",
      icon: "none"
    })
    return
  }
  const ageStr = String(formData.age || "")
  if (!ageStr.trim()) {
    Taro.showToast({
      title: "请输入年龄",
      icon: "none"
    })
    return
  }

  // 验证年龄
  const age = parseInt(ageStr)
  if (isNaN(age) || age < 1 || age > 100) {
    Taro.showToast({
      title: "请输入正确的年龄",
      icon: "none"
    })
    return
  }

  try {
    // 转换性别格式
    const genderCode = formData.gender === "男" ? "M" : "F"

    if (currentMode.value === "add") {
      // 添加营员逻辑
      const apiData = {
        studentName: formData.name,
        studentIdentityCard: formData.idCard,
        studentSex: genderCode,
        studentAge: age
      }

      const res = await createUserBindStudent(apiData)

      const newChild: ChildInfo = {
        id: res.id,
        name: formData.name,
        gender: formData.gender,
        age: age,
        idCard: formData.idCard
      }

      childList.value.push(newChild)
      emit("child-added", newChild)

      Taro.showToast({
        title: "添加成功",
        icon: "success"
      })
    } else if (currentMode.value === "edit" && editingChild.value) {
      // 编辑营员逻辑
      const apiData = {
        id: editingChild.value.id,
        studentName: formData.name,
        studentIdentityCard: formData.idCard,
        studentSex: genderCode,
        studentAge: age
      }

      await createUserBindStudent(apiData)

      const updatedChild: ChildInfo = {
        ...editingChild.value,
        name: formData.name,
        gender: formData.gender,
        age: age,
        idCard: formData.idCard
      }

      const index = childList.value.findIndex(child => child.id === editingChild.value!.id)
      if (index !== -1) {
        childList.value[index] = updatedChild
      }

      emit("child-updated", updatedChild)

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
    console.error("保存营员失败", error)
    Taro.showToast({
      title: error.message || "保存失败，请重试",
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
.child-manager {
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #fff;

  .child-list {
    max-height: 800rpx;
    overflow: auto;
    padding: 52rpx 32rpx 40rpx 32rpx;
    display: flex;
    flex-direction: column;
    gap: 32rpx;

    .child-item {
      position: relative;
      border-radius: 18px;
      padding: 24rpx 32rpx;
      background: #f7f7f9;
      display: flex;
      justify-content: space-between;

      .child-info {
        display: flex;
        flex-direction: column;
        gap: 24rpx;
        font-family: PingFang SC;
        font-size: 28rpx;
        color: #3d3d3d;
        .child-name {
          font-size: 32px;
          font-weight: 600;
        }
      }

      .edit-icon {
        position: absolute;
        right: 32rpx;
        top: 72rpx;
        transform: translateY(50%);
        width: 40rpx;
        height: 40rpx;
      }
    }
  }
  .add-child-btn-wrapper {
    border-top: 2rpx solid #efeef3;
    padding: 24rpx 32rpx;
    .add-child-btn {
      width: 100%;
    }
  }
}

.child-form {
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
