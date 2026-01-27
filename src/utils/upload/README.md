# Taro 版本上传工具

这是一个为 Taro 小程序环境重构的上传工具，支持图片上传、压缩、进度监听等功能。

## 主要功能

- ✅ 支持小程序环境（微信小程序、支付宝小程序等）
- ✅ 图片选择和上传
- ✅ 文件压缩优化
- ✅ 上传进度监听
- ✅ 并发上传控制
- ✅ 文件去重（基于文件hash）
- ✅ 错误处理和重试机制

## 使用方法

### 基础用法

```typescript
import { handleTaroFileUpload, type UploadFile } from '@/utils/upload'

// 简单上传
const uploadFile = async () => {
  try {
    const file = await handleTaroFileUpload({
      filePath: 'yanxue/feedback',
      enableCompress: true,
      compressOptions: {
        quality: 0.85,
        maxSize: 1000
      },
      getToken: async () => {
        // 获取上传token
        return 'your-upload-token'
      }
    })
    console.log('上传成功:', file)
  } catch (error) {
    console.error('上传失败:', error)
  }
}
```

### 高级用法

```typescript
import { chooseAndUploadFiles, type UploadFile, type UploadOptions } from '@/utils/upload'

// 批量上传
const uploadMultipleFiles = async () => {
  try {
    const files = await chooseAndUploadFiles({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      limit: 5,
      size: 2 * 1024 * 1024, // 2MB
      filePath: 'yanxue/feedback',
      env: 'prod',
      getToken: async () => {
        // 获取上传token
        return 'your-upload-token'
      },
      fileUploadProgressHandler: (e, file, files) => {
        console.log(`文件 ${file.name} 上传进度: ${file.percentage}%`)
      },
      fileUploadEndHandler: (res, file, files) => {
        console.log(`文件 ${file.name} 上传完成:`, res)
      },
      fileUploadErrorHandler: (error, file, files) => {
        console.error(`文件 ${file.name} 上传失败:`, error)
      }
    })
    console.log('批量上传完成:', files)
  } catch (error) {
    console.error('批量上传失败:', error)
  }
}
```

### 在组件中使用

```vue
<template>
  <view class="uploader">
    <button @tap="handleUpload">选择并上传图片</button>
    <view v-for="file in files" :key="file.uid">
      <image :src="file.url" v-if="file.status === 'success'" />
      <text v-if="file.status === 'uploading'">上传中... {{file.percentage}}%</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { handleTaroFileUpload, type UploadFile } from '@/utils/upload'

const files = ref<UploadFile[]>([])

const handleUpload = async () => {
  try {
    const file = await handleTaroFileUpload({
      filePath: 'yanxue/feedback',
      enableCompress: true,
      getToken: async () => {
        // 从你的API获取token
        const response = await fetch('/api/upload-token')
        const data = await response.json()
        return data.token
      }
    })
    files.value.push(file)
  } catch (error) {
    console.error('上传失败:', error)
  }
}
</script>
```

## API 参考

### UploadFile 接口

```typescript
interface UploadFile {
  uid: string                    // 唯一标识
  name: string                   // 文件名
  size: number                   // 文件大小
  type: string                   // 文件类型
  status: 'ready' | 'uploading' | 'success' | 'fail' | 'delete'  // 上传状态
  percentage: number             // 上传进度 (0-100)
  url: string                    // 文件URL
  filePath: string               // 文件路径
  originFileName: string         // 原始文件名
  tempFilePath?: string          // 临时文件路径（小程序环境）
  abort?: () => void             // 取消上传方法
}
```

### 配置选项

#### handleTaroFileUpload 选项

```typescript
interface HandleTaroFileUploadOptions {
  filePath?: string              // 上传路径
  enableCompress?: boolean       // 是否启用压缩
  compressOptions?: CompressOptions  // 压缩选项
  count?: number                 // 选择文件数量
  sizeType?: ('original' | 'compressed')[]  // 文件大小类型
  sourceType?: ('album' | 'camera')[]       // 文件来源
  limit?: number                 // 文件数量限制
  size?: number                  // 文件大小限制（字节）
  env?: 'test' | 'stage' | 'prod'  // 环境
  getToken?: () => Promise<string>  // 获取token方法
}
```

#### CompressOptions 接口

```typescript
interface CompressOptions {
  width?: number                 // 压缩后宽度
  height?: number                // 压缩后高度
  quality?: number               // 压缩质量 (0-1)
  base64?: boolean               // 是否返回base64（小程序环境不支持）
}
```

## 环境配置

工具支持三个环境：

- `test`: 测试环境
- `stage`: 预发布环境  
- `prod`: 生产环境

每个环境对应不同的上传API地址，在 `config/index.ts` 中配置。

## 注意事项

1. **小程序环境限制**: 由于小程序环境的限制，某些功能（如精确的文件大小获取、base64返回等）可能无法完全支持。

2. **Token获取**: 需要提供 `getToken` 方法来获取上传所需的认证token。

3. **文件类型**: 目前主要支持图片上传，其他文件类型需要根据具体需求调整。

4. **错误处理**: 建议在使用时添加适当的错误处理和用户提示。

## 迁移指南

从原版本迁移到Taro版本：

1. 将 `import { upload, onFileInputChange }` 改为 `import { handleTaroFileUpload, chooseAndUploadFiles }`
2. 更新API调用方式，使用新的配置选项
3. 确保提供 `getToken` 方法
4. 根据小程序环境调整相关配置
