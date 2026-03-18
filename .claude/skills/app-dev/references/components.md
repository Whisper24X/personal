# 组件库

ainative-app 内置组件库完整文档。

## 组件规范

- **组件目录**：PascalCase（如 `CustomNavBar`）
- **UI 基础组件前缀**：`oi-`（Onion UI），如 `oi-button`、`oi-modal`
- **CSS 类名**：BEM，如 `oi-button__theme__yellow`、`oi-modal__header`
- **样式**：组件样式默认全局（无 scoped），通过 BEM 避免冲突

## 布局组件

### CustomNavBar 导航栏

自定义导航栏，支持 light/dark 主题、返回、右侧按钮。

```vue
<template>
  <CustomNavBar title="页面标题" :show-back="true" @back="handleBack" />
</template>

<script setup lang="ts">
import CustomNavBar from '@/components/CustomNavBar/index.vue';

const handleBack = () => {
  // 自定义返回逻辑，默认 navigateBack
};
</script>
```

**Props**:

- `title` (string): 标题文字
- `showBack` (boolean): 是否显示返回按钮，默认 `true`

**Events**:

- `back`: 点击返回按钮触发

---

### TabBar 底部导航

自定义 TabBar 组件。

```vue
<template>
  <TabBar :tab-list="tabList" />
</template>

<script setup lang="ts">
import TabBar from '@/components/TabBar/index.vue';

const tabList = [
  {
    key: 'home',
    title: '首页',
    icon: '🏠',
    pagePath: '/pages/index/index',
  },
  {
    key: 'user',
    title: '我的',
    icon: '👤',
    pagePath: '/pages/user/profile/index',
  },
];
</script>
```

**Props**:

- `tabList` (TabItem[]): TabBar 配置

**TabItem 结构**:

```typescript
interface TabItem {
  key: string; // 唯一标识
  title: string; // 标题
  icon: string; // 图标（emoji 或图片 URL）
  pagePath: string; // 页面路径
}
```

---

### TabBarLayout 布局容器

TabBar 页面的布局容器，自动处理安全区域和 TabBar 高度。

```vue
<template>
  <TabBarLayout tab-key="home" :show-tab-bar="true">
    <view class="page-content">
      <!-- 页面内容 -->
    </view>
  </TabBarLayout>
</template>

<script setup lang="ts">
import TabBarLayout from '@/components/TabBarLayout/index.vue';
</script>
```

**Props**:

- `tabKey` (string): 当前 Tab 的 key，必填
- `showTabBar` (boolean): 是否显示 TabBar，默认 `true`

---

### StatusBar 状态栏

状态栏占位组件，用于适配刘海屏。

```vue
<template>
  <view class="page">
    <StatusBar />
    <view class="custom-navbar">
      <!-- 自定义导航栏内容 -->
    </view>
  </view>
</template>

<script setup lang="ts">
import StatusBar from '@/components/StatusBar.vue';
</script>
```

---

## 反馈组件

### Loading 加载

全屏加载组件。

```vue
<template>
  <view>
    <button @tap="showLoading">显示加载</button>
    <Loading :visible="loading" text="加载中..." />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Loading from '@/components/Loading/index.vue';

const loading = ref(false);

const showLoading = () => {
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
  }, 2000);
};
</script>
```

**Props**:

- `visible` (boolean): 是否显示，必填
- `text` (string): 加载文字，默认 "加载中..."

---

### OiModal 模态框（`Ui/modal/index.vue`）

确认/提示模态框，支持 v-model、双按钮、辅助按钮。

```vue
<template>
  <OiModal
    v-model:visible="showModal"
    title="提示"
    content="确定要取消预约吗？"
    left-button-text="再想想"
    right-button-text="确定取消"
    @right-button-click="handleConfirm"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import OiModal from '@/components/Ui/modal/index.vue';

const showModal = ref(false);

const handleConfirm = () => {
  showModal.value = false;
};
</script>
```

**Props**:

| Prop                  | 类型    | 默认值   | 说明                     |
| --------------------- | ------- | -------- | ------------------------ |
| `visible`             | boolean | —        | 是否显示（v-model）      |
| `title`               | string  | `""`     | 标题（空则不渲染标题栏） |
| `content`             | string  | `""`     | 内容（支持 `\n` 换行）   |
| `maskClickClose`      | boolean | `true`   | 点击蒙层关闭             |
| `maskShow`            | boolean | `true`   | 是否显示蒙层             |
| `zIndex`              | number  | `999`    | 层级                     |
| `leftButton`          | boolean | `true`   | 显示左按钮               |
| `leftButtonText`      | string  | `"取消"` | 左按钮文字               |
| `rightButton`         | boolean | `true`   | 显示右按钮               |
| `rightButtonText`     | string  | `"确定"` | 右按钮文字               |
| `subButton`           | boolean | `false`  | 底部辅助按钮             |
| `buttonGroupVertical` | boolean | `false`  | 按钮组竖向排列           |
| `closeIcon`           | boolean | `false`  | 显示右上角关闭图标       |

