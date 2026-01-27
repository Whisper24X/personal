import { ref } from 'vue';
import { queryPermissionRules } from '@/service/permission.service';

export const usePermissionTree = () => {
  const menuTreeData = ref<any[]>([]);

  // 格式化树形数据
  const formatTreeData = (data: any[]): any[] => {
    return data.map(item => ({
      id: item.id,
      label: item.name,
      children: item.children?.length ? formatTreeData(item.children) : undefined
    }));
  };

  // 获取权限列表
  const getPermissionList = async () => {
    const res = await queryPermissionRules();
    menuTreeData.value = formatTreeData(res.list || []);
    console.log('menuTreeData', menuTreeData.value);
  };

  // 查找权限树中的节点
  const findPermissions = (permissions: any[], permissionIds: string[]) => {
    if (!permissionIds?.length) {
      return permissions;
    }
    const result: any[] = [];
    const findNode = (nodes: any[], parentPath: any[] = []) => {
      for (const node of nodes) {
        const currentPath = [...parentPath, node];
        if (permissionIds.includes(node.id.toString())) {
          let temp = result;
          for (const pathNode of currentPath) {
            let existNode = temp.find(n => n.id === pathNode.id);
            if (!existNode) {
              existNode = { ...pathNode, children: [] };
              temp.push(existNode);
            }
            temp = existNode.children;
          }
        }
        if (node.children?.length) {
          findNode(node.children, currentPath);
        }
      }
    };
    findNode(permissions);
    return result;
  };

  return {
    menuTreeData,
    getPermissionList,
    findPermissions
  };
}; 