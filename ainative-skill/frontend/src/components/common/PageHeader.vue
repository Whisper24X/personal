<template>
    <el-page-header :class="['page-header', customClass]" @back="handleBack">
        <template #content>
            <div class="header-content">
                <div class="header-left">
                    <span class="header-title">
                        <el-icon v-if="icon">
                            <component :is="icon" />
                        </el-icon>
                        {{ title }}
                    </span>
                    <p v-if="description" class="header-desc">{{ description }}</p>
                    <slot name="extra"></slot>
                </div>
                <div v-if="$slots.right" class="header-right">
                    <slot name="right"></slot>
                </div>
            </div>
        </template>
    </el-page-header>
</template>

<script setup lang="ts">
interface Props {
    title: string;
    description?: string;
    icon?: any;
    showBack?: boolean;
    backHandler?: () => void;
    customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
    showBack: true,
    customClass: '',
});

const handleBack = () => {
    if (props.backHandler) {
        props.backHandler();
    }
};
</script>

<style scoped>
.page-header {
    margin-bottom: 24px;
}

.page-header :deep(.el-page-header__left) {
    display: none;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
}

.header-left {
    display: flex;
    flex-direction: column;
    flex: 1;
}

.header-title {
    font-size: 28px;
    font-weight: bold;
    color: #303133;
    display: flex;
    align-items: center;
    gap: 8px;
}

.header-desc {
    color: #909399;
    margin-top: 8px;
    margin-bottom: 0;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 12px;
}
</style>
