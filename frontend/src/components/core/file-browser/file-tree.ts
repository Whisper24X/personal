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

/**
 * Build a fully-expanded tree from a flat list of file paths.
 * Useful when the full file list is available upfront (e.g. project docs).
 */
export const buildFileTreeFromPaths = (
  items: Array<{ path: string; name: string }>,
): { nodes: FileTreeNode[]; dirPaths: string[] } => {
  const dirSet = new Set<string>()

  for (const item of items) {
    const segments = item.path.split('/').filter(Boolean)
    for (let i = 1; i < segments.length; i++) {
      dirSet.add(segments.slice(0, i).join('/'))
    }
  }

  const allEntries: FileBrowserEntry[] = []
  const dirPaths: string[] = []

  for (const dirPath of dirSet) {
    const segments = dirPath.split('/')
    allEntries.push({
      name: segments[segments.length - 1]!,
      path: dirPath,
      isDir: true,
    })
    dirPaths.push(dirPath)
  }

  for (const item of items) {
    allEntries.push({
      name: item.name,
      path: item.path,
      isDir: false,
    })
  }

  const getParentPath = (path: string) => {
    const idx = path.lastIndexOf('/')
    return idx === -1 ? '' : path.substring(0, idx)
  }

  const childrenMap = new Map<string, FileBrowserEntry[]>()
  for (const entry of allEntries) {
    const parent = getParentPath(entry.path)
    let bucket = childrenMap.get(parent)
    if (!bucket) {
      bucket = []
      childrenMap.set(parent, bucket)
    }
    bucket.push(entry)
  }

  const build = (parentPath: string): FileTreeNode[] => {
    const children = childrenMap.get(parentPath) ?? []
    return sortFileTreeEntries(children).map((entry) => ({
      ...entry,
      children: entry.isDir ? build(entry.path) : undefined,
      childrenLoaded: entry.isDir ? true : undefined,
    }))
  }

  return { nodes: build(''), dirPaths }
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
