# 新建优惠券对话框组件

## 组件概述

`CreateCouponDialog` 是优惠券管理模块中用于创建新优惠券的对话框组件。该组件提供了完整的优惠券创建流程，包括所有必要的字段配置和验证。

## 功能特性

### 🎯 核心功能
- **完整表单**：包含优惠券创建所需的所有字段
- **动态验证**：根据用户选择动态调整验证规则
- **条件显示**：根据选择项显示/隐藏相关输入字段
- **商品配置**：选择商品券时可配置适用商品

### 📝 表单字段

#### 必填字段（带 * 标记）
1. **名称**：优惠券名称
   - 支持汉字、数字、字母输入
   - 长度不超过20个字符
   - 正则验证：`/^[\u4e00-\u9fa5a-zA-Z0-9]+$/`

2. **优惠金额**：优惠券减免金额
   - 支持数字输入
   - 长度不超过6位
   - 用于结算页面减去

3. **推送方式**：二选一单选框
   - 公开推送：用户可在小程序优惠券页面领取
   - 私密推送：生成二维码供扫码领取

4. **券类型**：二选一单选框
   - 通用券：适用于所有商品
   - 商品券：仅适用于指定商品（触发商品配置功能）

5. **门槛**：二选一单选框
   - 无门槛：无使用限制
   - 有门槛：需输入门槛金额

6. **使用时间**：二选一单选框
   - 绝对时间：输入具体有效期（开始时间-结束时间）
   - 领取后几天内使用：输入有效天数

7. **领取时间**：二选一单选框
   - 不限时：随时可领取
   - 限时：设置领取时间范围

8. **投放张数**：优惠券总发放数量
   - 支持数字输入
   - 长度不超过8位

9. **每人限领**：单用户最大领取数量
   - 支持数字输入
   - 长度不超过2位

#### 可选字段
- **备注**：额外说明信息
  - 支持汉字、数字、字母输入
  - 长度不超过200个字符

### 🔄 动态交互逻辑

#### 券类型选择
```typescript
// 选择商品券时显示配置商品按钮
if (formData.type === '商品券') {
  // 显示配置商品按钮
  // 显示已选商品数量提示
}
```

#### 门槛设置
```typescript
// 选择有门槛时显示金额输入框
if (formData.thresholdType === '有门槛') {
  // 显示门槛金额输入框
  // 添加必填验证规则
}
```

#### 使用时间配置
```typescript
// 根据选择显示不同的时间输入方式
if (formData.useTimeType === '绝对时间') {
  // 显示开始时间和结束时间选择器
} else {
  // 显示天数输入框
}
```

#### 领取时间配置
```typescript
// 限时领取时显示时间范围选择
if (formData.receiveTimeType === '限时') {
  // 显示领取开始时间和结束时间选择器
}
```

## 验证规则

### 静态验证规则
```typescript
const formRules = {
  name: [
    { required: true, message: '请输入优惠券名称', trigger: 'blur' },
    { min: 1, max: 20, message: '长度在 1 到 20 个字符', trigger: 'blur' },
    { pattern: /^[\u4e00-\u9fa5a-zA-Z0-9]+$/, message: '只能输入汉字、数字、字母', trigger: 'blur' }
  ],
  amount: [
    { required: true, message: '请输入优惠金额', trigger: 'blur' },
    { pattern: /^\d{1,6}$/, message: '请输入1-6位数字', trigger: 'blur' }
  ]
  // ... 其他规则
}
```

### 动态验证规则
根据用户选择动态添加的验证规则：
- 门槛金额（选择有门槛时）
- 绝对时间（选择绝对时间时）
- 相对天数（选择领取后几天内使用时）
- 领取时间范围（选择限时时）

## 组件接口

### Props
```typescript
interface Props {
  visible: boolean  // 对话框显示状态
}
```

### Events
```typescript
interface Emits {
  'update:visible': (visible: boolean) => void  // 更新显示状态
  'success': () => void                         // 创建成功回调
}
```

## 使用示例

```vue
<template>
  <CreateCouponDialog
    v-model:visible="createDialogVisible"
    @success="handleCreateSuccess"
  />
</template>

<script setup>
import CreateCouponDialog from './components/CreateCouponDialog.vue'

const createDialogVisible = ref(false)

const handleCreateSuccess = () => {
  // 处理创建成功后的逻辑
  console.log('优惠券创建成功')
  // 刷新列表等操作
}

const openCreateDialog = () => {
  createDialogVisible.value = true
}
</script>
```

## 技术实现

### 响应式表单管理
- 使用 `reactive` 管理表单数据
- 动态更新验证规则
- 实时清理无关字段数据

### 商品配置集成
- 复用 `ConfigCouponGoodsDialog` 组件
- 选择商品券时显示配置按钮
- 记录已选商品数量状态

### 数据处理
```typescript
// 提交时数据转换
const submitData = {
  ...formData,
  threshold: formData.thresholdType === '无门槛' ? '无门槛' : `${formData.thresholdAmount}元`,
  useStartTime: formData.useTimeType === '绝对时间' ? formData.absoluteStartTime : '',
  // ... 其他字段转换
}
```

## 用户体验设计

### 视觉反馈
- 字段输入限制和计数显示
- 选择项切换的平滑过渡
- 加载状态和错误提示

### 操作流程
1. 填写基础信息（名称、金额等）
2. 选择投放和券类型
3. 配置使用和领取规则
4. 商品券时配置适用商品
5. 提交创建

### 错误处理
- 表单验证失败时的错误提示
- 网络请求失败的重试机制
- 用户取消操作的状态重置

## 注意事项

1. **数据持久化**：表单数据需要与后端API同步保存
2. **时间格式**：时间选择器格式为 `YYYY-MM-DD HH:mm:ss`
3. **商品关联**：商品券需要保存与商品的关联关系
4. **状态管理**：新建的优惠券默认为下架状态
5. **日志记录**：需要记录创建操作到操作日志

## 扩展功能

未来可以考虑添加的功能：
- 优惠券模板功能
- 批量创建优惠券
- 预览功能（生成二维码预览）
- 定时发布功能
- 优惠券规则预设
