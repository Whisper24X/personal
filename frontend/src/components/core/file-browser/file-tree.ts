import type { FileBrowserEntry } from './types'

export type FileTreeNode = FileBrowserEntry & {
  children?: FileTreeNode[]
  childrenLoaded?: boolean
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

export const sortFileTreeEntries = <T extends FileBrowserEntry>(entries: T[]) => {
  return [...entries].sort((left, right) => {
    if (left.isDir && !right.isDir) return -1
    if (!left.isDir && right.isDir) return 1
    return collator.compare(left.name, right.name)
  })
}

export const createFileTreeNodes = (entries: FileBrowserEntry[]): FileTreeNode[] => {
  return sortFileTreeEntries(entries).map((entry) => ({ ...entry }))
}

export const updateFileTreeChildren = (
  nodes: FileTreeNode[],
  targetPath: string,
  children: FileBrowserEntry[],
): FileTreeNode[] => {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return {
        ...node,
        children: createFileTreeNodes(children),
        childrenLoaded: true,
      }
    }

    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateFileTreeChildren(node.children, targetPath, children),
      }
    }

    return node
  })
}

export const findFileTreeNode = (
  nodes: FileTreeNode[],
  targetPath: string,
): FileTreeNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node
    }

    if (node.children && node.children.length > 0) {
      const matched = findFileTreeNode(node.children, targetPath)
      if (matched) {
        return matched
      }
    }
  }

  return null
}
