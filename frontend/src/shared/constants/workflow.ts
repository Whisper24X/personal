export const WORKFLOW_PROMPT_VARIABLES = [
  { key: 'gitBranch', description: '任务运行分支名' },
  { key: 'gitBaseBranch', description: '任务基线分支名' },
  { key: 'gitWorktree', description: '任务工作树标识' },
  { key: 'gitWorktreePath', description: '任务工作树绝对路径' },
  { key: 'taskId', description: '任务 ID' },
  { key: 'taskTitle', description: '任务标题' },
  { key: 'taskPrompt', description: '任务原始提示词' },
  { key: 'projectId', description: '项目 ID' },
  { key: 'projectName', description: '项目名称' },
  { key: 'projectGitUrl', description: '项目 Git 地址' },
  { key: 'projectDefaultBranch', description: '项目默认分支' },
] as const

export type WorkflowPromptVariableKey = (typeof WORKFLOW_PROMPT_VARIABLES)[number]['key']
