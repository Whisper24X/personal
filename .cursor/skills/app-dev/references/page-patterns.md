# 页面开发模式

Taro + Vue3 页面组件开发规范和示例。

## 页面结构

```
src/pages/
└── user/
    └── profile/
        ├── index.vue        # 页面组件
        └── index.config.ts  # 页面配置
```

## 页面配置

### 基础配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationBarTitleText: "页面标题",
  navigationBarBackgroundColor: "#ffffff",
  navigationBarTextStyle: "black",
  backgroundColor: "#f5f5f5"
})
```

### 自定义导航栏

```typescript
export default definePageConfig({
  navigationStyle: "custom",  // 使用自定义导航栏
  navigationBarTitleText: "个人资料"
})
```

### 下拉刷新

```typescript
export default definePageConfig({
  enablePullDownRefresh: true,
  backgroundTextStyle: "dark"
})
```

## 页面组件模板

### 基础页面

```vue
<template>
  <view class="page-container">
    <NavBar title="页面标题" />
    
    <view class="page-content">
      <view class="section">
        <text class="title">{{ title }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import Taro, { useLoad } from "@tarojs/taro"
import NavBar from "@/components/NavBar/index.vue"

defineOptions({ name: "ExamplePage" })

const title = ref("示例标题")

const fetchData = async () => {
  try {
    Taro.showLoading({ title: "加载中..." })
    // API 调用
  } catch (error) {
    Taro.showToast({ title: "加载失败", icon: "none" })
  } finally {
    Taro.hideLoading()
  }
}

useLoad(() => {
  console.log("页面加载")
  fetchData()
})

onMounted(() => {
  console.log("组件挂载")
})
</script>

<style lang="less">
@import "@/styles/variables.less";

.page-container {
  min-height: 100vh;
  background: @bg-color;
  
  .page-content {
    padding: @spacing-md;
    
    .section {
      background: #fff;
      padding: @spacing-md;
      border-radius: @border-radius-lg;
      
      .title {
        font-size: @font-size-lg;
        color: @text-color;
        font-weight: bold;
      }
    }
  }
}
</style>
```

## 列表页面

### 基础列表

```vue
<template>
  <view class="list-page">
    <NavBar title="列表页" />
    
    <view class="list">
      <view
        v-for="item in list"
        :key="item.id"
        class="list-item"
        @tap="handleItemClick(item)"
      >
        <image :src="item.image" class="item-image" />
        <view class="item-info">
          <text class="item-title">{{ item.title }}</text>
          <text class="item-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>
    
    <EmptyState v-if="!loading && list.length === 0" message="暂无数据" />
    <Loading :visible="loading" />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Taro, { useLoad, usePullDownRefresh } from "@tarojs/taro"
import NavBar from "@/components/NavBar/index.vue"
import EmptyState from "@/components/EmptyState/index.vue"
import Loading from "@/components/Loading/index.vue"
import { getList } from "@/api/example"

defineOptions({ name: "ListPage" })

interface ListItem {
  id: string
  title: string
  desc: string
  image: string
}

const list = ref<ListItem[]>([])
const loading = ref(false)

const fetchList = async () => {
  loading.value = true
  try {
    list.value = await getList()
  } catch (error) {
    Taro.showToast({ title: "加载失败", icon: "none" })
  } finally {
    loading.value = false
  }
}

const handleItemClick = (item: ListItem) => {
  Taro.navigateTo({
    url: `/pages/detail/index?id=${item.id}`
  })
}

useLoad(() => {
  fetchList()
})

// 下拉刷新
usePullDownRefresh(() => {
  fetchList().then(() => {
    Taro.stopPullDownRefresh()
  })
})
</script>

<style lang="less">
@import "@/styles/variables.less";

.list-page {
  min-height: 100vh;
  background: @bg-color;
  
  .list {
    padding: @spacing-md;
    
    .list-item {
      display: flex;
      background: #fff;
      padding: @spacing-md;
      margin-bottom: @spacing-sm;
      border-radius: @border-radius-md;
      
      .item-image {
        width: 120rpx;
        height: 120rpx;
        border-radius: @border-radius-sm;
        margin-right: @spacing-md;
      }
      
      .item-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        
        .item-title {
          font-size: @font-size-lg;
          color: @text-color;
          font-weight: bold;
          .text-ellipsis();
        }
        
        .item-desc {
          font-size: @font-size-sm;
          color: @text-color-secondary;
          .multi-line-ellipsis(2);
        }
      }
    }
  }
}
</style>
```

### 滚动加载

```vue
<script setup lang="ts">
import { ref } from "vue"
import Taro, { useReachBottom } from "@tarojs/taro"

