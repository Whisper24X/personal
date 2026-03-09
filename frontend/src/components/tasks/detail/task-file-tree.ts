import type { TaskWorkspaceEntry } from '@/types/api/tasks'

export type TaskFileTreeNode = TaskWorkspaceEntry & {
  children?: TaskFileTreeNode[]
  childrenLoaded?: boolean
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

export const sortTaskFileTreeEntries = <T extends TaskWorkspaceEntry>(entries: T[]) => {
  return [...entries].sort((left, right) => {
    if (left.isDir && !right.isDir) return -1
    if (!left.isDir && right.isDir) return 1
    return collator.compare(left.name, right.name)
  })
}

export const createTaskFileTreeNodes = (entries: TaskWorkspaceEntry[]): TaskFileTreeNode[] => {
  return sortTaskFileTreeEntries(entries).map((entry) => ({ ...entry }))
}

export const updateTaskFileTreeChildren = (
  nodes: TaskFileTreeNode[],
  targetPath: string,
  children: TaskWorkspaceEntry[],
): TaskFileTreeNode[] => {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return {
        ...node,
        children: createTaskFileTreeNodes(children),
        childrenLoaded: true,
      }
    }

    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateTaskFileTreeChildren(node.children, targetPath, children),
      }
    }

    return node
  })
}

export const findTaskFileTreeNode = (
  nodes: TaskFileTreeNode[],
  targetPath: string,
): TaskFileTreeNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node
    }

    if (node.children && node.children.length > 0) {
      const matched = findTaskFileTreeNode(node.children, targetPath)
      if (matched) {
        return matched
      }
    }
  }

  return null
}
