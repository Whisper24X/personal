export type TaskDiffFileStatus =
  | 'added'
  | 'deleted'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'binary'
  | 'unknown'

export type TaskDiffLineType = 'context' | 'add' | 'delete' | 'meta'

export type TaskDiffLine = {
  type: TaskDiffLineType
  raw: string
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

export type TaskDiffInlineSegment = {
  text: string
  changed: boolean
}

export type TaskDiffHunk = {
  header: string
  oldStart: number
  oldLength: number
  newStart: number
  newLength: number
  lines: TaskDiffLine[]
}

export type TaskDiffFile = {
  id: string
  oldPath: string | null
  newPath: string | null
  displayPath: string
  status: TaskDiffFileStatus
  metaLines: string[]
  hunks: TaskDiffHunk[]
  isBinary: boolean
  additions: number
  deletions: number
}

export type TaskDiffSplitRow =
  | {
      kind: 'meta'
      metaText: string
    }
  | {
      kind: 'line'
      left: TaskDiffLine | null
      right: TaskDiffLine | null
      leftSegments?: TaskDiffInlineSegment[]
      rightSegments?: TaskDiffInlineSegment[]
    }

type MutableTaskDiffFile = Omit<TaskDiffFile, 'status'> & {
  statusHint: TaskDiffFileStatus
}

const DIFF_FILE_RE = /^diff --git a\/(.+?) b\/(.+)$/
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

function createEmptyFile(oldPath: string | null, newPath: string | null): MutableTaskDiffFile {
  return {
    id: `${oldPath ?? 'dev-null'}:${newPath ?? 'dev-null'}`,
    oldPath,
    newPath,
    displayPath: newPath ?? oldPath ?? '未知文件',
    statusHint: 'modified',
    metaLines: [],
    hunks: [],
    isBinary: false,
    additions: 0,
    deletions: 0,
  }
}

function normalizePathMarker(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '/dev/null') {
    return null
  }

  if (trimmed.startsWith('a/') || trimmed.startsWith('b/')) {
    return trimmed.slice(2)
  }

  return trimmed
}

function finalizeFile(file: MutableTaskDiffFile | null): TaskDiffFile | null {
  if (!file) {
    return null
  }

  let status = file.statusHint
  if (file.isBinary) {
    status = 'binary'
  } else if (file.oldPath === null && file.newPath) {
    status = 'added'
  } else if (file.newPath === null && file.oldPath) {
    status = 'deleted'
  } else if (file.statusHint === 'unknown') {
    status = 'modified'
  }

  return {
    id: file.id,
    oldPath: file.oldPath,
    newPath: file.newPath,
    displayPath: file.newPath ?? file.oldPath ?? '未知文件',
    status,
    metaLines: file.metaLines,
    hunks: file.hunks,
    isBinary: file.isBinary,
    additions: file.additions,
    deletions: file.deletions,
  }
}

function createLine(
  type: TaskDiffLineType,
  raw: string,
  content: string,
  oldLineNumber: number | null,
  newLineNumber: number | null,
): TaskDiffLine {
  return {
    type,
    raw,
    content,
    oldLineNumber,
    newLineNumber,
  }
}

function tokenizeForInlineDiff(value: string): string[] {
  const matches = value.match(/(\s+|[A-Za-z0-9_]+|[^A-Za-z0-9_\s])/g)
  return matches?.length ? matches : [value]
}

function compressSegments(segments: TaskDiffInlineSegment[]): TaskDiffInlineSegment[] {
  const compacted: TaskDiffInlineSegment[] = []

  for (const segment of segments) {
    if (!segment.text) {
      continue
    }

    const previous = compacted[compacted.length - 1]
    if (previous && previous.changed === segment.changed) {
      previous.text += segment.text
      continue
    }

    compacted.push({ ...segment })
  }

  return compacted
}