const list = ref<Item[]>([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)

const loadMore = async () => {
  if (loading.value || !hasMore.value) return
  
  loading.value = true
  try {
    const res = await getList({ page: page.value, pageSize: 20 })
    list.value.push(...res.list)
    hasMore.value = res.list.length === 20
    page.value++
  } catch (error) {
    Taro.showToast({ title: "加载失败", icon: "none" })
  } finally {
    loading.value = false
  }
}

useReachBottom(() => {
  loadMore()
})
</script>

<template>
  <view class="list">
    <view v-for="item in list" :key="item.id">
      <!-- 列表项 -->
    </view>
    
    <view v-if="loading" class="loading-more">加载中...</view>
    <view v-else-if="!hasMore" class="no-more">没有更多了</view>
  </view>
</template>
```

## 表单页面

```vue
<template>
  <view class="form-page">
    <NavBar title="编辑资料" />
    
    <view class="form">
      <view class="form-item">
        <text class="label">昵称</text>
        <input
          v-model="formData.nickname"
          class="input"
          placeholder="请输入昵称"
        />
      </view>
      
      <view class="form-item">
        <text class="label">头像</text>
        <image
          :src="formData.avatar || defaultAvatar"
          class="avatar"
          @tap="handleChooseImage"
        />
      </view>
      
      <view class="form-item">
        <text class="label">性别</text>
        <picker
          mode="selector"
          :range="genderOptions"
          :value="formData.gender"
          @change="handleGenderChange"
        >
          <view class="picker">
            {{ genderOptions[formData.gender] }}
          </view>
        </picker>
      </view>
    </view>
    
    <view class="footer">
      <button class="btn-save" @tap="handleSave">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue"
import Taro from "@tarojs/taro"
import NavBar from "@/components/NavBar/index.vue"
import { updateUserInfo } from "@/api/user"
import { uploadAvatar } from "@/api/upload"

defineOptions({ name: "EditProfilePage" })

const defaultAvatar = "https://example.com/default-avatar.png"
const genderOptions = ["保密", "男", "女"]

const formData = reactive({
  nickname: "",
  avatar: "",
  gender: 0
})

const handleChooseImage = async () => {
  const result = await Taro.chooseImage({
    count: 1,
    sizeType: ["compressed"]
  })
  
  // 上传
  const url = await uploadAvatar(result.tempFilePaths[0])
  formData.avatar = url
}

const handleGenderChange = (e: any) => {
  formData.gender = e.detail.value
}

const handleSave = async () => {
  if (!formData.nickname) {
    Taro.showToast({ title: "请输入昵称", icon: "none" })
    return
  }
  
  try {
    await updateUserInfo(formData)
    Taro.showToast({ title: "保存成功", icon: "success" })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  } catch (error) {
    Taro.showToast({ title: "保存失败", icon: "none" })
  }
}
</script>

<style lang="less">
@import "@/styles/variables.less";

.form-page {
  min-height: 100vh;
  background: @bg-color;
  
  .form {
    .form-item {
      display: flex;
      align-items: center;
      background: #fff;
      padding: @spacing-md @spacing-lg;
      border-bottom: 1px solid @border-color;
      
      .label {
        width: 160rpx;
        font-size: @font-size-md;
        color: @text-color;
      }
      
      .input {
        flex: 1;
        font-size: @font-size-md;
      }
      
      .avatar {
        width: 120rpx;
        height: 120rpx;
        border-radius: 50%;
      }
      
      .picker {
        flex: 1;
        text-align: right;
        color: @text-color-secondary;
      }
    }
  }
  
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: @spacing-lg;
    background: #fff;
    .safe-area-bottom();
    
    .btn-save {
      width: 100%;
      height: 88rpx;
      background: @primary-color;
      color: #fff;
      font-size: @font-size-lg;
      border-radius: @border-radius-lg;
    }
  }
}
</style>
```

## TabBar 页面

```vue
<template>
  <TabBarLayout tab-key="home" :show-tab-bar="true">
    <view class="home-page">
      <!-- 页面内容 -->
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import TabBarLayout from "@/components/TabBarLayout/index.vue"

defineOptions({ name: "HomePage" })
</script>
```

## 生命周期

### Taro 生命周期 Hooks

```typescript
import {
  useLoad,
  useDidShow,
  useDidHide,
  useUnload,
  usePullDownRefresh,
  useReachBottom,
  usePageScroll
} from "@tarojs/taro"

// 页面加载
useLoad((options) => {
  console.log("页面加载", options)
})

// 页面显示
useDidShow(() => {
  console.log("页面显示")
})

// 页面隐藏
useDidHide(() => {
  console.log("页面隐藏")
})

// 页面卸载
useUnload(() => {
  console.log("页面卸载")
})

// 下拉刷新
usePullDownRefresh(() => {
  console.log("下拉刷新")
})

// 上拉触底
useReachBottom(() => {
  console.log("上拉触底")
})

// 页面滚动
usePageScroll((e) => {
  console.log("页面滚动", e.scrollTop)
})
```

## 页面跳转

```typescript
import Taro from "@tarojs/taro"

// 保留当前页面，跳转到新页面
Taro.navigateTo({
  url: "/pages/detail/index?id=123"
})

// 关闭当前页面，跳转到新页面
Taro.redirectTo({
  url: "/pages/login/index"
})

// 跳转到 TabBar 页面
Taro.switchTab({
  url: "/pages/index/index"
})

// 返回上一页
Taro.navigateBack({
  delta: 1
})

// 关闭所有页面，跳转到新页面
Taro.reLaunch({
  url: "/pages/index/index"
})
```

## 页面参数

### 传递参数

```typescript
// 传递
Taro.navigateTo({
  url: `/pages/detail/index?id=123&type=product`
})

// 接收
import { useRouter } from "@tarojs/taro"

const router = useRouter()
console.log(router.params.id)     // "123"
console.log(router.params.type)   // "product"
```

### 对象参数

```typescript
// 传递复杂对象
const data = { name: "商品", price: 100 }
Taro.navigateTo({
  url: `/pages/detail/index?data=${encodeURIComponent(JSON.stringify(data))}`
})

// 接收
const router = useRouter()
const data = JSON.parse(decodeURIComponent(router.params.data))
```
