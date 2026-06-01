export type TaskWorkspaceChangeKind = 'add' | 'change' | 'unlink';

export type TaskWorkspaceChangeEntry = {
  path: string;
  kind: TaskWorkspaceChangeKind;
};

export type TaskWorkspaceChangeEvent = {
  id: string;
  taskId: string;
  changedAt: string;
  changes: TaskWorkspaceChangeEntry[];
  truncated: boolean;
};
