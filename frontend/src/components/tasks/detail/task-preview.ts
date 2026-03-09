import type { TaskWorkspacePreview } from '@/types/api/tasks'

export type TaskCodeLanguage =
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'html'
  | 'css'
  | 'markdown'
  | 'shell'
  | 'yaml'
  | 'sql'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'plaintext'

export const formatTaskPreviewSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export const extractTaskPreviewFileName = (path?: string | null) => {
  if (!path) {
    return '未选择文件'
  }

  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

export const resolveTaskPreviewTypeLabel = (preview: TaskWorkspacePreview | null) => {
  if (!preview) {
    return ''
  }

  if (preview.tooLarge) {
    return 'Large File'
  }

  switch (preview.previewType) {
    case 'image':
      return 'Image Preview'
    case 'text':
      return 'Text Preview'
    default:
      return 'Binary File'
  }
}

export const resolveTaskPreviewTextLines = (preview: TaskWorkspacePreview | null) => {
  if (preview?.previewType !== 'text') {
    return [] as string[]
  }

  return (preview.text || '').split('\n')
}

export const resolveTaskCodeLanguage = (
  path?: string | null,
  mimeType?: string | null,
): TaskCodeLanguage => {
  const extension = path?.split('.').pop()?.toLowerCase() || ''
  const normalizedMimeType = mimeType?.toLowerCase() || ''

  if (normalizedMimeType.includes('json') || extension === 'json') {
    return 'json'
  }

  if (
    ['ts', 'tsx', 'mts', 'cts', 'vue'].includes(extension) ||
    normalizedMimeType.includes('typescript')
  ) {
    return 'typescript'
  }

  if (
    ['js', 'jsx', 'mjs', 'cjs'].includes(extension) ||
    normalizedMimeType.includes('javascript')
  ) {
    return 'javascript'
  }

  if (
    ['html', 'htm', 'xml', 'svg'].includes(extension) ||
    normalizedMimeType.includes('html') ||
    normalizedMimeType.includes('xml')
  ) {
    return 'html'
  }

  if (
    ['css', 'scss', 'sass', 'less'].includes(extension) ||
    normalizedMimeType.includes('css')
  ) {
    return 'css'
  }

  if (
    ['md', 'markdown', 'mdx'].includes(extension) ||
    normalizedMimeType.includes('markdown')
  ) {
    return 'markdown'
  }

  if (
    ['sh', 'bash', 'zsh', 'fish'].includes(extension) ||
    normalizedMimeType.includes('shell')
  ) {
    return 'shell'
  }

  if (
    ['yaml', 'yml', 'toml', 'ini'].includes(extension) ||
    normalizedMimeType.includes('yaml')
  ) {
    return 'yaml'
  }

  if (['sql'].includes(extension) || normalizedMimeType.includes('sql')) {
    return 'sql'
  }

  if (['py'].includes(extension) || normalizedMimeType.includes('python')) {
    return 'python'
  }

  if (['go'].includes(extension)) {
    return 'go'
  }

  if (['rs'].includes(extension)) {
    return 'rust'
  }

  if (['java', 'kt'].includes(extension)) {
    return 'java'
  }

  return 'plaintext'
}

export const resolveTaskCodeLanguageLabel = (language: TaskCodeLanguage) => {
  switch (language) {
    case 'typescript':
      return 'TypeScript'
    case 'javascript':
      return 'JavaScript'
    case 'json':
      return 'JSON'
    case 'html':
      return 'HTML'
    case 'css':
      return 'CSS'
    case 'markdown':
      return 'Markdown'
    case 'shell':
      return 'Shell'
    case 'yaml':
      return 'YAML'
    case 'sql':
      return 'SQL'
    case 'python':
      return 'Python'
    case 'go':
      return 'Go'
    case 'rust':
      return 'Rust'
    case 'java':
      return 'Java'
    default:
      return 'Plain Text'
  }
}

const escapeTaskCodeHtml = (value: string) => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

type HighlightPattern = {
  regex: RegExp
  className: string
}

const createHighlightToken = (index: number) => {
  return `${String.fromCodePoint(0xE100 + index)}`
}

const applyHighlightPatterns = (value: string, patterns: HighlightPattern[]) => {
  const replacements: string[] = []
  let result = value

  for (const pattern of patterns) {
    result = result.replace(pattern.regex, (match) => {
      const token = createHighlightToken(replacements.length)
      replacements.push(`<span class="${pattern.className}">${match}</span>`)
      return token
    })
  }

  return replacements.reduce((acc, html, index) => {
    return acc.replaceAll(createHighlightToken(index), html)
  }, result)
}

const createKeywordPattern = (keywords: string[]) => {
  return new RegExp(`\\b(?:${keywords.join('|')})\\b`, 'g')
}

const highlightScriptLikeLine = (value: string, keywords: string[]) => {
  return applyHighlightPatterns(value, [
    {
      regex: /(["'`])(?:\\.|(?!\1).)*\1/g,
      className: 'token-string',
    },
    {
      regex: /\/\/.*$/g,
      className: 'token-comment',
    },
    {
      regex: /\/\*.*?\*\//g,
      className: 'token-comment',
    },
    {
      regex: /@[A-Za-z_][\w-]*/g,
      className: 'token-decorator',
    },
    {
      regex: createKeywordPattern(keywords),
      className: 'token-keyword',
    },
    {
      regex: /\b(?:true|false|null|undefined)\b/g,
      className: 'token-constant',
    },
    {
      regex: /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b/g,
      className: 'token-number',
    },
    {
      regex: /\b[A-Za-z_$][\w$]*(?=\()/g,
      className: 'token-function',
    },
  ])
}

const highlightJsonLine = (value: string) => {
  return applyHighlightPatterns(value, [
    {
      regex: /"(?:\\.|[^"\\])*"(?=\s*:)/g,
      className: 'token-key',
    },
    {
      regex: /"(?:\\.|[^"\\])*"/g,
      className: 'token-string',
    },
    {
      regex: /\b(?:true|false|null)\b/g,
      className: 'token-constant',
    },
    {
      regex: /\b(?:-?\d+(?:\.\d+)?)\b/g,
      className: 'token-number',
    },
  ])
}