**Emits**: `update:visible`、`close(type)`、`leftButtonClick`、`rightButtonClick`、`subButtonClick`

---

### Toast 提示

轻量级提示组件。

```vue
<template>
  <view>
    <button @tap="showToast">显示提示</button>
    <Toast :visible="toastVisible" message="操作成功" type="success" @close="toastVisible = false" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Toast from '@/components/Toast/index.vue';

const toastVisible = ref(false);

const showToast = () => {
  toastVisible.value = true;
  setTimeout(() => {
    toastVisible.value = false;
  }, 2000);
};
</script>
```

**Props**:

- `visible` (boolean): 是否显示，必填
- `message` (string): 提示信息
- `type` ('success' | 'error' | 'info'): 类型，默认 'info'
- `duration` (number): 显示时长（毫秒），默认 2000

**Events**:

- `close`: 关闭时触发

**推荐使用 Taro.showToast**：

```typescript
Taro.showToast({
  title: '操作成功',
  icon: 'success',
  duration: 2000,
});
```

---

### EmptyState 空状态

无数据展示组件。

```vue
<template>
  <view>
    <view v-if="list.length > 0">
      <!-- 列表内容 -->
    </view>
    <EmptyState v-else message="暂无数据" />
  </view>
</template>

<script setup lang="ts">
import EmptyState from '@/components/EmptyState/index.vue';
</script>
```

**Props**:

- `message` (string): 提示信息，默认 "暂无数据"
- `image` (string): 自定义图片

---

## UI 基础组件

### OiButton 按钮（`Ui/button/index.vue`）

```vue
<template>
  <OiButton type="default" theme="yellow" size="medium" round @click="handleClick"> 立即预约 </OiButton>
</template>

<script setup lang="ts">
import OiButton from '@/components/Ui/button/index.vue';

const handleClick = () => {
  /* ... */
};
</script>
```

**Props 速查**:

| Prop          | 类型                                              | 默认值    | 说明                        |
| ------------- | ------------------------------------------------- | --------- | --------------------------- |
| `type`        | `default \| link \| hollow`                       | `default` | 按钮类型                    |
| `theme`       | `yellow \| blue \| red \| white \| dark`          | `yellow`  | 颜色主题（仅 default 生效） |
| `size`        | `huge \| large \| medium \| small`                | `medium`  | 尺寸                        |
| `round`       | boolean                                           | `false`   | 圆角（50rpx）               |
| `circle`      | boolean                                           | `false`   | 圆形                        |
| `disabled`    | boolean                                           | `false`   | 禁用                        |
| `inline`      | boolean                                           | `true`    | inline-block；false 为块级  |
| `shadow`      | boolean                                           | `false`   | 内阴影                      |
| `showArrow`   | boolean                                           | `false`   | 右侧箭头                    |
| `transparent` | boolean                                           | `false`   | 透明背景                    |
| `borderColor` | `white \| red \| blue \| black \| gray \| yellow` | `""`      | 边框颜色（hollow）          |
| `icon`        | string                                            | `""`      | 左侧图标文字                |

**Emits**: `click`、`disabledClick`

**尺寸对应**: huge(20/30rpx, 36rpx) / large(18/28rpx, 32rpx) / medium(16/24rpx, 32rpx) / small(12/20rpx, 24rpx)

---

### OiSheet 底部抽屉（`Ui/sheet/index.vue`）

```vue
<template>
  <OiSheet title="选择课程" :show="showSheet" safe-area @click-close="showSheet = false">
    <!-- 内容 -->
  </OiSheet>
</template>
```

**Props**:

| Prop             | 类型    | 默认值  | 说明             |
| ---------------- | ------- | ------- | ---------------- |
| `title`          | string  | —       | 标题（必填）     |
| `show`           | boolean | —       | 是否显示（必填） |
| `safeArea`       | boolean | `false` | 底部安全区       |
| `maskClickClose` | boolean | `true`  | 点蒙层关闭       |

**Slots**: 默认（内容）、`top`（遮罩上方）、`contain`（配合 top）

**动画**: 下方滑入，200ms ease

---

### OiTabs 标签页（`Ui/tabs/index.vue` + `tab-item.vue`）

```vue
<template>
  <OiTabs v-model="activeTab" type="normal">
    <OiTabItem value="all">全部</OiTabItem>
    <OiTabItem value="pending">待处理</OiTabItem>
  </OiTabs>
</template>
```

**Tabs Props**:

| Prop         | 类型                        | 默认值   | 说明                    |
| ------------ | --------------------------- | -------- | ----------------------- |
| `modelValue` | string \| number            | `""`     | 当前激活值（v-model）   |
| `type`       | 见下表                      | `normal` | 样式类型                |
| `tabAlign`   | `left \| center \| between` | `left`   | 对齐方式                |
| `size`       | `medium \| small`           | `medium` | 字号                    |
| `bend`       | boolean                     | `false`  | 弯曲下划线（仅 normal） |

