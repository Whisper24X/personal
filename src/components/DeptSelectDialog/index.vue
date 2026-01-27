<template>
  <el-dialog
    v-model="visible"
    title="组织切换"
    width="500px"
    :close-on-click-modal="false"
  >
    <el-form :model="formData" :rules="rules" ref="formRef">
      <el-form-item label="组织范围：" prop="depts">
        <el-tree-select
          v-model="formData.depts"
          :data="deptList"
          :props="defaultProps"
          default-expand-all
          multiple
          check-strictly
          clearable
          placeholder="请选择部门"
          class="dept-select"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        确认
      </el-button>
      <el-button @click="visible = false">取消</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { getDeptList } from '@/service/user.service'
import { useUserStore } from '@/store/modules/userStore'
import type { PermissionDept } from '@/types/login'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

const userStore = useUserStore()
const loading = ref(false)
const deptList = ref<PermissionDept[]>([])
const formRef = ref<FormInstance>()
const formData = ref({
  depts: [] as string[],
})

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const defaultProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data: PermissionDept) => !data.isSelect,
}

// 表单验证规则
const rules = {
  depts: [
    { required: true, message: '请至少选择一个部门', trigger: 'change' },
    {
      validator: (rule: any, value: string[], callback: Function) => {
        if (!value || value.length === 0) {
          callback(new Error('请至少选择一个部门'))
        } else {
          callback()
        }
      },
      trigger: 'change',
    },
  ],
}

// 获取部门列表
const getDepts = async () => {
  try {
    const res = await getDeptList()
    deptList.value = res.list

    // 如果没有已选中的部门，则选中第一个可选的部门
    if (!userStore.selectDepts?.length) {
      const firstSelectableDept = findFirstSelectableDept(res.list)
      if (firstSelectableDept) {
        const defaultDepts = [firstSelectableDept.id]
        formData.value.depts = defaultDepts
        // 同步到 store
        await userStore.updateSelectDepts(defaultDepts, deptList.value)
      }
    } else {
      // 否则使用已选中的部门
      formData.value.depts = userStore.selectDepts
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取部门列表失败')
  }
}

// 递归查找第一个可选的部门
const findFirstSelectableDept = (
  depts: PermissionDept[],
): PermissionDept | null => {
  for (const dept of depts) {
    if (dept.isSelect) {
      return dept
    }
    if (dept.children?.length) {
      const found = findFirstSelectableDept(dept.children)
      if (found) {
        return found
      }
    }
  }
  return null
}

// 提交选择
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        await userStore.updateSelectDepts(formData.value.depts, deptList.value)
        ElMessage.success('切换权限成功')
        emit('success')
        visible.value = false
      } catch (error: any) {
        ElMessage.error(error.message || '切换权限失败')
      } finally {
        loading.value = false
      }
    }
  })
}

onMounted(() => {
  getDepts()
})
</script>

<style scoped lang="scss">
.dept-select {
  width: 100%;
}

:deep(.el-tree-select) {
  .el-select-dropdown__wrap {
    max-height: 400px;
  }
}

.el-dialog {
  .el-form {
    padding: 20px;
  }
}
</style>
