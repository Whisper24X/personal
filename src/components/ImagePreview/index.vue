<template>
    <div class="image-preview-container">
        <!-- 单张图片预览 -->
        <template v-if="!isMultiple">
            <el-image v-if="modelValue" :src="modelValue" :style="imageStyle" preview-teleported :initial-index="0"
                :preview-src-list="[modelValue]" :fit="fit" @click="handlePreview">
                <template #error>
                    <div class="image-error">
                        <el-icon>
                            <Picture />
                        </el-icon>
                    </div>
                </template>
            </el-image>
            <div v-else class="image-placeholder">
                <el-icon>
                    <Picture />
                </el-icon>
            </div>
        </template>

        <!-- 多张图片预览 -->
        <template v-else>
            <div class="image-list" :style="containerStyle">
                <div v-for="(url, index) in modelValue" :key="index" class="image-item" :style="imageStyle">
                    <el-image :src="url" preview-teleported :initial-index="index" :preview-src-list="modelValue"
                        :fit="fit" @click="handlePreview">
                        <template #error>
                            <div class="image-error">
                                <el-icon>
                                    <Picture />
                                </el-icon>
                            </div>
                        </template>
                    </el-image>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Picture } from '@element-plus/icons-vue'

interface Props {
    /**
     * 图片地址，支持单个字符串或字符串数组
     */
    modelValue: string | string[]
    /**
     * 是否多图模式
     */
    isMultiple?: boolean
    /**
     * 图片宽度，支持数字（px）或字符串
     */
    width?: number | string
    /**
     * 图片高度，支持数字（px）或字符串
     */
    height?: number | string
    /**
     * 图片填充模式
     * @default 'cover'
     */
    fit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down'
    /**
     * 多图模式下每行显示的图片数量
     * @default 3
     */
    columns?: number
    /**
     * 多图模式下图片间距
     * @default 8
     */
    gap?: number
}

const props = withDefaults(defineProps<Props>(), {
    isMultiple: false,
    width: 100,
    height: 100,
    fit: 'cover',
    columns: 3,
    gap: 8,
})

const emit = defineEmits<{
    (e: 'preview', url: string): void
}>()

// 处理图片尺寸样式
const imageStyle = computed(() => {
    const width = typeof props.width === 'number' ? `${props.width}px` : props.width
    const height = typeof props.height === 'number' ? `${props.height}px` : props.height
    return {
        width,
        height,
        borderRadius: '4px',
    }
})

// 多图模式下的容器样式
const containerStyle = computed(() => {
    return {
        gap: `${props.gap}px`,
        gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
    }
})

// 处理图片预览点击
const handlePreview = (url: string) => {
    emit('preview', url)
}
</script>

<style scoped>
.image-preview-container {
    display: inline-block;
}

.image-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}

.image-item {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
}

.image-placeholder,
.image-error {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f7fa;
    border-radius: 4px;
    color: #909399;
}

:deep(.el-image) {
    width: 100%;
    height: 100%;
}

:deep(.el-icon) {
    font-size: 24px;
}
</style>