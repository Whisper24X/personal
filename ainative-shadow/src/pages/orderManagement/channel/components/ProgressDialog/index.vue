<template>
    <el-dialog title="订单核销进度" v-model="dialogVisible" width="700px">
        <div v-loading="loading">
            <div class="progress-header">
                <p><strong>渠道订单编号：</strong>{{ form.orderNumber }}</p>
                <p><strong>商品名称：</strong>{{ form.goodName }}</p>
                <p><strong>订单状态：</strong>
                    <el-tag :type="getStatusType(form.status)">
                        {{ getStatusLabel(form.status) }}
                    </el-tag>
                </p>
                <p><strong>核销进度：</strong>{{ form.totalFinishedNums }}/{{ form.totalAppointmentNums }}</p>
            </div>

            <el-divider content-position="left">核销记录</el-divider>

            <el-empty v-if="!progressData.list || progressData.list.length === 0" description="暂无核销记录" />
            <div v-else>
                <div v-for="(category, categoryIndex) in progressData.list" :key="categoryIndex"
                    class="category-container">
                    <h3>{{ category.categoryName }} ({{ category.totalFinishedNums }}/{{ category.totalAppointmentNums
                        }})</h3>

                    <el-table :data="category.list" style="width: 100%" border stripe>
                        <el-table-column prop="courseName" label="课程名称" min-width="150" />
                        <el-table-column prop="verificationDate" label="核销日期" min-width="120">
                            <template #default="{ row }">
                                {{ row.verificationDate || '--' }}
                            </template>
                        </el-table-column>
                        <el-table-column prop="period" label="时段" min-width="100">
                            <template #default="{ row }">
                                {{ row.period || '--' }}
                            </template>
                        </el-table-column>
                        <el-table-column prop="childName" label="学员姓名" min-width="100">
                            <template #default="{ row }">
                                {{ row.childName || '--' }}
                            </template>
                        </el-table-column>
                    </el-table>
                </div>
            </div>
        </div>
        <template #footer>
            <el-button @click="dialogVisible = false">关闭</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive,watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getOrderProgress } from '../../service'
import { getStatusType, getStatusLabel } from '../../service.type'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    orderData: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:visible'])

const dialogVisible = ref(props.visible)
const loading = ref(false)

const form = reactive({
    id: '',
    orderNumber: '',
    goodName: '',
    status: '',
    totalAppointmentNums: 0,
    totalFinishedNums: 0
})

const progressData = reactive({
    list: [] as any[]
})

watch(() => props.visible, (newVal) => {
    dialogVisible.value = newVal
    if (newVal && props.orderData) {
        form.id = props.orderData.id
        form.orderNumber = props.orderData.orderNumber
        form.goodName = props.orderData.goodName
        form.status = props.orderData.status
        loadProgress()
    }
})

watch(() => dialogVisible.value, (newVal) => {
    emit('update:visible', newVal)
})

const loadProgress = async () => {
    try {
        loading.value = true
        progressData.list = []

        const res = await getOrderProgress(form.id)

        if (res) {
            const data = res as {
                totalAppointmentNums: number,
                totalFinishedNums: number,
                list: any[]
            }
            form.totalAppointmentNums = data.totalAppointmentNums || 0
            form.totalFinishedNums = data.totalFinishedNums || 0
            progressData.list = data.list || []
        }
    } catch (error) {
        console.error('获取核销进度失败:', error)
        ElMessage.error('获取核销进度失败，请稍后重试')
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.progress-header {
    margin-bottom: 20px;
}

.progress-header p {
    margin: 10px 0;
    line-height: 1.5;
}

.category-container {
    margin-bottom: 20px;
}

.category-container h3 {
    margin-bottom: 10px;
    font-size: 16px;
    color: #303133;
}
</style>
