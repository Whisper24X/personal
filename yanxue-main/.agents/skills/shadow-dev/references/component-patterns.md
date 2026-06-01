# 组件开发模式

常见的组件开发模式和示例。

## 列表页面（推荐模式）

### 使用 useTable + art-table

```vue
<script setup lang="ts">
import { useTable } from '@/hooks/core/useTable';
import { fetchUserList, deleteUser } from '@/api/user';

defineOptions({ name: 'UserList' });

const { data, loading, pagination, searchParams, fetchData, handleSizeChange, handleCurrentChange, resetSearchParams } = useTable({
  core: {
    apiFn: fetchUserList,
    immediate: true,
  },
});

const handleDelete = async (id: string) => {
  await ElMessageBox.confirm('确定删除吗？', '提示', { type: 'warning' });
  await deleteUser(id);
  ElMessage.success('删除成功');
  fetchData();
};
</script>

<template>
  <div class="user-list">
    <ElForm :inline="true" :model="searchParams">
      <ElFormItem label="用户名">
        <ElInput v-model="searchParams.userName" clearable />
      </ElFormItem>
      <ElFormItem>
        <ElButton type="primary" @click="fetchData">搜索</ElButton>
        <ElButton @click="resetSearchParams">重置</ElButton>
      </ElFormItem>
    </ElForm>

    <art-table :data="data" :loading="loading">
      <el-table-column prop="userName" label="用户名" />
      <el-table-column prop="email" label="邮箱" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <ElTag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </ElTag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <ElButton link type="primary" size="small">编辑</ElButton>
          <ElButton link type="danger" size="small" @click="handleDelete(row.id)"> 删除 </ElButton>
        </template>
      </el-table-column>
    </art-table>

    <el-pagination
      v-model:current-page="pagination.current"
      v-model:page-size="pagination.size"
      :total="pagination.total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>
```

## 表单页面

### 基础表单

```vue
<script setup lang="ts">
import { ref, reactive } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';

const formRef = ref<FormInstance>();
const loading = ref(false);

const formData = reactive<Api.User.CreateParams>({
  userName: '',
  email: '',
  password: '',
  roleIds: [],
});

const rules: FormRules = {
  userName: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度 3-20 个字符', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
};

const handleSubmit = async () => {
  await formRef.value?.validate();

  loading.value = true;
  try {
    await createUser(formData);
    ElMessage.success('创建成功');
  } finally {
    loading.value = false;
  }
};

const handleReset = () => {
  formRef.value?.resetFields();
};
</script>

<template>
  <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px">
    <ElFormItem label="用户名" prop="userName">
      <ElInput v-model="formData.userName" />
    </ElFormItem>

    <ElFormItem label="邮箱" prop="email">
      <ElInput v-model="formData.email" />
    </ElFormItem>

    <ElFormItem label="密码" prop="password">
      <ElInput v-model="formData.password" type="password" show-password />
    </ElFormItem>

    <ElFormItem>
      <ElButton type="primary" :loading="loading" @click="handleSubmit"> 提交 </ElButton>
      <ElButton @click="handleReset">重置</ElButton>
    </ElFormItem>
  </ElForm>
</template>
```

## 对话框表单

### 新增/编辑对话框

```vue
<script setup lang="ts">
import { ref, reactive } from 'vue';

const dialogVisible = ref(false);
const dialogTitle = ref('新增');
const isEdit = ref(false);

const formData = reactive<Api.User.CreateParams>({
  userName: '',
  email: '',
  password: '',
  roleIds: [],
});

// 打开对话框（新增）
const handleAdd = () => {
  dialogTitle.value = '新增用户';
  isEdit.value = false;
  Object.assign(formData, {
    userName: '',
    email: '',
    password: '',
  });
  dialogVisible.value = true;
};

// 打开对话框（编辑）
const handleEdit = (row: Api.User.UserInfo) => {
  dialogTitle.value = '编辑用户';
  isEdit.value = true;
  Object.assign(formData, row);
  dialogVisible.value = true;
};

// 提交
const handleSubmit = async () => {
  if (isEdit.value) {
    await updateUser(formData);
  } else {
    await createUser(formData);
  }

  dialogVisible.value = false;
  ElMessage.success('操作成功');
  fetchData();
};

// 对外暴露方法
defineExpose({
  handleAdd,
  handleEdit,
});
</script>

<template>
  <ElDialog v-model="dialogVisible" :title="dialogTitle" width="600px">
    <ElForm :model="formData" label-width="80px">
      <ElFormItem label="用户名">
        <ElInput v-model="formData.userName" />
      </ElFormItem>
      <ElFormItem label="邮箱">
        <ElInput v-model="formData.email" />
      </ElFormItem>
      <ElFormItem v-if="!isEdit" label="密码">
        <ElInput v-model="formData.password" type="password" />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" @click="handleSubmit">确定</ElButton>
    </template>
  </ElDialog>
</template>
```

