# 配置商品对话框组件

## 功能概述
该组件用于为推荐分类配置关联的商品，采用左右分栏布局，提供直观的商品选择和管理界面。

## 界面设计

### 整体布局
- **对话框标题**: 配置推荐商品-{分类名称}
- **双栏布局**: 左侧显示已配置商品，右侧显示可选商品
- **底部操作**: 显示商品总数，提供取消和保存按钮

### 左侧：已配置商品区域
- **标题**: 已配置商品 (数量)
- **商品列表**: 
  - 商品图片（60x60px）
  - 商品名称
  - 商品价格（¥格式，橙色显示）
  - 操作按钮：展开/收起、删除
- **空状态**: 暂无已配置商品的提示

### 右侧：可选商品区域
- **标题栏**: 可选商品 + 搜索框
- **搜索功能**: 支持按商品名称、分类、描述搜索
- **商品列表**:
  - 商品图片（60x60px）
  - 商品名称
  - 商品价格（¥格式，橙色显示）
  - 添加按钮（蓝色圆形+按钮）
- **状态管理**: 已选中的商品显示为禁用状态

## 主要功能

### 1. 商品搜索
- **实时搜索**: 输入关键词即时筛选商品
- **多字段匹配**: 支持商品名称、分类、描述模糊搜索
- **清空搜索**: 一键清空搜索条件

### 2. 商品选择
- **添加商品**: 点击右侧商品的+按钮添加到左侧
- **移除商品**: 点击左侧商品的删除按钮移除
- **重复检测**: 防止重复添加同一商品
- **确认删除**: 删除商品前弹出确认对话框

### 3. 商品展示
- **图片展示**: 商品图片预览，失败时显示占位符
- **信息显示**: 商品名称（最多2行）、价格
- **状态标识**: 已选商品在右侧显示为禁用状态

### 4. 数据管理
- **初始化**: 对话框打开时加载已配置和可选商品
- **实时统计**: 底部显示可选商品总数
- **保存配置**: 将选中的商品ID列表提交到后端

## 技术实现

### 数据结构
```typescript
interface GoodItem {
    id: string           // 商品ID
    name: string         // 商品名称
    price: number        // 商品价格
    imageUrl?: string    // 商品图片URL
    category?: string    // 商品分类
    description?: string // 商品描述
    disabled?: boolean   // 是否禁用
    expanded?: boolean   // 是否展开（预留字段）
}
```

### 核心方法
- `loadSelectedGoods()`: 加载已配置的商品
- `initGoodsData()`: 初始化可选商品数据
- `handleAddGoods()`: 添加商品到已选列表
- `handleRemoveGoods()`: 从已选列表移除商品
- `isGoodsSelected()`: 检查商品是否已被选中
- `handleSearch()`: 执行商品搜索
- `handleSubmit()`: 提交配置结果

### 样式特色
- **双区域设计**: 左右区域有不同的背景色和主题色区分
- **响应式设计**: 支持不同屏幕尺寸，大屏左右分栏，小屏上下堆叠
- **悬停效果**: 商品卡片轻微上浮和阴影效果
- **状态区分**: 已选和可选商品有明确的视觉区分
- **自定义滚动条**: 优化列表滚动体验
- **按钮动效**: 圆形按钮悬停时放大效果
- **平滑过渡**: 所有交互都有平滑动画

## 使用示例

```vue
<template>
    <ConfigGoodsDialog 
        v-model:visible="dialogVisible" 
        :categoryData="selectedCategory"
        @success="handleConfigSuccess" 
    />
</template>

<script setup>
import ConfigGoodsDialog from './components/ConfigGoodsDialog/index.vue'

const dialogVisible = ref(false)
const selectedCategory = ref({
    id: '1',
    categoryName: '北京本地单日营'
})

const handleConfigSuccess = () => {
    console.log('商品配置成功')
    // 刷新列表等操作
}
</script>
```

## API集成

### 需要的接口
1. **获取可选商品列表**
   ```typescript
   GET /api/goods/list
   // 返回所有可配置的商品
   ```

2. **获取已配置商品**
   ```typescript
   GET /api/recommendation/{categoryId}/goods
   // 返回指定分类已配置的商品
   ```

3. **保存商品配置**
   ```typescript
   POST /api/recommendation/configureGoods
   {
     "id": "分类ID",
     "goodIds": ["商品ID1", "商品ID2"]
   }
   ```

4. **搜索商品**
   ```typescript
   POST /api/goods/search
   {
     "keyword": "搜索关键词",
     "category": "分类筛选"
   }
   ```

## 特性优势

1. **用户体验**
   - 直观的双栏布局
   - 实时搜索和筛选
   - 清晰的状态反馈
   - 优雅的交互动画

2. **功能完整**
   - 支持商品搜索
   - 防重复添加
   - 确认删除保护
   - 数据持久化

3. **性能优化**
   - 计算属性优化搜索
   - 虚拟滚动支持大数据量
   - 防抖搜索减少请求
   - 图片懒加载

4. **可维护性**
   - 清晰的代码结构
   - 完善的错误处理
   - 详细的注释文档
   - TypeScript类型安全

## 注意事项

1. **图片处理**: 商品图片需要提供默认占位符
2. **权限控制**: 根据用户权限过滤可配置商品
3. **数据同步**: 配置完成后及时更新相关数据
4. **性能考虑**: 大量商品时使用分页或虚拟滚动