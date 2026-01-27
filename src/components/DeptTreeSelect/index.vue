<template>
  <el-tree-select
    v-model="selectedValue"
    :placeholder="placeholder"
    :multiple="multiple"
    :render-after-expand="false"
    :show-checkbox="showCheckbox"
    :check-strictly="checkStrictly"
    :check-on-click-node="checkOnClickNode"
    :default-expand-all="defaultExpandAll"
    :collapse-tags="collapseTags"
    :collapse-tags-tooltip="collapseTagsTooltip"
    :data="deptOptions"
    :props="{
      value: 'value',
      label: 'label',
      children: 'children'
    }"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
/**
 * 部门树形选择组件
 * 支持单选/多选，支持同级选择限制
 */
import { ref, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getDepartmentTree } from '@/service/department.service';

/**
 * 树形选择器选项接口
 */
interface TreeOption {
  label: string;      // 显示文本
  value: string;      // 选项值
  children?: TreeOption[]; // 子节点
}

/**
 * 组件属性定义
 */
interface Props {
  modelValue?: string | string[];    // v-model绑定值
  placeholder?: string;              // 占位文本
  multiple?: boolean;                // 是否多选
  showCheckbox?: boolean;            // 是否显示复选框
  checkStrictly?: boolean;           // 是否严格的遵循父子不互相关联
  checkOnClickNode?: boolean;        // 是否在点击节点时触发
  defaultExpandAll?: boolean;        // 是否默认展开所有节点
  collapseTags?: boolean;            // 多选时是否折叠Tag
  collapseTagsTooltip?: boolean;     // 折叠Tag时是否显示tooltip
  sameLevel?: boolean;               // 是否限制只能选择同级节点
  sameParent?: boolean;              // 是否限制只能选择同一父节点下的节点
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择部门',
  multiple: false,
  showCheckbox: false,
  checkStrictly: true,
  checkOnClickNode: true,
  defaultExpandAll: false,
  collapseTags: false,
  collapseTagsTooltip: false,
  sameLevel: false,
  sameParent: false
});

const emit = defineEmits(['update:modelValue', 'change']);

// 部门选项列表
const deptOptions = ref<TreeOption[]>([]);
// 选中值
const selectedValue = ref<string | string[]>(props.modelValue ?? '');

/**
 * 监听选中值变化
 */
watch(() => props.modelValue, (newVal) => {
  selectedValue.value = newVal ?? '';
});

/**
 * 获取节点的层级路径
 */
const getNodePath = (value: string, tree: TreeOption[]): string[] => {
  const path: string[] = [];
  const find = (nodes: TreeOption[], target: string, currentPath: string[]) => {
    for (const node of nodes) {
      const newPath = [...currentPath, node.value];
      if (node.value === target) {
        path.push(...newPath);
        return true;
      }
      if (node.children && find(node.children, target, newPath)) {
        return true;
      }
    }
    return false;
  };
  find(tree, value, []);
  return path;
};

/**
 * 获取节点的父节点ID
 */
const getParentId = (value: string, tree: TreeOption[]): string | null => {
  const path = getNodePath(value, tree);
  return path.length > 1 ? path[path.length - 2] : null;
};

/**
 * 处理选择变化
 */
const handleChange = (value: string | string[]) => {
  console.log('DeptTreeSelect-handleChange-value', value, props.multiple, Array.isArray(value));
  if (props.multiple && Array.isArray(value)) {
    if (!value.length) {
      emit('update:modelValue', []);
      emit('change', []);
      return;
    }

    let validValues = value;
    console.log('DeptTreeSelect-validValues-before', validValues);

    // 检查是否需要同级限制
    if (props.sameLevel || props.sameParent) {
      const firstValue = value[0];
      const firstLevel = getNodePath(firstValue, deptOptions.value).length;
      const firstParentId = getParentId(firstValue, deptOptions.value);

      validValues = value.filter(val => {
        const level = getNodePath(val, deptOptions.value).length;
        const parentId = getParentId(val, deptOptions.value);

        if (props.sameLevel && level !== firstLevel) {
          return false;
        }
        if (props.sameParent && parentId !== firstParentId) {
          return false;
        }
        return true;
      });

      if (validValues.length !== value.length) {
        ElMessage.warning('只能选择同一层级的部门');
      }
    }

    console.log('DeptTreeSelect-validValues', validValues);

    emit('update:modelValue', validValues);
    emit('change', validValues);
  } else {
    emit('update:modelValue', value);
    emit('change', value);
  }
};

/**
 * 获取部门列表并格式化为树形结构
 */
const getDepts = async () => {
  try {
    const res = await getDepartmentTree();
    const formatDepts = (depts: any[]): TreeOption[] => {
      return depts.map(dept => ({
        label: dept.name,
        value: dept.id,
        children: dept.children?.length ? formatDepts(dept.children) : undefined
      }));
    };
    deptOptions.value = formatDepts(res.list);
  } catch (error) {
    console.error('获取部门列表失败:', error);
  }
};

// 组件挂载时获取部门数据
onMounted(() => {
  getDepts();
});
</script> 