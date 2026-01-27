import dayjs from 'dayjs'
import { CourseAppointmentItem } from './service.type'

/**
 * 生成未来30天的日期数组，每周一到周五
 * @returns 日期数组，格式：YYYY-MM-DD
 */
function generateAvailableDates(): string[] {
    const dates: string[] = []
    const today = dayjs()

    // 生成未来30天的日期
    for (let i = 0; i < 30; i++) {
        const date = today.add(i, 'day')
        const dayOfWeek = date.day() // 0是周日，6是周六

        // 只包含周一到周五的日期
        if (dayOfWeek > 0 && dayOfWeek < 6) {
            dates.push(date.format('YYYY-MM-DD'))
        }
    }

    return dates
}

/**
 * 生成指定日期的可用时段
 * @param date 日期
 * @returns 时段数组
 */
function generatePeriodsForDate(date: string): string[] {
    // 根据日期生成不同的时段，模拟不同日期有不同的可用时段
    const dateObj = dayjs(date)
    const dayOfWeek = dateObj.day() // 0是周日，6是周六

    // 基础时段
    const basePeriods = [
        '09:00-10:00',
        '10:30-11:30',
        '13:00-14:00',
        '14:30-15:30',
        '16:00-17:00'
    ]

    // 根据星期几返回不同的时段组合
    switch (dayOfWeek) {
        case 1: // 周一
            return basePeriods.slice(0, 3) // 上午和午后第一个时段
        case 2: // 周二
            return basePeriods.slice(1, 4) // 上午最后一个和午后两个时段
        case 3: // 周三
            return basePeriods // 全天时段
        case 4: // 周四
            return basePeriods.slice(2) // 只有午后时段
        case 5: // 周五
            return basePeriods.slice(0, 2).concat(basePeriods.slice(3)) // 上午和下午最后时段
        default:
            return [] // 周末无时段
    }
}

/**
 * Mock数据：可用日期列表
 */
export const mockAvailableDates = {
    dates: generateAvailableDates()
}

/**
 * Mock数据：指定日期的可用时段
 * @param date 日期
 */
export function mockAvailablePeriods(date: string) {
    return {
        periods: generatePeriodsForDate(date)
    }
}

/**
 * Mock数据：所有时段列表
 */
export const mockAllPeriods = {
    periods: [
        '09:00-10:00',
        '10:30-11:30',
        '13:00-14:00',
        '14:30-15:30',
        '16:00-17:00'
    ]
}

/**
 * Mock数据：创建预约响应
 */
export const mockCreateAppointment = {
    id: `AP${Date.now().toString().slice(-8)}`
}

/**
 * Mock数据：更新预约状态响应
 */
export const mockUpdateStatus = {
    success: true
}

/**
 * 生成随机预约列表
 * @param count 数量
 * @returns 预约列表
 */
function generateAppointments(count: number = 10): CourseAppointmentItem[] {
    const appointments: CourseAppointmentItem[] = []
    const dates = generateAvailableDates()
    const statuses = ['booked', 'cancelled', 'completed']
    const genders = ['男', '女']
    const firstNames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴']
    const lastNames = ['小', '大', '明', '华', '强', '伟', '芳', '娜', '军', '杰']

    for (let i = 0; i < count; i++) {
        const dateIndex = Math.floor(Math.random() * dates.length)
        const date = dates[dateIndex]
        const periods = generatePeriodsForDate(date)
        const periodIndex = Math.floor(Math.random() * periods.length)
        const period = periods[periodIndex]

        const gender = genders[Math.floor(Math.random() * genders.length)]
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
        const childName = firstName + lastName
        const parentName = firstName + '父/母'

        const age = Math.floor(Math.random() * 10) + 5 // 5-15岁
        const statusIndex = Math.floor(Math.random() * statuses.length)
        const status = statuses[statusIndex]

        const createdAt = dayjs().subtract(Math.floor(Math.random() * 30), 'day').format('YYYY-MM-DD HH:mm:ss')
        const updatedAt = dayjs(createdAt).add(Math.floor(Math.random() * 5), 'day').format('YYYY-MM-DD HH:mm:ss')

        appointments.push({
            id: `AP${100000 + i}`,
            orderNo: `OR${200000 + i}`,
            courseName: Math.random() > 0.5 ? '天坛游' : '故宫游',
            period,
            date,
            childName,
            idNumber: `11010${Math.floor(Math.random() * 9000000) + 1000000}`,
            gender,
            age,
            parentName,
            parentPhone: `1391234${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            parentAccompany: Math.random() > 0.3,
            verificationCode: `VC${300000 + i}`,
            createdAt,
            updatedAt,
            updatedByName: '系统管理员',
            status
        })
    }

    return appointments
}

/**
 * Mock数据：课程预约列表查询响应
 */
export function mockAppointmentList(params: any) {
    // 生成30条数据作为总数据池
    const allAppointments = generateAppointments(30)

    // 根据查询参数进行过滤
    let filteredAppointments = [...allAppointments]

    // 课程ID过滤
    if (params.courseId) {
        filteredAppointments = filteredAppointments.filter(item =>
            item.courseName.includes(params.courseId === '1' ? '天坛' : '故宫')
        )
    }

    // 日期范围过滤
    if (params.startDate && params.endDate) {
        filteredAppointments = filteredAppointments.filter(item =>
            item.date >= params.startDate && item.date <= params.endDate
        )
    }

    // 孩子姓名过滤
    if (params.childName) {
        filteredAppointments = filteredAppointments.filter(item =>
            item.childName.includes(params.childName)
        )
    }

    // 家长姓名过滤
    if (params.parentName) {
        filteredAppointments = filteredAppointments.filter(item =>
            item.parentName.includes(params.parentName)
        )
    }

    // 家长手机号过滤
    if (params.parentPhone) {
        filteredAppointments = filteredAppointments.filter(item =>
            item.parentPhone.includes(params.parentPhone)
        )
    }

    // 时间段过滤
    if (params.period) {
        filteredAppointments = filteredAppointments.filter(item =>
            item.period === params.period
        )
    }

    // 状态过滤
    if (params.status) {
        filteredAppointments = filteredAppointments.filter(item =>
            item.status === params.status
        )
    }

    // 分页处理
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const pagedAppointments = filteredAppointments.slice(start, end)

    return {
        total: filteredAppointments.length,
        list: pagedAppointments
    }
} 