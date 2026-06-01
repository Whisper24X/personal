# ImageUploader 图片上传组件

基于 Taro 框架的图片上传组件，支持多图片上传、图片压缩、进度显示等功能。

## 组件列表

- `index.vue` - 基础版本
- `ImageUploaderAdvanced.vue` - 高级版本（支持进度显示、重试等功能）

## 基础版本使用

```vue
<template>
  <view class="page">
    <ImageUploader
      v-model="imageList"
      :max-count="5"
      upload-text="上传图片"
      :enable-compress="true"
      :compress-options="{ quality: 0.8, maxSize: 1000 }"
      file-path="yanxue/feedback"
      @upload-success="handleUploadSuccess"
      @upload-error="handleUploadError"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ImageUploader from '@/components/ImageUploader/index.vue';
import type { UploadFile } from '@/utils/upload';

const imageList = ref<UploadFile[]>([]);

const handleUploadSuccess = (file: UploadFile) => {
  console.log('上传成功:', file);
};

const handleUploadError = (error: Error) => {
  console.error('上传失败:', error);
};
</script>
```

## 高级版本使用

```vue
<template>
  <view class="page">
    <ImageUploaderAdvanced
      v-model="imageList"
      :max-count="9"
      upload-text="添加图片"
      :enable-compress="true"
      :show-progress="true"
      :auto-upload="true"
      @upload-success="handleUploadSuccess"
      @upload-error="handleUploadError"
      @upload-progress="handleUploadProgress"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ImageUploaderAdvanced from '@/components/ImageUploader/ImageUploaderAdvanced.vue';
import type { UploadFile } from '@/utils/upload';

const imageList = ref<UploadFile[]>([]);

const handleUploadSuccess = (file: UploadFile) => {
  console.log('上传成功:', file);
};

const handleUploadError = (error: Error) => {
  console.error('上传失败:', error);
};

const handleUploadProgress = (progress: number) => {
  console.log('上传进度:', progress);
};
</script>
```

## Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | UploadFile[] | [] | 图片列表（v-model） |
| title | string | '上传图片' | 标题 |
| uploadText | string | '添加图片' | 上传按钮文字 |
| maxCount | number | 3 | 最大上传数量 |
| enableCompress | boolean | true | 是否启用压缩 |
| compressOptions | object | { quality: 0.85, maxSize: 1000 } | 压缩选项 |
| filePath | string | 'yanxue/feedback' | 上传路径 |
| size | number | 2MB | 文件大小限制 |
| showProgress | boolean | true | 是否显示进度（仅高级版本） |
| autoUpload | boolean | true | 是否自动上传（仅高级版本） |

## Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| update:modelValue | UploadFile[] | 图片列表更新 |
| updateUploading | boolean | 上传状态更新 |
| uploadSuccess | UploadFile | 单张图片上传成功 |
| uploadError | Error | 上传失败 |
| uploadProgress | number | 上传进度（仅高级版本） |

## Methods

| 方法名 | 参数 | 说明 |
|--------|------|------|
| clearImages | - | 清空所有图片 |
| triggerUpload | - | 手动触发上传 |
| retryUpload | - | 重新上传失败的图片（仅高级版本） |

## 样式定制

组件使用 Less 编写样式，支持通过 CSS 变量进行定制：

```less
.image-uploader {
  --upload-box-bg: #f7f7f9;
  --upload-box-border: #e0e0e0;
  --upload-text-color: #848096;
  --upload-count-color: #b8b4c7;
}
```

## 注意事项

1. 组件依赖 `@/utils/upload` 工具函数
2. 需要在小程序后台配置图片上传域名
3. 建议在生产环境中替换 `mockUploadImage` 为真实的上传接口
4. 组件会自动处理图片压缩和格式转换
