import { ref, type Ref } from 'vue'
import { businessLinesApi } from '@/api/business-lines'
import { toErrorMessage } from '@api/shared/to-error-message'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import type { Skill, SkillTreeNode } from '@/types/api/skills'
import type { Mcp } from '@/types/api/mcps'

type MessageLike = {
  success: (msg: string) => void
  error: (msg: string) => void
}

export function useBlmLocalSkillsAndMcps(activeLineId: Ref<string>, message: MessageLike) {
  const loadingLocalSkills = ref(false)
  const skillKeyword = ref('')
  const removingLocalSkillId = ref('')
  const downloadingLocalSkillId = ref('')
  const loadingLocalMcps = ref(false)
  const uploadSkillModalOpen = ref(false)
  const uploadingLocalSkill = ref(false)
  const uploadSkillError = ref('')
  const mcpJsonImportModalOpen = ref(false)
  const importingLocalMcps = ref(false)
  const mcpJsonImportError = ref('')
  const mcpJsonPreviewModalOpen = ref(false)
  const loadingMcpJsonPreview = ref(false)
  const mcpJsonPreviewItem = ref<Mcp | null>(null)
  const mcpJsonPreviewName = ref('')
  const mcpJsonPreviewSourcePath = ref('')
  const mcpJsonPreviewError = ref('')
  const mcpJsonPreviewDraft = ref('')
  const savingMcpJsonPreview = ref(false)
  const skillPreviewModalOpen = ref(false)
  const loadingSkillPreview = ref(false)
  const skillPreviewItem = ref<Skill | null>(null)
  const skillPreviewId = ref('')
  const skillPreviewName = ref('')
  const skillPreviewTree = ref<SkillTreeNode[]>([])
  const skillPreviewContent = ref('')
  const skillPreviewSelectedPath = ref('')
  const skillPreviewFileLoading = ref(false)
  const skillPreviewError = ref('')
  const skillPreviewRequestToken = ref(0)
  const skillPreviewExpandedDirs = ref(new Set<string>())
  const localSkills = ref<Skill[]>([])
  const localMcps = ref<Mcp[]>([])
  const removingLocalMcpId = ref('')

  const loadLocalSkills = async (lineId: string) => {
    if (!lineId) {
      localSkills.value = []
      return
    }

    loadingLocalSkills.value = true

    try {
      const keyword = skillKeyword.value.trim() || undefined
      const skills = await businessLinesApi.listLocalSkills(lineId, { keyword })
      if (lineId !== activeLineId.value) {
        return
      }

      localSkills.value = skills
    } catch (error) {
      if (lineId === activeLineId.value) {
        localSkills.value = []
        message.error(toErrorMessage(error, '加载业务线本地 Skill 失败'))
      }
    } finally {
      if (lineId === activeLineId.value) {
        loadingLocalSkills.value = false
      }
    }
  }

  const downloadLocalSkill = async (item: Skill) => {
    if (!activeLineId.value || downloadingLocalSkillId.value) {
      return
    }

    downloadingLocalSkillId.value = item.id

    try {
      const token = localStorage.getItem(STORAGE_KEYS.authToken)
      const url = `/api/v1/business-lines/${encodeURIComponent(activeLineId.value)}/local-skills/${encodeURIComponent(item.id)}/download`
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error(`下载失败 (${response.status})`)
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition')
      const fileNameMatch = disposition?.match(/filename="?([^"]+)"?/)
      const fileName = fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1]) : `${item.name}.zip`

      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(anchor.href)
    } catch (error) {
      message.error(toErrorMessage(error, '下载技能失败'))
    } finally {
      downloadingLocalSkillId.value = ''
    }
  }

  const removeLocalSkill = async (item: Skill) => {
    if (!activeLineId.value || removingLocalSkillId.value) {
      return
    }

    if (!window.confirm(`确认删除技能「${item.name}」吗？此操作不可撤销。`)) {
      return
    }

    removingLocalSkillId.value = item.id

    try {
      await businessLinesApi.removeLocalSkill(activeLineId.value, item.id)
      if (skillPreviewItem.value?.id === item.id) {
        closeSkillPreview()
      }
      await loadLocalSkills(activeLineId.value)
      message.success(`技能「${item.name}」已删除`)
    } catch (error) {
      message.error(toErrorMessage(error, '删除技能失败'))
    } finally {
      removingLocalSkillId.value = ''
    }
  }

  const openUploadSkillModal = () => {
    if (!activeLineId.value) {
      return
    }

    uploadSkillError.value = ''
    uploadSkillModalOpen.value = true
  }

  const submitUploadSkill = async (file: File) => {
    if (!activeLineId.value) {
      return
    }

    uploadingLocalSkill.value = true
    uploadSkillError.value = ''

    try {
      const uploadedSkill = await businessLinesApi.uploadLocalSkill(activeLineId.value, file)
      uploadSkillModalOpen.value = false
      await loadLocalSkills(activeLineId.value)
      message.success(`Skill「${uploadedSkill.name}」上传成功`)
    } catch (error) {
      uploadSkillError.value = toErrorMessage(error, '上传 Skill 失败')
      message.error(uploadSkillError.value)
    } finally {
      uploadingLocalSkill.value = false
    }
  }

  const resetSkillPreviewState = () => {
    skillPreviewRequestToken.value += 1
    skillPreviewModalOpen.value = false
    loadingSkillPreview.value = false
    skillPreviewItem.value = null
    skillPreviewId.value = ''
    skillPreviewName.value = ''
    skillPreviewTree.value = []
    skillPreviewContent.value = ''
    skillPreviewSelectedPath.value = ''
    skillPreviewFileLoading.value = false
    skillPreviewError.value = ''
    skillPreviewExpandedDirs.value = new Set()
  }

  const closeSkillPreview = () => {
    resetSkillPreviewState()
  }

  const toggleSkillPreviewDir = (dirPath: string) => {
    const expanded = skillPreviewExpandedDirs.value
    if (expanded.has(dirPath)) {
      expanded.delete(dirPath)
    } else {
      expanded.add(dirPath)
    }
  }

  const loadSkillPreviewFile = async (skillId: string, filePath: string) => {
    if (!activeLineId.value) return

    skillPreviewSelectedPath.value = filePath
    skillPreviewFileLoading.value = true
    skillPreviewContent.value = ''
    const requestToken = skillPreviewRequestToken.value

    try {
      const response = await businessLinesApi.localSkillFile(activeLineId.value, skillId, filePath)
      if (requestToken !== skillPreviewRequestToken.value) return
      skillPreviewContent.value = response.content
    } catch (error) {
      if (requestToken !== skillPreviewRequestToken.value) return
      skillPreviewContent.value = ''
      skillPreviewError.value = toErrorMessage(error, '加载文件失败')
    } finally {
      if (requestToken === skillPreviewRequestToken.value) {
        skillPreviewFileLoading.value = false
      }
    }
  }

  const findSkillMdInTree = (nodes: SkillTreeNode[]): string | null => {
    for (const node of nodes) {
      if (!node.isDir && node.name.toLowerCase() === 'skill.md') {
        return node.path
      }
    }
    return null
  }

  const openSkillPreview = async (item: Skill) => {
    if (!activeLineId.value) {
      return
    }

    const requestToken = ++skillPreviewRequestToken.value
    skillPreviewModalOpen.value = true
    loadingSkillPreview.value = true
    skillPreviewItem.value = item
    skillPreviewId.value = item.id
    skillPreviewName.value = item.name
    skillPreviewTree.value = []
    skillPreviewContent.value = ''
    skillPreviewSelectedPath.value = ''
    skillPreviewError.value = ''
    skillPreviewExpandedDirs.value = new Set()

    try {
      const response = await businessLinesApi.localSkillTree(activeLineId.value, item.id)

      if (requestToken !== skillPreviewRequestToken.value) return

      skillPreviewTree.value = response.tree
      const defaultFile = findSkillMdInTree(response.tree)
      if (defaultFile) {
        await loadSkillPreviewFile(item.id, defaultFile)
      }
    } catch (error) {
      if (requestToken !== skillPreviewRequestToken.value) return
      skillPreviewError.value = toErrorMessage(error, '加载技能目录失败')
    } finally {
      if (requestToken === skillPreviewRequestToken.value) {
        loadingSkillPreview.value = false
      }
    }
  }

  const loadLocalMcps = async (lineId: string) => {
    if (!lineId) {
      localMcps.value = []
      return
    }

    loadingLocalMcps.value = true

    try {
      const mcps = await businessLinesApi.listLocalMcps(lineId)
      if (lineId !== activeLineId.value) {
        return
      }

      localMcps.value = mcps
    } catch (error) {
      if (lineId === activeLineId.value) {
        localMcps.value = []
        message.error(toErrorMessage(error, '加载业务线本地 MCP 失败'))
      }
    } finally {
      if (lineId === activeLineId.value) {
        loadingLocalMcps.value = false
      }
    }
  }

  const openImportMcpJsonModal = () => {
    if (!activeLineId.value) {
      return
    }

    mcpJsonImportError.value = ''
    mcpJsonImportModalOpen.value = true
  }

  const submitImportMcpJson = async (payload: Record<string, unknown>) => {
    if (!activeLineId.value) {
      return
    }

    importingLocalMcps.value = true
    mcpJsonImportError.value = ''

    try {
      const result = await businessLinesApi.importLocalMcps(activeLineId.value, {
        payload,
      })
      mcpJsonImportModalOpen.value = false
      await loadLocalMcps(activeLineId.value)

      const summary =
        result.overwrittenCount > 0
          ? `导入 ${result.importedCount} 个，覆盖 ${result.overwrittenCount} 个`
          : `导入 ${result.importedCount} 个`
      message.success(`MCP 添加成功（${summary}）`)
    } catch (error) {
      mcpJsonImportError.value = toErrorMessage(error, '添加 MCP 失败')
      message.error(mcpJsonImportError.value)
    } finally {
      importingLocalMcps.value = false
    }
  }

  const resolveMcpSourcePath = (item: Mcp) => {
    const absolute = item.metadataJson?.sourcePathAbsolute
    if (typeof absolute === 'string' && absolute.trim()) {
      return absolute.trim()
    }
    const sourcePath = item.metadataJson?.sourcePath
    if (typeof sourcePath !== 'string') {
      return ''
    }
    return sourcePath.trim()
  }

  const resetMcpJsonPreviewState = () => {
    mcpJsonPreviewModalOpen.value = false
    loadingMcpJsonPreview.value = false
    mcpJsonPreviewItem.value = null
    mcpJsonPreviewName.value = ''
    mcpJsonPreviewSourcePath.value = ''
    mcpJsonPreviewError.value = ''
    mcpJsonPreviewDraft.value = ''
    savingMcpJsonPreview.value = false
  }

  const closeMcpJsonPreview = () => {
    if (savingMcpJsonPreview.value) {
      return
    }

    resetMcpJsonPreviewState()
  }

  const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  const resolveMcpConfigFromDraft = (
    parsedPayload: unknown,
    mcpName: string,
  ): Record<string, unknown> => {
    if (!isRecord(parsedPayload)) {
      throw new Error('JSON 顶层必须是对象')
    }

    const mcpServers = parsedPayload.mcpServers
    if (isRecord(mcpServers) && isRecord(mcpServers[mcpName])) {
      return mcpServers[mcpName]
    }

    const keys = Object.keys(parsedPayload)
    if (keys.length === 1) {
      const onlyKey = keys[0]
      if (onlyKey && isRecord(parsedPayload[onlyKey])) {
        return parsedPayload[onlyKey]
      }
    }

    if (isRecord(parsedPayload[mcpName])) {
      return parsedPayload[mcpName]
    }

    if (
      typeof parsedPayload.command === 'string' ||
      typeof parsedPayload.url === 'string' ||
      Array.isArray(parsedPayload.args)
    ) {
      return parsedPayload
    }

    throw new Error('未找到可保存的 MCP 配置对象')
  }

  const openMcpJsonPreview = async (item: Mcp) => {
    if (!activeLineId.value) {
      return
    }

    const sourcePath = resolveMcpSourcePath(item)
    if (!sourcePath) {
      message.error('未找到 MCP 源配置路径')
      return
    }

    mcpJsonPreviewModalOpen.value = true
    loadingMcpJsonPreview.value = true
    mcpJsonPreviewItem.value = item
    mcpJsonPreviewName.value = item.name
    mcpJsonPreviewSourcePath.value = sourcePath
    mcpJsonPreviewError.value = ''
    mcpJsonPreviewDraft.value = ''

    try {
      const response = await businessLinesApi.getLocalMcpConfig(activeLineId.value, {
        name: item.name,
        sourcePath,
      })
      mcpJsonPreviewDraft.value = JSON.stringify(
        {
          mcpServers: {
            [response.name]: response.config,
          },
        },
        null,
        2,
      )
    } catch (error) {
      mcpJsonPreviewError.value = toErrorMessage(error, '读取 MCP JSON 失败')
    } finally {
      loadingMcpJsonPreview.value = false
    }
  }

  const removeLocalMcp = async (item: Mcp) => {
    if (!activeLineId.value || removingLocalMcpId.value) {
      return
    }

    const sourcePath = resolveMcpSourcePath(item)
    if (!sourcePath) {
      message.error('未找到 MCP 源配置路径')
      return
    }

    if (!window.confirm(`确认删除 MCP「${item.name}」吗？`)) {
      return
    }

    removingLocalMcpId.value = item.id

    try {
      await businessLinesApi.removeLocalMcp(activeLineId.value, {
        name: item.name,
        sourcePath,
      })
      if (mcpJsonPreviewItem.value?.id === item.id) {
        resetMcpJsonPreviewState()
      }
      await loadLocalMcps(activeLineId.value)
      message.success(`MCP「${item.name}」已删除`)
    } catch (error) {
      message.error(toErrorMessage(error, '删除 MCP 失败'))
    } finally {
      removingLocalMcpId.value = ''
    }
  }

  const saveMcpJsonPreview = async () => {
    if (!activeLineId.value || !mcpJsonPreviewName.value) {
      return
    }

    let parsedPayload: unknown
    try {
      parsedPayload = JSON.parse(mcpJsonPreviewDraft.value)
    } catch {
      mcpJsonPreviewError.value = 'JSON 格式不合法'
      return
    }

    let nextConfig: Record<string, unknown>
    try {
      nextConfig = resolveMcpConfigFromDraft(parsedPayload, mcpJsonPreviewName.value)
    } catch (error) {
      mcpJsonPreviewError.value = error instanceof Error ? error.message : '无法解析 MCP 配置'
      return
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, 'description')) {
      delete nextConfig.description
    }

    savingMcpJsonPreview.value = true
    mcpJsonPreviewError.value = ''

    try {
      await businessLinesApi.importLocalMcps(activeLineId.value, {
        payload: {
          mcpServers: {
            [mcpJsonPreviewName.value]: nextConfig,
          },
        },
      })

      const refreshed = await businessLinesApi.getLocalMcpConfig(activeLineId.value, {
        name: mcpJsonPreviewName.value,
        sourcePath: mcpJsonPreviewSourcePath.value,
      })
      mcpJsonPreviewDraft.value = JSON.stringify(
        {
          mcpServers: {
            [refreshed.name]: refreshed.config,
          },
        },
        null,
        2,
      )
      await loadLocalMcps(activeLineId.value)
      message.success(`MCP「${mcpJsonPreviewName.value}」保存成功`)
      resetMcpJsonPreviewState()
    } catch (error) {
      mcpJsonPreviewError.value = toErrorMessage(error, '保存 MCP JSON 失败')
    } finally {
      savingMcpJsonPreview.value = false
    }
  }

  return {
    resetSkillPreviewState,
    resetMcpJsonPreviewState,
    loadingLocalSkills,
    skillKeyword,
    removingLocalSkillId,
    downloadingLocalSkillId,
    loadingLocalMcps,
    uploadSkillModalOpen,
    uploadingLocalSkill,
    uploadSkillError,
    mcpJsonImportModalOpen,
    importingLocalMcps,
    mcpJsonImportError,
    mcpJsonPreviewModalOpen,
    loadingMcpJsonPreview,
    mcpJsonPreviewItem,
    mcpJsonPreviewName,
    mcpJsonPreviewSourcePath,
    mcpJsonPreviewError,
    mcpJsonPreviewDraft,
    savingMcpJsonPreview,
    skillPreviewModalOpen,
    loadingSkillPreview,
    skillPreviewItem,
    skillPreviewId,
    skillPreviewName,
    skillPreviewTree,
    skillPreviewContent,
    skillPreviewSelectedPath,
    skillPreviewFileLoading,
    skillPreviewError,
    skillPreviewRequestToken,
    skillPreviewExpandedDirs,
    localSkills,
    localMcps,
    removingLocalMcpId,
    loadLocalSkills,
    downloadLocalSkill,
    removeLocalSkill,
    openUploadSkillModal,
    submitUploadSkill,
    closeSkillPreview,
    toggleSkillPreviewDir,
    loadSkillPreviewFile,
    openSkillPreview,
    loadLocalMcps,
    openImportMcpJsonModal,
    submitImportMcpJson,
    closeMcpJsonPreview,
    openMcpJsonPreview,
    removeLocalMcp,
    saveMcpJsonPreview,
  }
}
