<template>
    <el-empty :description="description" :image-size="imageSize">
        <template v-if="$slots.default">
            <slot></slot>
        </template>
        <template v-else-if="actionText && actionHandler">
            <el-button type="primary" @click="actionHandler">
                {{ actionText }}
            </el-button>
        </template>
    </el-empty>
</template>

<script setup lang="ts">
interface Props {
    description: string;
    imageSize?: number;
    actionText?: string;
    actionHandler?: () => void;
}

withDefaults(defineProps<Props>(), {
    imageSize: 100,
});
</script>
