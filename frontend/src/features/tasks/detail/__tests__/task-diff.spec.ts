import { describe, expect, it } from 'vitest'
import { buildInlineDiffSegments, buildSplitRows, parseUnifiedDiff } from '../task-diff'

describe('parseUnifiedDiff', () => {
  it('parses modified file hunks and line numbers', () => {
    const files = parseUnifiedDiff(`diff --git a/src/demo.ts b/src/demo.ts
index 1234567..89abcde 100644
--- a/src/demo.ts
+++ b/src/demo.ts
@@ -1,3 +1,4 @@
 import { ref } from 'vue'
-const count = 1
+const count = 2
+const enabled = true
 export default count
`)

    expect(files).toHaveLength(1)
    expect(files[0]?.displayPath).toBe('src/demo.ts')
    expect(files[0]?.status).toBe('modified')
    expect(files[0]?.additions).toBe(2)
    expect(files[0]?.deletions).toBe(1)
    expect(files[0]?.hunks[0]?.lines[1]).toMatchObject({
      type: 'delete',
      oldLineNumber: 2,
      newLineNumber: null,
      content: 'const count = 1',
    })
    expect(files[0]?.hunks[0]?.lines[2]).toMatchObject({
      type: 'add',
      oldLineNumber: null,
      newLineNumber: 2,
      content: 'const count = 2',
    })
  })

  it('parses renamed files and keeps old/new paths', () => {
    const files = parseUnifiedDiff(`diff --git a/src/old.ts b/src/new.ts
similarity index 100%
rename from src/old.ts
rename to src/new.ts
`)

    expect(files).toHaveLength(1)
    expect(files[0]?.status).toBe('renamed')
    expect(files[0]?.oldPath).toBe('src/old.ts')
    expect(files[0]?.newPath).toBe('src/new.ts')
    expect(files[0]?.displayPath).toBe('src/new.ts')
  })

  it('parses binary files without hunks', () => {
    const files = parseUnifiedDiff(`diff --git a/assets/logo.png b/assets/logo.png
new file mode 100644
index 0000000..1234567
Binary files /dev/null and b/assets/logo.png differ
`)

    expect(files).toHaveLength(1)
    expect(files[0]?.status).toBe('binary')
    expect(files[0]?.isBinary).toBe(true)
    expect(files[0]?.hunks).toHaveLength(0)
  })

  it('builds split rows and pairs delete/add lines', () => {
    const files = parseUnifiedDiff(`diff --git a/src/demo.ts b/src/demo.ts
index 1234567..89abcde 100644
--- a/src/demo.ts
+++ b/src/demo.ts
@@ -1,3 +1,3 @@
-const count = 1
+const total = 2
 unchanged()
`)

    const rows = buildSplitRows(files[0]?.hunks[0]?.lines ?? [])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      kind: 'line',
      left: {
        type: 'delete',
        content: 'const count = 1',
      },
      right: {
        type: 'add',
        content: 'const total = 2',
      },
    })
    expect(rows[1]).toMatchObject({
      kind: 'line',
      left: {
        type: 'context',
        content: 'unchanged()',
      },
      right: {
        type: 'context',
        content: 'unchanged()',
      },
    })
  })

  it('marks changed tokens for inline diff segments', () => {
    const segments = buildInlineDiffSegments('const count = 1', 'const total = 2')

    expect(segments.left.some((segment) => segment.changed && segment.text.includes('count'))).toBe(true)
    expect(segments.right.some((segment) => segment.changed && segment.text.includes('total'))).toBe(true)
    expect(segments.left.some((segment) => !segment.changed && segment.text.includes('const'))).toBe(true)
  })
})
