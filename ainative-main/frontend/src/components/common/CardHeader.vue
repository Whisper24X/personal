<template>
    <div class="card-header-content">
        <div class="card-header-left">
            <span v-if="title" class="card-title">
                <el-icon v-if="icon">
                    <component :is="icon" />
                </el-icon>
                {{ title }}
            </span>
            <slot name="title"></slot>
            <el-tag v-if="badge" :type="badgeType" :effect="badgeEffect" :size="badgeSize">
                {{ badge }}
            </el-tag>
        </div>
        <div v-if="$slots.right || $slots.default" class="card-header-right">
            <slot name="right"></slot>
            <slot></slot>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Props {
    title?: string;
    icon?: any;
    badge?: string | number;
    badgeType?: 'success' | 'warning' | 'info' | 'danger';
    badgeEffect?: 'dark' | 'light' | 'plain';
    badgeSize?: 'large' | 'default' | 'small';
}

withDefaults(defineProps<Props>(), {
    badgeType: 'info',
    badgeEffect: 'plain',
    badgeSize: 'default',
});
</script>

<style scoped>
.card-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.card-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.card-title {
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.card-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
</style>
