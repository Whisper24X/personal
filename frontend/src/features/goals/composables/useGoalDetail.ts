import {
  GOAL_SELECT_PANEL_PLACEMENT,
  GOAL_SELECT_PANEL_Z_INDEX,
  useGoalDetailData,
} from './useGoalDetailData'
import { useGoalDetailPlanItems } from './useGoalDetailPlanItems'
import { useGoalDetailPrd } from './useGoalDetailPrd'

export function useGoalDetail() {
  const data = useGoalDetailData()
  const prd = useGoalDetailPrd({
    detail: data.detail,
    tab: data.tab,
  })
  const planItems = useGoalDetailPlanItems({
    detail: data.detail,
    goalId: data.goalId,
    goTask: data.goTask,
    load: data.load,
    workflowTemplates: data.workflowTemplates,
  })

  return {
    GOAL_SELECT_PANEL_PLACEMENT,
    GOAL_SELECT_PANEL_Z_INDEX,
    ...data,
    ...planItems,
    ...prd,
  }
}