const highlightHtmlLine = (value: string) => {
  return applyHighlightPatterns(value, [
    {
      regex: /&lt;!--.*?--&gt;/g,
      className: 'token-comment',
    },
    {
      regex: /&lt;\/?[^&]*?&gt;/g,
      className: 'token-tag',
    },
    {
      regex: /\s[A-Za-z_:][-A-Za-z0-9_:.]*(?==)/g,
      className: 'token-attr',
    },
    {
      regex: /(["'])(?:\\.|(?!\1).)*\1/g,
      className: 'token-string',
    },
  ])
}

const highlightCssLine = (value: string) => {
  return applyHighlightPatterns(value, [
    {
      regex: /\/\*.*?\*\//g,
      className: 'token-comment',
    },
    {
      regex: /(["'])(?:\\.|(?!\1).)*\1/g,
      className: 'token-string',
    },
    {
      regex: /#[\da-fA-F]{3,8}/g,
      className: 'token-number',
    },
    {
      regex: /@[A-Za-z-]+/g,
      className: 'token-keyword',
    },
    {
      regex: /\b[A-Za-z-]+(?=\s*:)/g,
      className: 'token-key',
    },
    {
      regex: /\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?/g,
      className: 'token-number',
    },
  ])
}

const highlightMarkdownLine = (value: string) => {
  return applyHighlightPatterns(value, [
    {
      regex: /^#{1,6}\s.*$/g,
      className: 'token-keyword',
    },
    {
      regex: /^&gt;\s.*$/g,
      className: 'token-comment',
    },
    {
      regex: /`[^`]+`/g,
      className: 'token-string',
    },
    {
      regex: /\[[^\]]+\]\([^)]+\)/g,
      className: 'token-function',
    },
    {
      regex: /\*\*[^*]+\*\*/g,
      className: 'token-keyword',
    },
    {
      regex: /(^\s*(?:[-*+]|\d+\.)\s+)/g,
      className: 'token-number',
    },
  ])
}

const highlightShellLine = (value: string) => {
  return applyHighlightPatterns(value, [
    {
      regex: /(["'`])(?:\\.|(?!\1).)*\1/g,
      className: 'token-string',
    },
    {
      regex: /#.*$/g,
      className: 'token-comment',
    },
    {
      regex: /\$\{?[A-Za-z_][\w]*\}?/g,
      className: 'token-function',
    },
    {
      regex: /(^|\s)--?[\w-]+/g,
      className: 'token-keyword',
    },
    {
      regex: createKeywordPattern(['if', 'then', 'else', 'fi', 'for', 'do', 'done', 'case', 'esac', 'export']),
      className: 'token-keyword',
    },
  ])
}

const highlightYamlLine = (value: string) => {
  return applyHighlightPatterns(value, [
    {
      regex: /#.*$/g,
      className: 'token-comment',
    },
    {
      regex: /^[\s-]*[A-Za-z0-9_"'.-]+(?=\s*:)/g,
      className: 'token-key',
    },
    {
      regex: /(["'])(?:\\.|(?!\1).)*\1/g,
      className: 'token-string',
    },
    {
      regex: /\b(?:true|false|null|yes|no|on|off)\b/g,
      className: 'token-constant',
    },
    {
      regex: /\b\d+(?:\.\d+)?\b/g,
      className: 'token-number',
    },
  ])
}

const highlightSqlLine = (value: string) => {
  return applyHighlightPatterns(value, [
    {
      regex: /'(?:''|[^'])*'/g,
      className: 'token-string',
    },
    {
      regex: /--.*$/g,
      className: 'token-comment',
    },
    {
      regex: createKeywordPattern([
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
        'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
        'ALTER', 'DROP', 'AND', 'OR', 'NOT', 'NULL', 'AS', 'GROUP', 'BY', 'ORDER',
        'LIMIT', 'OFFSET', 'HAVING', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      ]),
      className: 'token-keyword',
    },
    {
      regex: /\b\d+(?:\.\d+)?\b/g,
      className: 'token-number',
    },
  ])
}

export const highlightTaskCodeLine = (line: string, language: TaskCodeLanguage) => {
  const escapedLine = escapeTaskCodeHtml(line)

  if (!escapedLine) {
    return '&nbsp;'
  }

  switch (language) {
    case 'typescript':
      return highlightScriptLikeLine(escapedLine, [
        'abstract', 'any', 'as', 'async', 'await', 'boolean', 'break', 'case', 'catch',
        'class', 'const', 'continue', 'debugger', 'declare', 'default', 'delete', 'do',
        'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function',
        'get', 'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface',
        'is', 'keyof', 'let', 'module', 'namespace', 'new', 'null', 'number', 'of', 'private',
        'protected', 'public', 'readonly', 'return', 'satisfies', 'set', 'static', 'string',
        'super', 'switch', 'symbol', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined',
        'var', 'void', 'while', 'with', 'yield',
      ])
    case 'javascript':
      return highlightScriptLikeLine(escapedLine, [
        'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
        'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for',
        'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'of',
        'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined',
        'var', 'void', 'while', 'with', 'yield',
      ])
    case 'json':
      return highlightJsonLine(escapedLine)
    case 'html':
      return highlightHtmlLine(escapedLine)
    case 'css':
      return highlightCssLine(escapedLine)
    case 'markdown':
      return highlightMarkdownLine(escapedLine)
    case 'shell':
      return highlightShellLine(escapedLine)
    case 'yaml':
      return highlightYamlLine(escapedLine)
    case 'sql':
      return highlightSqlLine(escapedLine)
    case 'python':
      return highlightScriptLikeLine(escapedLine, [
        'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
        'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'if', 'import', 'in', 'is',
        'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield',
      ])
    case 'go':
      return highlightScriptLikeLine(escapedLine, [
        'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough',
        'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range',
        'return', 'select', 'struct', 'switch', 'type', 'var',
      ])
    case 'rust':
      return highlightScriptLikeLine(escapedLine, [
        'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
        'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut',
        'pub', 'ref', 'return', 'Self', 'self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
      ])
    case 'java':
      return highlightScriptLikeLine(escapedLine, [
        'abstract', 'boolean', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default',
        'do', 'else', 'enum', 'extends', 'false', 'final', 'finally', 'for', 'if', 'implements',
        'import', 'instanceof', 'interface', 'new', 'null', 'package', 'private', 'protected',
        'public', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'void', 'while',
      ])
    default:
      return escapedLine
  }
}
