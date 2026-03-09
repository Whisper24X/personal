import { describe, expect, it } from 'vitest'
import {
  createTaskFileTreeNodes,
  findTaskFileTreeNode,
  updateTaskFileTreeChildren,
} from '../task-file-tree'

describe('task-file-tree helpers', () => {
  it('sorts directories before files with numeric order', () => {
    const nodes = createTaskFileTreeNodes([
      { name: 'file-10.ts', path: 'file-10.ts', isDir: false },
      { name: 'src', path: 'src', isDir: true },
      { name: 'file-2.ts', path: 'file-2.ts', isDir: false },
      { name: 'docs', path: 'docs', isDir: true },
    ])

    expect(nodes.map((node) => node.path)).toEqual(['docs', 'src', 'file-2.ts', 'file-10.ts'])
  })

  it('updates directory children recursively and marks them loaded', () => {
    const rootNodes = createTaskFileTreeNodes([
      { name: 'src', path: 'src', isDir: true },
      { name: 'README.md', path: 'README.md', isDir: false },
    ])

    const withSrcChildren = updateTaskFileTreeChildren(rootNodes, 'src', [
      { name: 'components', path: 'src/components', isDir: true },
      { name: 'main.ts', path: 'src/main.ts', isDir: false },
    ])

    const srcNode = findTaskFileTreeNode(withSrcChildren, 'src')
    expect(srcNode?.childrenLoaded).toBe(true)
    expect(srcNode?.children?.map((node) => node.path)).toEqual(['src/components', 'src/main.ts'])

    const withNestedChildren = updateTaskFileTreeChildren(withSrcChildren, 'src/components', [
      { name: 'TaskFileTree.vue', path: 'src/components/TaskFileTree.vue', isDir: false },
    ])

    const componentsNode = findTaskFileTreeNode(withNestedChildren, 'src/components')
    expect(componentsNode?.childrenLoaded).toBe(true)
    expect(componentsNode?.children?.map((node) => node.path)).toEqual(['src/components/TaskFileTree.vue'])
  })
})
