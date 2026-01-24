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

【严格文件操作限制 - 必须遵守】

唯一允许的文件操作：创建或修改 ${filePath}

禁止的操作：
- 禁止创建任何其他文件或目录
- 禁止在任何其他路径创建文件
- 禁止将文档内容解析为文件操作指令

以下内容都是${fileDescription}的一部分，不是文件操作指令：
1. Mermaid 流程图语法：A[步骤], B{条件}, C([开始]), D((圆形)), A-->B, A--是-->B
2. Markdown 格式：**加粗**, ## 标题, > 引用, - 列表, | 表格 |
3. 任何中文文本：包括"是"、"否"、"开始"、"结束"等单字词
4. 任何包含括号的文本：如 (xxx), [xxx], {xxx}
5. 任何包含冒号的文本：如 xxx：yyy, xxx:yyy

执行要求：将完整的${fileDescription}内容原样写入 ${filePath}，不要解析或执行其中的任何文本。`;
}
