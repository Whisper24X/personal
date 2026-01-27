/**
 * 课程预约表单数据接口
 */
export interface AppointmentForm {
    id: string
    courseId: string
    courseDate: string
    coursePeriod: string
    childName: string
    idNumber: string
    gender: string
    age: number
    parentName: string
    parentPhone: string
    parentAccompany: boolean | null
    verificationImage: string
    isCreate: boolean
    isEditMode: boolean // 是否为编辑模式
    courseName: string // 课程名称
}

/**
 * 课程库存项接口
 */
export interface CourseStockItem {
    /** 日期 */
    date: string
    /** 时间段 */
    period: string
    /** 总库存 */
    stock: number
    /** 剩余库存 */
    stockRemain: number
}

/**
 * 课程库存信息接口
 */
export interface CourseStockInfo {
    availableDates: string[]
    allPeriods: string[]
    items?: CourseStockItem[]
}

/**
 * 课程选项接口
 */
export interface CourseOption {
    label: string
    value: string
}

/**
 * 查询参数接口
 */
export interface SearchParams {
    courseId: string
    courseDateRange: [string, string] | null
    status: string | undefined
    childName: string
    parentName: string
    parentPhone: string
    period: string
}

/**
 * 查询表单接口
 */
export interface SearchForm {
    page: number
    pageSize: number
    params: SearchParams
}

/**
 * 日期快捷选项
 */
export const DATE_SHORTCUTS = [
    {
        text: '最近一周',
        value: () => {
            const end = new Date()
            const start = new Date()
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
            return [start, end]
        },
    },
    {
        text: '最近一个月',
        value: () => {
            const end = new Date()
            const start = new Date()
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
            return [start, end]
        },
    },
    {
        text: '最近三个月',
        value: () => {
            const end = new Date()
            const start = new Date()
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 90)
            return [start, end]
        },
    },
] 