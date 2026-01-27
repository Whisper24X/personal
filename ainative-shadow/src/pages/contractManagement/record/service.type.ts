/**
 * 合同记录查询参数
 */
export interface ContractQueryParams {
  /** 学生姓名 */
  childName?: string
  /** 家长手机号 */
  parentPhone?: string
  /** 研学主题 */
  topic?: string
  /** 合同状态 */
  status?: number
  /** 活动开始日期 */
  activityStartDate?: string
  /** 合同类型: 1：单日营；2：多日营 */
  contractType?: number
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

/**
 * 合同记录项
 */
export interface ContractRecordItem {
  /** 合同ID */
  id: string
  /** 课程预约ID */
  courseAppointmentId: string
  /** 签署流程ID */
  signFlowId: string
  /** 家长姓名 */
  parentName: string
  /** 家长手机号 */
  parentPhone: string
  /** 学生姓名 */
  childName: string
  /** 学生手机号 */
  childPhone: string
  /** 学生ID */
  childId: string
  /** 用户来源 */
  userSource: string
  /** 研学主题 */
  topic: string
  /** 活动开始日期 */
  activityStartDate: string
  /** 活动结束日期 */
  activityEndDate: string
  /** 购买渠道 */
  purchaseChannel: string
  /** 学生年级 */
  childGrade: string
  /** 学生性别 */
  childGender: string
  /** 费用 */
  cost: string
  /** 费用大写 */
  costCapital: string
  /** 缴费截止日期 */
  payEndDate: string
  /** 合同状态 0-未签署，1-已签署，2-已作废 */
  contractStatus: number
  /** 合同链接 */
  contractLink: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 合同记录查询返回数据
 */
export interface ContractRecordListResponse {
  /** 记录列表 */
  list: ContractRecordItem[]
  /** 总数 */
  total: number
}

/**
 * 合同状态枚举
 */
export enum ContractStatus {
  /** 草稿 */
  DRAFT = 0,
  /** 签署中 */
  SIGNING = 1,
  /** 完成 */
  COMPLETED = 2,
  /** 撤销 */
  REVOKED = 3,
  /** 过期 */
  EXPIRED = 5,
  /** 拒签 */
  REJECTED = 7,
}

/**
 * 合同状态选项
 */
export const CONTRACT_STATUS_OPTIONS = [
  { label: '全部', value: -1 },
  { label: '签署中', value: ContractStatus.SIGNING },
  { label: '完成', value: ContractStatus.COMPLETED },
  { label: '撤销', value: ContractStatus.REVOKED },
  { label: '过期', value: ContractStatus.EXPIRED },
  { label: '拒签', value: ContractStatus.REJECTED },
]

/**
 * 营期类别
 */
export enum CampPeriod {
  SINGLE = 1,
  MULTIPLE = 2,
}

/**
 * 营期类别选项
 */
export const CAMP_PERIOD_OPTIONS = [
  { label: '单日营', value: CampPeriod.SINGLE },
  { label: '多日营', value: CampPeriod.MULTIPLE },
]
