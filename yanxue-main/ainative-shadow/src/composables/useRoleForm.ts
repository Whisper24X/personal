import { ref, reactive } from 'vue'
import type { FormInstance } from 'element-plus'
import type { CreateRoleParams } from '@/types/role'

export const useRoleForm = () => {
  const formRef = ref<FormInstance>()
  const dialogVisible = ref(false)
  const dialogTitle = ref('')

  const form = reactive<Partial<CreateRoleParams>>({
    name: '',
    remark: '',
    dataPermission: '',
    status: 1,
    sort: 0,
    permissionIds: [],
  })

  const rules = {
    name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
    dataPermission: [
      { required: true, message: '请选择数据权限', trigger: 'change' },
    ],
    permissionIds: [
      {
        required: true,
        type: 'array',
        message: '请选择角色权限',
        trigger: 'change',
      },
    ],
  }

  const resetForm = () => {
    if (formRef.value) {
      formRef.value.resetFields()
    }
    Object.assign(form, {
      name: '',
      remark: '',
      dataPermission: '',
      status: 1,
      sort: 0,
      permissionIds: [],
      id: undefined,
    })
  }

  return {
    formRef,
    dialogVisible,
    dialogTitle,
    form,
    rules,
    resetForm,
  }
}
