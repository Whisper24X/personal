import type { ComponentPublicInstance } from 'vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from '@app/composables/useMessage'
import { businessLinesApi } from '@/api/business-lines'
import { projectsApi } from '@/api/projects'
import { skillsApi } from '@/api/skills'
import type { ProjectSkillProvider, Skill, SkillTreeNode } from '@/types/api/skills'
import { STORAGE_KEYS } from '@shared/types/common/storage'
import { toErrorMessage } from '@api/shared/to-error-message'
import { fetchAllPages } from '@shared/utils/pagination'
import {
  SKILLS_MAX_PAGE_COUNT as MAX_PAGE_COUNT,
  SKILLS_PAGE_LIMIT as PAGE_LIMIT,
  SKILLS_PROJECT_PROVIDER_LABELS as PROJECT_SKILL_PROVIDER_LABELS,
  SKILLS_PROJECT_PROVIDER_ORDER as PROJECT_SKILL_PROVIDER_ORDER,
} from './skills-page.constants'

export type SkillsPageContext = ReturnType<typeof useSkillsPage>

export function useSkillsPage() {
const route = useRoute()
const message = useMessage()

const loading = ref(false)
const keyword = ref('')
const skills = ref<Skill[]>([])
const projectBusinessLineId = ref('')
const addMenuOpen = ref(false)
const addMenuAnchorRef = ref<HTMLElement | null>(null)
const copySkillModalOpen = ref(false)
const copySkillKeyword = ref('')
const businessLineSkills = ref<Skill[]>([])
const loadingBusinessLineSkills = ref(false)
const copyingBusinessLineSkillId = ref('')
const copySkillErrorMessage = ref('')
const copySkillTargetProviders = ref<ProjectSkillProvider[]>(['cursor'])
const uploadSkillModalOpen = ref(false)
const uploadingProjectSkill = ref(false)
const uploadSkillErrorMessage = ref('')
const projectContextRequestToken = ref(0)
const detailSkill = ref<Skill | null>(null)
const detailTree = ref<SkillTreeNode[]>([])
const detailContent = ref('')
const detailSelectedPath = ref('')
const detailLoading = ref(false)
const detailFileLoading = ref(false)
const detailErrorMessage = ref('')
const detailRequestToken = ref(0)
const detailExpandedDirs = ref(new Set<string>())
const detailSource = ref<'project' | 'business-line'>('project')
const removingSkillId = ref('')
const downloadingSkillId = ref('')

type SkillGroup = {
  id: string
  label: string
  items: Skill[]
}

const normalizeRouteParam = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return ''
}

const resolveStoredProjectId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem(STORAGE_KEYS.lastSelectedProjectId) ?? ''
}

const activeProjectId = computed(() => {
  return normalizeRouteParam(route.query.projectId) || resolveStoredProjectId()
})

const readSourceProvider = (payload?: Record<string, unknown> | null) => {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const sourceProvider = payload.sourceProvider
  if (typeof sourceProvider !== 'string') {
    return ''
  }

  return sourceProvider.trim().toLowerCase()
}

const resolveSourcePath = (payload?: Record<string, unknown> | null) => {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const sourcePath = payload.sourcePath
  if (typeof sourcePath !== 'string') {
    return ''
  }

  return sourcePath.trim()
}

const resolveProviderKey = (item: Skill) => {
  const sourceProvider = readSourceProvider(item.metadataJson ?? null)
  if (sourceProvider) {
    return sourceProvider
  }

  const sourcePath = resolveSourcePath(item.metadataJson ?? null).replace(/\\/g, '/')
  if (sourcePath.includes('.codex/skills')) {
    return 'codex'
  }

  if (sourcePath.includes('.cursor/skills')) {
    return 'cursor'
  }

  if (sourcePath.includes('.curso/skills')) {
    return 'curso'
  }

  if (sourcePath.includes('.gemini/skills')) {
    return 'gemini'
  }

  if (sourcePath.includes('.opencode/skills')) {
    return 'opencode'
  }

  if (sourcePath.includes('.claude/skills')) {
    return 'claude'
  }

  return 'project'
}