export function buildInlineDiffSegments(
  leftText: string,
  rightText: string,
): {
  left: TaskDiffInlineSegment[]
  right: TaskDiffInlineSegment[]
} {
  if (leftText === rightText) {
    return {
      left: [{ text: leftText, changed: false }],
      right: [{ text: rightText, changed: false }],
    }
  }

  const leftTokens = tokenizeForInlineDiff(leftText)
  const rightTokens = tokenizeForInlineDiff(rightText)
  const cellCount = leftTokens.length * rightTokens.length

  if (cellCount > 12_000) {
    return {
      left: [{ text: leftText, changed: true }],
      right: [{ text: rightText, changed: true }],
    }
  }

  const dp = Array.from({ length: leftTokens.length + 1 }, () =>
    Array<number>(rightTokens.length + 1).fill(0),
  )

  for (let leftIndex = leftTokens.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightTokens.length - 1; rightIndex >= 0; rightIndex -= 1) {
      if (leftTokens[leftIndex] === rightTokens[rightIndex]) {
        dp[leftIndex]![rightIndex] = (dp[leftIndex + 1]![rightIndex + 1] ?? 0) + 1
      } else {
        dp[leftIndex]![rightIndex] = Math.max(
          dp[leftIndex + 1]![rightIndex] ?? 0,
          dp[leftIndex]![rightIndex + 1] ?? 0,
        )
      }
    }
  }

  const leftSegments: TaskDiffInlineSegment[] = []
  const rightSegments: TaskDiffInlineSegment[] = []
  let leftIndex = 0
  let rightIndex = 0

  while (leftIndex < leftTokens.length && rightIndex < rightTokens.length) {
    const leftToken = leftTokens[leftIndex] ?? ''
    const rightToken = rightTokens[rightIndex] ?? ''

    if (leftToken === rightToken) {
      leftSegments.push({ text: leftToken, changed: false })
      rightSegments.push({ text: rightToken, changed: false })
      leftIndex += 1
      rightIndex += 1
      continue
    }

    const skipLeft = dp[leftIndex + 1]![rightIndex] ?? 0
    const skipRight = dp[leftIndex]![rightIndex + 1] ?? 0

    if (skipLeft >= skipRight) {
      leftSegments.push({ text: leftToken, changed: true })
      leftIndex += 1
      continue
    }

    rightSegments.push({ text: rightToken, changed: true })
    rightIndex += 1
  }

  while (leftIndex < leftTokens.length) {
    leftSegments.push({ text: leftTokens[leftIndex] ?? '', changed: true })
    leftIndex += 1
  }

  while (rightIndex < rightTokens.length) {
    rightSegments.push({ text: rightTokens[rightIndex] ?? '', changed: true })
    rightIndex += 1
  }

  return {
    left: compressSegments(leftSegments),
    right: compressSegments(rightSegments),
  }
}

export function buildSplitRows(lines: TaskDiffLine[]): TaskDiffSplitRow[] {
  const rows: TaskDiffSplitRow[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line) {
      break
    }

    if (line.type === 'meta') {
      rows.push({
        kind: 'meta',
        metaText: line.raw,
      })
      index += 1
      continue
    }

    if (line.type === 'context') {
      rows.push({
        kind: 'line',
        left: line,
        right: line,
      })
      index += 1
      continue
    }

    if (line.type === 'delete') {
      const deleteGroup: TaskDiffLine[] = []
      while (lines[index]?.type === 'delete') {
        deleteGroup.push(lines[index]!)
        index += 1
      }

      const addGroup: TaskDiffLine[] = []
      while (lines[index]?.type === 'add') {
        addGroup.push(lines[index]!)
        index += 1
      }

      const pairCount = Math.max(deleteGroup.length, addGroup.length)
      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const left = deleteGroup[pairIndex] ?? null
        const right = addGroup[pairIndex] ?? null

        if (left && right) {
          const segments = buildInlineDiffSegments(left.content, right.content)
          rows.push({
            kind: 'line',
            left,
            right,
            leftSegments: segments.left,
            rightSegments: segments.right,
          })
          continue
        }

        rows.push({
          kind: 'line',
          left,
          right,
        })
      }
      continue
    }

    if (line.type === 'add') {
      rows.push({
        kind: 'line',
        left: null,
        right: line,
      })
      index += 1
      continue
    }

    index += 1
  }

  return rows
}

