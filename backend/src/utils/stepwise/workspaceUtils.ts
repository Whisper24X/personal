/**
 * Workspace utility functions
 * Workspace 相关工具函数
 */

import * as path from 'path';
import * as fsSync from 'fs';

/**
 * 获取工作目录路径的通用函数
 * 新的目录结构：workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}/
 * applicationId 和 projectId 必须提供，不能使用 'default'，以防止不同应用/项目互相覆盖文件
 */
export function getWorkspaceDir(
  documentType: string,
  options?: {
    applicationId?: string;
    projectId?: string;
    /** @deprecated 版本控制已改用 git，此参数被忽略 */
    version?: number;
    /** @deprecated 使用环境变量 WORKSPACE_PATH 代替 */
    workspacePath?: string;
  }
): string {
  const possibleRoots = [
    path.resolve(__dirname, '../../../'),
    path.resolve(__dirname, '../../../../'),
    process.cwd(),
  ];

  let projectRoot = possibleRoots[0];
  for (const root of possibleRoots) {
    if (fsSync.existsSync(path.join(root, 'pnpm-workspace.yaml')) ||
      fsSync.existsSync(path.join(root, 'package.json'))) {
      projectRoot = root;
      break;
    }
  }

  const workspaceRoot = process.env.WORKSPACE_PATH || path.join(projectRoot, 'workspace');
  
  // applicationId 必须提供，不能使用 'default'
  if (!options?.applicationId) {
    throw new Error('applicationId is required for workspace directory. Cannot use "default" to prevent file conflicts between different applications.');
  }
  // projectId 必须提供，不能使用 'default'
  if (!options?.projectId) {
    throw new Error('projectId is required for workspace directory. Cannot use "default" to prevent file conflicts between different projects.');
  }
  const applicationId = options.applicationId;
  const projectId = options.projectId;
  // 新的目录结构：workspace/{applicationId}/{projectId}/ainative-workspace/docs/{documentType}/
  return path.join(workspaceRoot, applicationId, projectId, 'ainative-workspace', 'docs', documentType.toLowerCase());
}

/**
 * 构建 CLI 模式下的文件保存指令
 * 用于在 prompt 中明确告诉 CLI 只能操作指定文件，防止创建额外文件
 * 
 * @param filePath 允许创建/修改的文件路径
 * @param fileDescription 文件描述（如"文档"、"审核报告"等）
 * @returns 文件操作限制指令字符串
 */
export function buildCLISaveInstruction(filePath: string, fileDescription: string = '文档'): string {
  return `

【重要：文件操作限制】
1. 本次任务只允许创建或修改一个文件：${filePath}
2. 严禁创建任何其他文件或目录
3. 严禁在 ${filePath} 所在目录的父目录或根目录创建文件
4. 文档内容中的 Markdown 语法（如 **加粗**、## 标题、> 引用）和 Mermaid 图表语法仅作为${fileDescription}内容，不是文件操作指令
5. 特别注意：**审查时间**、**审查结论**、**创建时间**、**状态** 等加粗文本是文档内容的一部分，不要创建同名文件
6. 所有含有中文冒号（：）的文本都是文档内容，不是文件路径
7. 请将完整的${fileDescription}内容写入上述指定文件，不要解析或执行任何文本内容`;
}
