# 优惠券分享图更新说明

## 更新日期
2025-11-05

## 更新内容

根据最新的设计要求,优惠券分享图已更新为全新的 2025 版设计。

## 设计变化

### 旧版设计
- 简单的红色背景
- 仅包含优惠券基本信息和二维码

### 新版设计

#### 1. 顶部标题区域
- 蓝色渐变背景 (#4A90E2 → #7CB9F5)
- 双行标题:
  - "有一张优惠券等你领取"
  - "数量有限,先到先得"

#### 2. 小程序区域
- 圆形小程序图标 (120px,可自定义)
- 小程序名称: "洋葱星球研学家长服务"
- 图标支持自定义URL或使用默认样式

#### 3. 优惠券卡片区域
白色圆角卡片,包含:

- **右上角标签**: "限领1张/人" (红色圆角标签)
- **优惠金额**: 
  - ¥符号 + 金额数字(大号红色)
  - 例: ¥1000
- **使用门槛**: 
  - 红色文字显示
  - 例: "满10000可用" 或 "无门槛"
- **虚线分隔符**: 灰色虚线
- **使用周期**: 
  - 左对齐显示
  - 格式: "使用周期: 2025.10.10 10:00-2025.11.15 24:00"
- **二维码**: 
  - 200x200px
  - 居中显示
  - 白底黑码
- **底部提示**: "长按扫码快速领取优惠"

## 技术实现

### 1. 接口变化

新增配置参数:
```typescript
interface CouponShareImageConfig {
  // ... 原有字段
  miniProgramName?: string    // 小程序名称(默认: 洋葱星球研学家长服务)
  miniProgramIcon?: string    // 小程序图标URL(可选)
}
```

### 2. 默认配置更新

```typescript
const DEFAULT_CONFIG = {
  qrCodeSize: 200,                    // 二维码尺寸增大
  canvasWidth: 750,                   // 画布宽度
  canvasHeight: 1250,                 // 画布高度
  backgroundImage: 'https://fp.yangcong345.com/middle/1.0.0/coupon-bg-923bd16d33e918ca5f61efa4607a99a8__w.png', // 背景图片URL
  miniProgramIcon: 'https://fp.yangcong345.com/middle/1.0.0/yanxue-logo-30aaff28b0dc207e82f783c545e53056__w.png', // 小程序图标URL
  miniProgramName: '洋葱星球研学家长服务',
  miniProgramIconSize: 160,           // 图标尺寸
}
```

### 3. 文件修改清单

#### `/src/utils/couponShareImage.ts`
- 更新 `CouponShareImageConfig` 接口
- 更新 `DEFAULT_CONFIG` 配置
- 完全重写 `generateCouponShareImage` 函数
- 实现新的设计布局和样式

#### `/src/utils/README.md`
- 更新配置选项文档
- 更新分享图样式说明
- 更新使用示例代码

#### `/src/pages/miniProgramManagement/coupon/components/CouponDetailDialog.vue`
- 更新 `generateShareImage` 方法
- 更新 `handleDownloadImage` 方法
- 添加时间格式化函数
- 更新分享预览区域尺寸(180x320px)

## 使用方法

### 基础用法
```typescript
import { generateCouponShareImage } from '@/utils/couponShareImage'

const dataURL = await generateCouponShareImage({
  couponId: '123',
  couponName: '会员优惠券',
  amount: '1000',
  threshold: '满10000可用',
  validTime: '2025.10.10 10:00-2025.11.15 24:00',
  miniProgramName: '洋葱星球研学家长服务',
  // miniProgramIcon 会自动使用默认的洋葱星球Logo
})
```

### 下载分享图
```typescript
import { downloadCouponShareImage } from '@/utils/couponShareImage'

await downloadCouponShareImage({
  couponId: '123',
  couponName: '会员优惠券',
  amount: '1000',
  threshold: '满10000可用',
  validTime: '2025.10.10 10:00-2025.11.15 24:00',
  miniProgramName: '洋葱星球研学家长服务',
})
```

## 设计规范

### 颜色规范
- **主背景**: 专属背景图片 (洋葱星球主题)
- **卡片背景**: 白色 #FFFFFF
- **主题色**: 红色 #FF6B4D
- **文字色**: 
  - 白色 #FFFFFF (背景区域)
  - 黑色 #333333 (卡片区域)
  - 灰色 #666666 (次要文字)

### 尺寸规范
- **画布**: 750x1250px
- **背景图片**: 750x1250px (https://fp.yangcong345.com/middle/1.0.0/coupon-bg-923bd16d33e918ca5f61efa4607a99a8__w.png)
- **小程序图标**: 160x160px (圆形,洋葱星球Logo: https://fp.yangcong345.com/middle/1.0.0/yanxue-logo-30aaff28b0dc207e82f783c545e53056__w.png)
- **二维码**: 200x200px
- **卡片圆角**: 30px
- **标签圆角**: 35px

### 字体规范
- **标题**: 48px 超粗体(font-weight: 900)
- **小程序名称**: 32px 常规
- **优惠金额**: 120px 加粗
- **门槛**: 28px 常规
- **使用周期**: 24px 常规
- **提示文字**: 28px 加粗

## 兼容性说明

- ✅ 完全向后兼容
- ✅ 可选参数不影响现有代码
- ✅ 保持原有接口签名不变
- ✅ 默认配置自动应用新设计

## 测试建议

1. **视觉测试**: 验证各元素位置、颜色、尺寸是否符合设计稿
2. **功能测试**: 测试图片生成和下载功能
3. **边界测试**: 测试长文本、特殊字符的显示
4. **兼容测试**: 测试不同浏览器下的渲染效果
5. **性能测试**: 测试大量生成时的性能表现

## 注意事项

1. **默认资源**: 
   - 背景图片和小程序图标已配置默认CDN地址
   - 默认使用洋葱星球品牌资源
2. **图标URL**: 如果需要自定义小程序图标,需要支持跨域(CORS)
3. **背景图片**: 背景图片会自动从CDN加载,如果加载失败会使用渐变背景作为降级方案
4. **时间格式**: 建议使用 "YYYY.MM.DD HH:mm:ss" 格式
5. **门槛文案**: 建议使用 "满XXX可用" 或 "无门槛"
6. **浏览器支持**: 需要支持 Canvas API 和 Promise
7. **图片尺寸**: 生成的图片为 750x1250px,下载后约 100-200KB

## 后续优化建议

1. 支持更多主题色配置
2. 支持自定义标签文字
3. 支持添加更多装饰元素
4. 优化图片生成性能
5. 支持 WebP 格式导出

## 相关文档

- [二维码生成工具文档](/src/utils/README.md#二维码生成工具-qrcodets)
- [优惠券分享图工具文档](/src/utils/README.md#优惠券分享图生成工具-couponsharimagets)
- [优惠券管理模块文档](/src/pages/miniProgramManagement/coupon/IMPLEMENTATION_SUMMARY.md)