const groupedSkills = computed<SkillGroup[]>(() => {
  const groups = new Map<string, SkillGroup>()

  for (const item of skills.value) {
    const sourceProvider = resolveProviderKey(item)
    const groupLabel = PROJECT_SKILL_PROVIDER_LABELS[sourceProvider] ?? sourceProvider
    const currentGroup = groups.get(sourceProvider)

    if (!currentGroup) {
      groups.set(sourceProvider, {
        id: sourceProvider,
        label: groupLabel,
        items: [item],
      })
      continue
    }

    currentGroup.items.push(item)
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
})

const filteredBusinessLineSkills = computed(() => {
  const query = copySkillKeyword.value.trim().toLowerCase()
  if (!query) {
    return businessLineSkills.value
  }

  return businessLineSkills.value.filter((item) => {
    return (
      item.name.toLowerCase().includes(query) ||
      item.version.toLowerCase().includes(query) ||
      (item.description ?? '').toLowerCase().includes(query)
    )
  })
})

const loadSkills = async () => {
  const projectId = activeProjectId.value

  if (!projectId) {
    skills.value = []
    return
  }

  loading.value = true

  try {
    const records = await fetchAllPages(
      (page, limit) => skillsApi.list({
        page,
        limit,
        keyword: keyword.value.trim() || undefined,
        projectId,
      }),
      {
        limit: PAGE_LIMIT,
        maxPages: MAX_PAGE_COUNT,
      },
    )

    skills.value = Array.from(new Map(records.map((item) => [item.id, item])).values())
  } catch (error) {
    message.error(toErrorMessage(error, '加载项目本地 Skill 列表失败'))
  } finally {
    loading.value = false
  }
}

const loadProjectContext = async (projectId: string) => {
  if (!projectId) {
    projectBusinessLineId.value = ''
    return
  }

  const requestToken = ++projectContextRequestToken.value

  try {
    const project = await projectsApi.detail(projectId)
    if (requestToken !== projectContextRequestToken.value) {
      return
    }

    projectBusinessLineId.value = project.businessLineId
  } catch (error) {
    if (requestToken !== projectContextRequestToken.value) {
      return
    }

    projectBusinessLineId.value = ''
    message.error(toErrorMessage(error, '加载项目信息失败'))
  }
}

const loadBusinessLineSkills = async () => {
  if (!projectBusinessLineId.value) {
    businessLineSkills.value = []
    return
  }

  loadingBusinessLineSkills.value = true
  copySkillErrorMessage.value = ''

  try {
    businessLineSkills.value = await businessLinesApi.listLocalSkills(
      projectBusinessLineId.value,
    )
  } catch (error) {
    businessLineSkills.value = []
    copySkillErrorMessage.value = toErrorMessage(error, '加载业务线技能失败')
  } finally {
    loadingBusinessLineSkills.value = false
  }
}

const closeAddMenu = () => {
  addMenuOpen.value = false
}

const toggleAddMenu = () => {
  addMenuOpen.value = !addMenuOpen.value
}

const setAddMenuAnchorEl = (el: Element | ComponentPublicInstance | null) => {
  if (el == null) {
    addMenuAnchorRef.value = null
    return
  }
  const node = el instanceof HTMLElement ? el : (el as ComponentPublicInstance).$el
  addMenuAnchorRef.value = node instanceof HTMLElement ? node : null
}

const onDocumentPointerDown = (event: PointerEvent) => {
  if (!addMenuOpen.value) {
    return
  }

  const eventTarget = event.target
  if (!(eventTarget instanceof Node)) {
    return
  }

  if (addMenuAnchorRef.value?.contains(eventTarget)) {
    return
  }

  closeAddMenu()
}

const openCopySkillModal = async () => {
  closeAddMenu()

  if (!activeProjectId.value) {
    message.error('请先选择项目')
    return
  }

  if (!projectBusinessLineId.value) {
    await loadProjectContext(activeProjectId.value)
  }

  if (!projectBusinessLineId.value) {
    message.error('无法识别项目所属业务线')
    return
  }

  copySkillKeyword.value = ''
  copySkillErrorMessage.value = ''
  copySkillTargetProviders.value = ['cursor']
  copySkillModalOpen.value = true
  await loadBusinessLineSkills()
}

const closeCopySkillModal = () => {
  copyingBusinessLineSkillId.value = ''
  copySkillErrorMessage.value = ''
  copySkillModalOpen.value = false
}

const selectAllCopySkillProviders = () => {
  copySkillTargetProviders.value = [...PROJECT_SKILL_PROVIDER_ORDER]
}

const clearAllCopySkillProviders = () => {
  copySkillTargetProviders.value = ['cursor']
}

const submitCopyBusinessLineSkill = async (skillId: string) => {
  const projectId = activeProjectId.value
  const providers = copySkillTargetProviders.value
  if (!projectId) {
    return
  }

  if (providers.length === 0) {
    message.error('请至少选择一个目标类型')
    return
  }

  copyingBusinessLineSkillId.value = skillId
  copySkillErrorMessage.value = ''

  try {
    const errors: string[] = []
    let lastResult: { name: string } | null = null

    for (const provider of providers) {
      try {
        const result = await skillsApi.copyFromBusinessLine({
          projectId,
          businessLineSkillId: skillId,
          provider,
        })
        lastResult = result
      } catch (err) {
        errors.push(
          `${PROJECT_SKILL_PROVIDER_LABELS[provider] ?? provider}: ${toErrorMessage(err, '复制失败')}`,
        )
      }
    }

    if (errors.length > 0) {
      copySkillErrorMessage.value = errors.join('；')
      message.error(copySkillErrorMessage.value)
      if (errors.length < providers.length && lastResult) {
        await loadSkills()
      }
    } else {
      closeCopySkillModal()
      await loadSkills()
      message.success(
        lastResult
          ? providers.length === 1
            ? `Skill「${lastResult.name}」复制成功`
            : `Skill「${lastResult.name}」已复制到 ${providers.length} 个类型`
          : '复制成功',
      )
    }
  } catch (error) {
    copySkillErrorMessage.value = toErrorMessage(error, '复制业务线技能失败')
    message.error(copySkillErrorMessage.value)
  } finally {
    copyingBusinessLineSkillId.value = ''
  }
}

const openUploadSkillModal = () => {
  closeAddMenu()

  if (!activeProjectId.value) {
    message.error('请先选择项目')
    return
  }

  uploadSkillErrorMessage.value = ''
  uploadSkillModalOpen.value = true
}

const submitUploadProjectSkill = async (
  file: File,
  providers: ProjectSkillProvider[],
) => {
  const projectId = activeProjectId.value
  if (!projectId) {
    return
  }

  if (providers.length === 0) {
    message.error('请至少选择一个目标类型')
    return
  }

  uploadingProjectSkill.value = true
  uploadSkillErrorMessage.value = ''

  try {
    const errors: string[] = []
    let lastResult: { name: string } | null = null

    for (const provider of providers) {
      try {
        const result = await skillsApi.uploadToProject(file, {
          projectId,
          provider,
        })
        lastResult = result
      } catch (err) {
        errors.push(
          `${PROJECT_SKILL_PROVIDER_LABELS[provider] ?? provider}: ${toErrorMessage(err, '上传失败')}`,
        )
      }
    }

    if (errors.length > 0) {
      uploadSkillErrorMessage.value = errors.join('；')
      message.error(uploadSkillErrorMessage.value)
      if (errors.length < providers.length && lastResult) {
        uploadSkillModalOpen.value = false
        await loadSkills()
      }
    } else {
      uploadSkillModalOpen.value = false
      await loadSkills()
      message.success(
        lastResult
          ? providers.length === 1
            ? `Skill「${lastResult.name}」添加成功`
            : `Skill「${lastResult.name}」已添加到 ${providers.length} 个类型`
          : '上传成功',
      )
    }
  } catch (error) {
    uploadSkillErrorMessage.value = toErrorMessage(error, '上传技能到项目失败')
    message.error(uploadSkillErrorMessage.value)
  } finally {
    uploadingProjectSkill.value = false
  }
}

const downloadProjectSkill = async (item: Skill) => {
  const projectId = activeProjectId.value
  if (!projectId || downloadingSkillId.value) {
    return
  }

  downloadingSkillId.value = item.id

  try {
    const token = localStorage.getItem(STORAGE_KEYS.authToken)
    const url = `/api/v1/skills/${encodeURIComponent(item.id)}/download?projectId=${encodeURIComponent(projectId)}`
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
    downloadingSkillId.value = ''
  }
}

const removeProjectSkill = async (item: Skill) => {
  const projectId = activeProjectId.value
  if (!projectId || removingSkillId.value) {
    return
  }

  if (!window.confirm(`确认删除技能「${item.name}」吗？此操作不可撤销。`)) {
    return
  }

  removingSkillId.value = item.id

  try {
    await skillsApi.removeFromProject(item.id, { projectId })
    if (detailSkill.value?.id === item.id) {
      closeSkillDetail()
    }
    await loadSkills()
    message.success(`技能「${item.name}」已删除`)
  } catch (error) {
    message.error(toErrorMessage(error, '删除技能失败'))
  } finally {
    removingSkillId.value = ''
  }
}

const toggleDetailDir = (dirPath: string) => {
  const expanded = detailExpandedDirs.value
  if (expanded.has(dirPath)) {
    expanded.delete(dirPath)
  } else {
    expanded.add(dirPath)
  }
}

const loadDetailFile = async (filePath: string) => {
  const skill = detailSkill.value
  if (!skill) return

  detailSelectedPath.value = filePath
  detailFileLoading.value = true
  detailContent.value = ''
  const requestToken = detailRequestToken.value

  try {
    let response: { path: string; content: string }
    if (detailSource.value === 'business-line') {
      response = await businessLinesApi.localSkillFile(
        projectBusinessLineId.value,
        skill.id,
        filePath,
      )
    } else {
      response = await skillsApi.file(skill.id, {
        projectId: activeProjectId.value,
        path: filePath,
      })
    }
    if (requestToken !== detailRequestToken.value) return
    detailContent.value = response.content
  } catch (error) {
    if (requestToken !== detailRequestToken.value) return
    detailContent.value = ''
    detailErrorMessage.value = toErrorMessage(error, '加载文件失败')
  } finally {
    if (requestToken === detailRequestToken.value) {
      detailFileLoading.value = false
    }
  }
}

const findSkillMdPath = (nodes: SkillTreeNode[]): string | null => {
  for (const node of nodes) {
    if (!node.isDir && node.name.toLowerCase() === 'skill.md') {
      return node.path
    }
  }
  return null
}

const closeSkillDetail = () => {
  detailRequestToken.value += 1
  detailSkill.value = null
  detailTree.value = []
  detailContent.value = ''
  detailSelectedPath.value = ''
  detailErrorMessage.value = ''
  detailLoading.value = false
  detailFileLoading.value = false
  detailExpandedDirs.value = new Set()
  detailSource.value = 'project'
}

const openSkillDetail = async (item: Skill) => {
  const projectId = activeProjectId.value
  if (!projectId) {
    return
  }

  detailSkill.value = item
  detailTree.value = []
  detailContent.value = ''
  detailSelectedPath.value = ''
  detailErrorMessage.value = ''
  detailLoading.value = true
  detailSource.value = 'project'
  detailExpandedDirs.value = new Set()
  const requestToken = ++detailRequestToken.value

  try {
    const response = await skillsApi.tree(item.id, { projectId })
    if (requestToken !== detailRequestToken.value) return

    detailTree.value = response.tree
    const defaultFile = findSkillMdPath(response.tree)
    if (defaultFile) {
      await loadDetailFile(defaultFile)
    }
  } catch (error) {
    if (requestToken !== detailRequestToken.value) return
    detailErrorMessage.value = toErrorMessage(error, '加载技能目录失败')
  } finally {
    if (requestToken === detailRequestToken.value) {
      detailLoading.value = false
    }
  }
}

const openBusinessLineSkillDetail = async (item: Skill) => {
  const businessLineId = projectBusinessLineId.value
  if (!businessLineId) {
    message.error('无法识别项目所属业务线')
    return
  }

  detailSkill.value = item
  detailTree.value = []
  detailContent.value = ''
  detailSelectedPath.value = ''
  detailErrorMessage.value = ''
  detailLoading.value = true
  detailSource.value = 'business-line'
  detailExpandedDirs.value = new Set()
  const requestToken = ++detailRequestToken.value

  try {
    const response = await businessLinesApi.localSkillTree(businessLineId, item.id)
    if (requestToken !== detailRequestToken.value) return

    detailTree.value = response.tree
    const defaultFile = findSkillMdPath(response.tree)
    if (defaultFile) {
      await loadDetailFile(defaultFile)
    }
  } catch (error) {
    if (requestToken !== detailRequestToken.value) return
    detailErrorMessage.value = toErrorMessage(error, '加载技能目录失败')
  } finally {
    if (requestToken === detailRequestToken.value) {
      detailLoading.value = false
    }
  }
}

watch(
  () => activeProjectId.value,
  async (projectId) => {
    closeAddMenu()
    closeCopySkillModal()
    uploadSkillModalOpen.value = false
    closeSkillDetail()

    if (!projectId) {
      projectBusinessLineId.value = ''
      businessLineSkills.value = []
      skills.value = []
      return
    }

    await Promise.all([
      loadProjectContext(projectId),
      loadSkills(),
    ])
  },
  { immediate: true },
)

watch(
  () => addMenuOpen.value,
  (open) => {
    if (typeof document === 'undefined') {
      return
    }

    if (open) {
      document.addEventListener('pointerdown', onDocumentPointerDown)
      return
    }

    document.removeEventListener('pointerdown', onDocumentPointerDown)
  },
)

onBeforeUnmount(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
  return reactive({
    PROJECT_SKILL_PROVIDER_LABELS,
    PROJECT_SKILL_PROVIDER_ORDER,
    selectAllCopySkillProviders,
    submitCopyBusinessLineSkill,
    openBusinessLineSkillDetail,
    copyingBusinessLineSkillId,
    projectContextRequestToken,
    filteredBusinessLineSkills,
    clearAllCopySkillProviders,
    loadingBusinessLineSkills,
    copySkillTargetProviders,
    submitUploadProjectSkill,
    uploadSkillErrorMessage,
    resolveStoredProjectId,
    loadBusinessLineSkills,
    projectBusinessLineId,
    copySkillErrorMessage,
    uploadingProjectSkill,
    onDocumentPointerDown,
    uploadSkillModalOpen,
    openUploadSkillModal,
    downloadProjectSkill,
    normalizeRouteParam,
    closeCopySkillModal,
    copySkillModalOpen,
    businessLineSkills,
    detailSelectedPath,
    detailErrorMessage,
    detailRequestToken,
    detailExpandedDirs,
    downloadingSkillId,
    readSourceProvider,
    resolveProviderKey,
    loadProjectContext,
    openCopySkillModal,
    removeProjectSkill,
    detailFileLoading,
    resolveSourcePath,
    addMenuAnchorRef,
    setAddMenuAnchorEl,
    copySkillKeyword,
    closeSkillDetail,
    removingSkillId,
    activeProjectId,
    toggleDetailDir,
    findSkillMdPath,
    openSkillDetail,
    loadDetailFile,
    detailContent,
    detailLoading,
    groupedSkills,
    toggleAddMenu,
    detailSource,
    closeAddMenu,
    addMenuOpen,
    detailSkill,
    detailTree,
    loadSkills,
    message,
    loading,
    keyword,
    skills,
    route,
  })
}
