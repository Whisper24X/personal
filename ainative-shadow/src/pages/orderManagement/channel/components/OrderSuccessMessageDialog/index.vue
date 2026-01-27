<template>
    <el-dialog title="导入成功" v-model="dialogVisible" width="500px" :close-on-click-modal="false" center>
        <div class="success-message">
            <el-icon class="success-icon" color="#67C23A" :size="48">
                <CircleCheckFilled />
            </el-icon>
            <div class="message-content">{{ message }}</div>
        </div>
        <template #footer>
            <el-button type="primary" @click="handleClose">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, watch } from 'vue'
import { CircleCheckFilled } from '@element-plus/icons-vue'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    message: {
        type: String,
        default: '操作成功'
    }
})

const emit = defineEmits(['update:visible'])

const dialogVisible = ref(props.visible)

watch(() => props.visible, (newVal) => {
    dialogVisible.value = newVal
})

watch(() => dialogVisible.value, (newVal) => {
    emit('update:visible', newVal)
})

const handleClose = () => {
    dialogVisible.value = false
}
</script>

<style scoped>
.success-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 0;
}

.success-icon {
    margin-bottom: 20px;
}

.message-content {
    font-size: 16px;
    color: #303133;
    text-align: center;
    line-height: 1.5;
    white-space: pre-line;
    word-break: break-all;
}
</style>