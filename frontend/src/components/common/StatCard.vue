<template>
    <el-card shadow="hover" :class="['stat-card', type ? `stat-${type}` : '']">
        <el-statistic :title="title" :value="value" :suffix="suffix">
            <template v-if="$slots.prefix" #prefix>
                <slot name="prefix"></slot>
            </template>
            <template v-if="$slots.default">
                <slot></slot>
            </template>
        </el-statistic>
    </el-card>
</template>

<script setup lang="ts">
interface Props {
    title: string;
    value: string | number;
    suffix?: string;
    type?: 'success' | 'warning' | 'info' | 'danger';
}

withDefaults(defineProps<Props>(), {
    suffix: '',
});
</script>

<style scoped>
.stat-card {
    margin-bottom: 16px;
}

.stat-card.stat-success :deep(.el-statistic__number) {
    color: #67c23a;
}

.stat-card.stat-warning :deep(.el-statistic__number) {
    color: #e6a23c;
}

.stat-card.stat-danger :deep(.el-statistic__number) {
    color: #f56c6c;
}

.stat-card.stat-info :deep(.el-statistic__number) {
    color: #909399;
}
</style>