export function parseUnifiedDiff(diffText: string): TaskDiffFile[] {
  if (!diffText.trim()) {
    return []
  }

  if (!/^(diff --git |@@ |--- |\+\+\+ )/m.test(diffText)) {
    return []
  }

  const files: TaskDiffFile[] = []
  const normalizedText = diffText.replaceAll('\r\n', '\n')
  const lines = normalizedText.endsWith('\n')
    ? normalizedText.slice(0, -1).split('\n')
    : normalizedText.split('\n')

  let currentFile: MutableTaskDiffFile | null = null
  let currentHunk: TaskDiffHunk | null = null
  let oldLineCursor = 0
  let newLineCursor = 0

  const pushCurrentFile = () => {
    const nextFile = finalizeFile(currentFile)
    if (nextFile) {
      files.push(nextFile)
    }
    currentFile = null
    currentHunk = null
    oldLineCursor = 0
    newLineCursor = 0
  }

  const ensureFile = () => {
    if (!currentFile) {
      currentFile = createEmptyFile(null, null)
    }
    return currentFile
  }

  for (const line of lines) {
    const diffMatch = line.match(DIFF_FILE_RE)
    if (diffMatch) {
      pushCurrentFile()
      currentFile = createEmptyFile(diffMatch[1] ?? null, diffMatch[2] ?? null)
      currentFile.metaLines.push(line)
      continue
    }

    const file = ensureFile()

    if (line.startsWith('new file mode ')) {
      file.statusHint = 'added'
      file.metaLines.push(line)
      continue
    }

    if (line.startsWith('deleted file mode ')) {
      file.statusHint = 'deleted'
      file.metaLines.push(line)
      continue
    }

    if (line.startsWith('rename from ')) {
      file.statusHint = 'renamed'
      file.oldPath = line.slice('rename from '.length).trim() || file.oldPath
      file.displayPath = file.newPath ?? file.oldPath ?? file.displayPath
      file.metaLines.push(line)
      continue
    }

    if (line.startsWith('rename to ')) {
      file.statusHint = 'renamed'
      file.newPath = line.slice('rename to '.length).trim() || file.newPath
      file.displayPath = file.newPath ?? file.oldPath ?? file.displayPath
      file.metaLines.push(line)
      continue
    }

    if (line.startsWith('copy from ')) {
      file.statusHint = 'copied'
      file.metaLines.push(line)
      continue
    }

    if (line.startsWith('copy to ')) {
      file.statusHint = 'copied'
      file.metaLines.push(line)
      continue
    }

    if (line.startsWith('Binary files ') || line === 'GIT binary patch') {
      file.isBinary = true
      file.statusHint = 'binary'
      file.metaLines.push(line)
      continue
    }

    if (line.startsWith('--- ')) {
      file.oldPath = normalizePathMarker(line.slice(4))
      file.displayPath = file.newPath ?? file.oldPath ?? file.displayPath
      file.metaLines.push(line)
      continue
    }

    if (line.startsWith('+++ ')) {
      file.newPath = normalizePathMarker(line.slice(4))
      file.displayPath = file.newPath ?? file.oldPath ?? file.displayPath
      file.metaLines.push(line)
      continue
    }

    const hunkMatch = line.match(HUNK_HEADER_RE)
    if (hunkMatch) {
      currentHunk = {
        header: line,
        oldStart: Number.parseInt(hunkMatch[1] ?? '0', 10),
        oldLength: Number.parseInt(hunkMatch[2] ?? '1', 10),
        newStart: Number.parseInt(hunkMatch[3] ?? '0', 10),
        newLength: Number.parseInt(hunkMatch[4] ?? '1', 10),
        lines: [],
      }
      file.hunks.push(currentHunk)
      oldLineCursor = currentHunk.oldStart
      newLineCursor = currentHunk.newStart
      continue
    }

    if (!currentHunk) {
      if (line.length > 0) {
        file.metaLines.push(line)
      }
      continue
    }

    if (line.startsWith('\\ ')) {
      currentHunk.lines.push(createLine('meta', line, line, null, null))
      continue
    }

    if (line.startsWith('+')) {
      currentHunk.lines.push(
        createLine('add', line, line.slice(1), null, newLineCursor),
      )
      file.additions += 1
      newLineCursor += 1
      continue
    }

    if (line.startsWith('-')) {
      currentHunk.lines.push(
        createLine('delete', line, line.slice(1), oldLineCursor, null),
      )
      file.deletions += 1
      oldLineCursor += 1
      continue
    }

    if (line.startsWith(' ')) {
      currentHunk.lines.push(
        createLine(
          'context',
          line,
          line.slice(1),
          oldLineCursor,
          newLineCursor,
        ),
      )
      oldLineCursor += 1
      newLineCursor += 1
      continue
    }

    currentHunk.lines.push(createLine('meta', line, line, null, null))
  }

  pushCurrentFile()
  return files
}
