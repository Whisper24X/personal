# 配置优惠券适用商品组件

## 组件概述

`ConfigCouponGoodsDialog` 是优惠券管理模块中用于配置优惠券适用商品的对话框组件。该组件基于首页推荐管理的配置商品功能，但针对优惠券场景进行了优化。

## 功能特性

### 🎯 核心功能
- **商品选择**：从可选商品列表中选择适用于当前优惠券的商品
- **商品移除**：从已选商品列表中移除不需要的商品
- **批量操作**：支持全部添加和全部清除功能
- **搜索筛选**：支持按商品名称、分类等条件搜索

### 🔄 与推荐管理配置商品的差异

#### 移除的功能
- ❌ **排序功能**：移除了上移/下移商品排序操作
- ❌ **排序按钮**：不再显示排序相关的UI控件

#### 新增的功能  
- ✅ **全部添加**：一键添加所有可选商品到适用列表
- ✅ **全部清除**：一键清空已选择的所有商品
- ✅ **批量确认**：批量操作前会显示确认对话框

#### 界面调整
- 🎨 **标题更新**：改为"配置优惠券适用商品"
- 🎨 **左侧标题**：改为"适用商品"而非"已配置商品"
- 🎨 **按钮布局**：在左右两侧分别添加批量操作按钮

## 组件接口

### Props
```typescript
interface Props {
  visible: boolean           // 对话框显示状态
  couponData?: CouponItem   // 当前操作的优惠券数据
}
```

### Events
```typescript
interface Emits {
  'update:visible': (visible: boolean) => void  // 更新显示状态
  'success': () => void                         // 操作成功回调
}
```

## 使用示例

```vue
<template>
  <ConfigCouponGoodsDialog
    v-model:visible="dialogVisible"
    :couponData="selectedCoupon"
    @success="handleSuccess"
  />
</template>

<script setup>
import ConfigCouponGoodsDialog from './components/ConfigCouponGoodsDialog.vue'

const dialogVisible = ref(false)
const selectedCoupon = ref(null)

const handleSuccess = () => {
  // 处理配置成功后的逻辑
  console.log('商品配置成功')
}
</script>
```

## 技术实现

### 数据复用
- 复用推荐管理模块的商品服务 (`getGoodList`, `processGoodListData`)
- 复用商品数据结构 (`GoodItem` 类型)
- 保持与现有商品管理系统的一致性

### 批量操作逻辑
```typescript
// 全部添加：过滤已选商品，批量添加剩余商品
const availableGoodsForAdd = computed(() => {
  return filteredAvailableGoods.value.filter(
    (item) => !isGoodsSelected(item.id)
  )
})

// 全部清除：清空已选商品数组
const handleClearAll = () => {
  selectedGoods.value = []
}
```

### 用户体验优化
- **操作确认**：批量操作前显示确认对话框
- **状态反馈**：操作完成后显示成功消息
- **防重复操作**：已选商品在可选列表中置灰显示
- **响应式设计**：支持不同屏幕尺寸的适配

## 注意事项

1. **API接口**：当前使用模拟数据，实际部署时需要对接真实的优惠券商品配置接口
2. **数据持久化**：商品配置信息需要与后端API同步保存
3. **权限控制**：可根据需要添加用户权限验证
4. **性能优化**：大量商品数据时考虑分页加载或虚拟滚动

## 扩展功能

未来可以考虑添加的功能：
- 商品分类筛选
- 价格区间筛选  
- 商品状态筛选
- 批量导入/导出
- 商品预览功能
