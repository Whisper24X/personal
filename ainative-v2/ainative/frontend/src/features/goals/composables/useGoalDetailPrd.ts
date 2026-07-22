import { ref, watch, type Ref } from 'vue'
import { goalsApi } from '@/api/goals'
import { useMessage } from '@app/composables/useMessage'
import type { GoalDetail as GoalDetailType } from '@/types/api/goals'
import type { GoalDetailTab } from './useGoalDetailData'
import { toErrorMessage } from '@api/shared/to-error-message'

type UseGoalDetailPrdOptions = {
  detail: Ref<GoalDetailType | null>
  tab: Ref<GoalDetailTab>
}

export function useGoalDetailPrd(options: UseGoalDetailPrdOptions) {
  const message = useMessage()

  const prdEditorOpen = ref(false)
  const prdEditorContent = ref('')
  const prdEditorLoading = ref(false)
  const prdEditorSaving = ref(false)

  const prdPreviewLoading = ref(false)
  const prdPreviewError = ref('')
  const prdPreviewContent = ref('')
  let prdPreviewRequestToken = 0

  async function loadPrdPreview() {
    const detail = options.detail.value
    if (!detail || options.tab.value !== 'prd') {
      return
    }
    const path = detail.goal.prdDocPath?.trim()
    const goalId = detail.goal.id
    if (!path || !goalId) {
      prdPreviewContent.value = ''
      prdPreviewError.value = ''
      prdPreviewLoading.value = false
      return
    }
    prdPreviewRequestToken += 1
    const token = prdPreviewRequestToken
    prdPreviewLoading.value = true
    prdPreviewError.value = ''
    try {
      const result = await goalsApi.readPrdDoc(goalId)
      if (token !== prdPreviewRequestToken) {
        return
      }
      prdPreviewContent.value = result.content
    } catch (e) {
      if (token !== prdPreviewRequestToken) {
        return
      }
      prdPreviewContent.value = ''
      prdPreviewError.value = toErrorMessage(e, '读取 PRD 失败')
    } finally {
      if (token === prdPreviewRequestToken) {
        prdPreviewLoading.value = false
      }
    }
  }

  function onPrdEditorOpen(open: boolean) {
    prdEditorOpen.value = open
  }

  async function openPrdEditor() {
    const detail = options.detail.value
    const path = detail?.goal.prdDocPath?.trim()
    const goalId = detail?.goal.id
    if (!detail || !path || !goalId) {
      return
    }
    prdEditorOpen.value = true
    prdEditorLoading.value = true
    try {
      const result = await goalsApi.readPrdDoc(goalId)
      prdEditorContent.value = result.content
    } catch (e) {
      message.error(toErrorMessage(e, '读取 PRD 失败'))
      prdEditorOpen.value = false
    } finally {
      prdEditorLoading.value = false
    }
  }

  async function savePrdEditor() {
    const detail = options.detail.value
    const path = detail?.goal.prdDocPath?.trim()
    const goalId = detail?.goal.id
    if (!detail || !path || !goalId) {
      return
    }
    prdEditorSaving.value = true
    try {
      await goalsApi.updatePrdDoc(goalId, {
        content: prdEditorContent.value,
      })
      message.success('PRD 已保存')
      prdEditorOpen.value = false
      await loadPrdPreview()
    } catch (e) {
      message.error(toErrorMessage(e, '保存 PRD 失败'))
    } finally {
      prdEditorSaving.value = false
    }
  }

  watch(
    () =>
      [
        options.tab.value,
        options.detail.value?.goal.id,
        options.detail.value?.goal.prdDocPath?.trim() ?? '',
        options.detail.value?.goal.projectId ?? '',
        options.detail.value?.goal.gitBranch,
      ] as const,
    () => {
      if (options.tab.value === 'prd' && options.detail.value?.goal.prdDocPath?.trim()) {
        void loadPrdPreview()
      }
    },
  )

  return {
    onPrdEditorOpen,
    openPrdEditor,
    prdEditorContent,
    prdEditorLoading,
    prdEditorOpen,
    prdEditorSaving,
    prdPreviewContent,
    prdPreviewError,
    prdPreviewLoading,
    savePrdEditor,
  }
}
