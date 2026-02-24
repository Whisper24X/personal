# 迭代场景详细指南

当原型类型为**迭代**时，必须先读取 workspace 下相关前端代码，再生成与现有实现风格一致的原型。

---

## 路径基准

以下路径均相对于 **workspace 根目录**。`{root}` 根据原型类型选择：

- **管理后台**：`ainative-shadow` 或 `frontend`（需先检查目录是否存在）
- **小程序**：`ainative-app`

---

## 必读路径

按功能域选择需读取的文件：

| 类型     | 路径                                                                                         |
| -------- | -------------------------------------------------------------------------------------------- |
| 页面级   | `{root}/src/views/{domain}/{*.vue}` 或 `{root}/src/pages/{domain}/{*.vue}`                   |
| 通用组件 | `{root}/src/components/common/*.vue`                                                         |
| 领域组件 | `{root}/src/views/{domain}/components/*.vue` 或 `{root}/src/pages/{domain}/components/*.vue` |
| 样式     | `{root}/src/style.css`、`{root}/src/App.vue` 的 style 块                                     |

**注意**：项目可能使用 `views` 或 `pages` 目录，需先检查哪个存在。

---

## 参考要点

1. **布局结构**：el-row/el-col、el-card 使用方式
2. **组件组合**：PageHeader + CardHeader + el-card
3. **颜色、间距、圆角、阴影**：从 style.css、App.vue 提取
4. **数据流**：ref/reactive、props、emit
5. **图标使用**：@element-plus/icons-vue

---

## 功能域推断示例

| 用户描述                 | 推断 domain  | 建议读取                   |
| ------------------------ | ------------ | -------------------------- |
| 优化 Dashboard 统计卡片  | dashboard    | `views/dashboard/*.vue`    |
| 改进 PlatformList 的筛选 | platform     | `views/platform/*.vue`     |
| 配置页面的表单布局       | config       | `views/config/*.vue`       |
| 业务线列表样式           | businessLine | `views/businessLine/*.vue` |