**type 类型**: `normal`（下划线）、`round`（圆角胶囊）、`card`、`purple-card`、`dark-capsule`、`purple-capsule`、`bubble`、`light-bubble`

---

## 业务通用组件

| 组件                 | 路径                  | 功能说明                             |
| -------------------- | --------------------- | ------------------------------------ |
| CustomNavBar         | CustomNavBar/         | 自定义导航栏，light/dark 主题        |
| TabBar               | TabBar/               | 自定义底部 TabBar（4 Tab，含安全区） |
| TabBarLayout         | TabBarLayout/         | TabBar 页面布局容器                  |
| EmptyState           | EmptyState/           | 空状态（图片、标题、描述、CTA）      |
| Loading              | Loading/              | 加载状态                             |
| InfoCard             | InfoCard/             | 白色圆角卡片容器                     |
| InfoRow              | InfoRow/              | 信息行（标签 + 内容）                |
| Modal                | Modal/                | 业务级弹窗（基于 OiModal）           |
| ConfirmModal         | ConfirmModal.vue      | 确认对话框                           |
| ImageUploader        | ImageUploader/        | 图片上传（含 Advanced）              |
| ImagePreview         | ImagePreview/         | 图片预览                             |
| ProductList          | ProductList/          | 商品列表                             |
| Coupon               | Coupon/               | 优惠券卡片                           |
| FilterDropdown       | FilterDropdown/       | 筛选下拉                             |
| TabWithTags          | TabWithTags/          | Tabs + 标签筛选组合                  |
| NoMoreData           | NoMoreData/           | 列表底部「没有更多了」               |
| AspectRatioImage     | AspectRatioImage/     | 保持宽高比图片                       |
| SuperImage           | SuperImage/           | 增强版图片（懒加载）                 |
| PromoBanner          | PromoBanner/          | 促销 Banner                          |
| GroupQrCode          | GroupQrCode/          | 群二维码                             |
| CustomerServiceModal | CustomerServiceModal/ | 客服弹窗                             |
| AgreementCheckbox    | AgreementCheckbox/    | 协议勾选框                           |
| OlCheckbox           | OlCheckbox/           | 自定义 Checkbox                      |
| OlRadio              | OlRadio/              | 自定义 Radio                         |
| StatusBar            | StatusBar.vue         | 状态栏占位                           |
| EnvIndicator         | EnvIndicator.vue      | 环境标识（非生产显示）               |
| FixedBottomBar       | FixedBottomBar.vue    | 固定底部操作栏                       |

---

## 组件使用最佳实践

### ✅ 推荐

```vue
<!-- 1. 导入组件 -->
<script setup lang="ts">
import CustomNavBar from '@/components/CustomNavBar/index.vue';
import Loading from '@/components/Loading/index.vue';
</script>

<!-- 2. 使用 v-if 控制显示 -->
<template>
  <EmptyState v-if="!loading && list.length === 0" />
</template>

<!-- 3. 完整的事件处理 -->
<template>
  <OiModal v-model:visible="modalVisible" @right-button-click="handleConfirm" @left-button-click="handleCancel" />
</template>
```

### ❌ 避免

```vue
<!-- 1. 避免不必要的组件嵌套 -->
<view>  <!-- ❌ 多余的包裹 -->
  <CustomNavBar title="标题" />
</view>

<!-- 2. 避免不完整的事件处理 -->
<OiModal
  :visible="modalVisible"
  @right-button-click="modalVisible = false"  <!-- ❌ 没有业务逻辑 -->
/>
```

## 自定义组件

### 基础模板

```vue
<template>
  <view class="my-component">
    <text>{{ title }}</text>
  </view>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

defineOptions({ name: 'MyComponent' });

interface Props {
  title: string;
  count?: number;
}

interface Emits {
  (e: 'change', value: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
});

const emit = defineEmits<Emits>();

const handleClick = () => {
  emit('change', props.count + 1);
};
</script>

<style lang="less">
@import '@/styles/variables.less';

.my-component {
  padding: @spacing-md;
  background: #fff;
}
</style>
```

## 组件通信

### Props 传递

```vue
<!-- 父组件 -->
<template>
  <ChildComponent :user="userInfo" />
</template>

<!-- 子组件 -->
<script setup lang="ts">
interface Props {
  user: UserInfo;
}

const props = defineProps<Props>();
</script>
```

### Events 触发

```vue
<!-- 子组件 -->
<script setup lang="ts">
interface Emits {
  (e: 'update', value: string): void;
}

const emit = defineEmits<Emits>();
emit('update', 'new value');
</script>

<!-- 父组件 -->
<template>
  <ChildComponent @update="handleUpdate" />
</template>
```

### Provide/Inject

```vue
<!-- 父组件 -->
<script setup lang="ts">
import { provide } from 'vue';

provide('theme', 'dark');
</script>

<!-- 子组件 -->
<script setup lang="ts">
import { inject } from 'vue';

const theme = inject<string>('theme');
</script>
```