### 在列表页中使用对话框

```vue
<script setup lang="ts">
const dialogRef = ref();

const handleAdd = () => {
  dialogRef.value.handleAdd();
};

const handleEdit = (row: Api.User.UserInfo) => {
  dialogRef.value.handleEdit(row);
};
</script>

<template>
  <div>
    <ElButton type="primary" @click="handleAdd">新增</ElButton>

    <!-- 表格... -->

    <!-- 对话框组件 -->
    <UserDialog ref="dialogRef" @success="fetchData" />
  </div>
</template>
```

## 搜索表单组件

### 独立的搜索组件

```vue
<script setup lang="ts">
interface Props {
  modelValue: Api.User.ListParams;
}

interface Emits {
  (e: 'update:modelValue', value: Api.User.ListParams): void;
  (e: 'search'): void;
  (e: 'reset'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const localValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const handleSearch = () => emit('search');
const handleReset = () => emit('reset');
</script>

<template>
  <ElForm :inline="true" :model="localValue">
    <ElFormItem label="用户名">
      <ElInput v-model="localValue.userName" clearable />
    </ElFormItem>
    <ElFormItem label="状态">
      <ElSelect v-model="localValue.status" clearable>
        <ElOption label="正常" :value="1" />
        <ElOption label="禁用" :value="2" />
      </ElSelect>
    </ElFormItem>
    <ElFormItem>
      <ElButton type="primary" @click="handleSearch">搜索</ElButton>
      <ElButton @click="handleReset">重置</ElButton>
    </ElFormItem>
  </ElForm>
</template>
```

## 详情页面

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const loading = ref(false);
const detail = ref<Api.User.UserInfo>();

const fetchDetail = async () => {
  loading.value = true;
  try {
    detail.value = await fetchUserDetail(route.params.id as string);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDetail();
});
</script>

<template>
  <ElCard v-loading="loading">
    <template #header>
      <span>用户详情</span>
    </template>

    <ElDescriptions v-if="detail" :column="2" border>
      <ElDescriptionsItem label="用户名">
        {{ detail.userName }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="邮箱">
        {{ detail.email }}
      </ElDescriptionsItem>
      <ElDescriptionsItem label="状态">
        <ElTag :type="detail.status === 1 ? 'success' : 'danger'">
          {{ detail.status === 1 ? '正常' : '禁用' }}
        </ElTag>
      </ElDescriptionsItem>
      <ElDescriptionsItem label="创建时间">
        {{ detail.createdAt }}
      </ElDescriptionsItem>
    </ElDescriptions>
  </ElCard>
</template>
```

## 组件通信

### Props 和 Emits

```vue
<script setup lang="ts">
interface Props {
  /** 用户数据 */
  user: Api.User.UserInfo;
  /** 是否只读 */
  readonly?: boolean;
}

interface Emits {
  (e: 'update', user: Api.User.UserInfo): void;
  (e: 'delete', id: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
});

const emit = defineEmits<Emits>();
</script>
```

### Provide/Inject（跨层级通信）

```vue
<!-- 父组件 -->
<script setup lang="ts">
provide('userId', userId);
provide('refresh', fetchData);
</script>

<!-- 子组件 -->
<script setup lang="ts">
const userId = inject<string>('userId');
const refresh = inject<() => void>('refresh');
</script>
```
