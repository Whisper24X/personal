import dayjs from 'dayjs'
import { getCourseStockSelector } from './service'

/**
 * 从课程库存数据中提取可用日期
 * @param items 课程库存项列表
 * @param filterToday 是否过滤今天之前的日期
 * @returns 可用日期列表
 */
export function extractAvailableDates(items: any[], filterToday = true): string[] {
    if (!items || items.length === 0) {
        return []
    }

    let dates = [...new Set(items.map(item => item.date))]

    // 如果需要过滤今天之前的日期
    if (filterToday) {
        const today = dayjs().format('YYYY-MM-DD')
        dates = dates.filter(date => date >= today)
    }

    return dates
}

/**
 * 从课程库存数据中提取指定日期的可用时间段
 * @param items 课程库存项列表
 * @param date 日期
 * @returns 可用时间段列表
 */
export function extractPeriodsForDate(items: any[], date: string): string[] {
    if (!items || items.length === 0 || !date) {
        return []
    }

    const periodsForDate = items
        .filter(item => item.date === date)
        .map(item => item.period)

    return [...new Set(periodsForDate)]
}

/**
 * 从课程库存数据中提取所有不重复的时间段
 * @param items 课程库存项列表
 * @returns 所有不重复的时间段列表
 */
export function extractAllPeriods(items: any[]): string[] {
    if (!items || items.length === 0) {
        return []
    }

    return [...new Set(items.map(item => item.period))]
}

/**
 * 禁用日期函数工厂
 * @param availableDates 可用日期列表
 * @param courseId 课程ID
 * @returns 禁用日期函数
 */
export function createDisabledDateFunction(availableDates: string[], courseId: string) {
    return (time: Date) => {
        // 获取今天的日期
        const today = dayjs().format('YYYY-MM-DD')

        // 将时间格式化为YYYY-MM-DD格式
        const dateString = dayjs(time).format('YYYY-MM-DD')

        // 如果日期在今天之前，则禁用
        if (dateString < today) {
            return true
        }

        // 如果没有选择课程，则只允许选择今天及以后的日期
        if (!courseId) {
            return false
        }

        // 如果可用日期列表为空，则禁用所有日期
        if (availableDates.length === 0) {
            return true
        }

        // 如果日期不在可用日期列表中，则禁用
        return !availableDates.includes(dateString)
    }
}

/**
 * 加载课程库存信息
 * @param courseId 课程ID
 * @returns 课程库存信息
 */
export async function loadCourseStockInfo(courseId: string) {
    if (!courseId) {
        return {
            availableDates: [],
            allPeriods: []
        }
    }

    try {
        const res = await getCourseStockSelector(courseId)
        if (res && res.items && res.items.length > 0) {
            // 提取可用日期（只包括今天及以后的日期）
            const availableDates = extractAvailableDates(res.items, true)

            // 提取所有不重复的时间段
            const allPeriods = extractAllPeriods(res.items)

            return {
                availableDates,
                allPeriods,
                items: res.items
            }
        }
    } catch (error) {
        console.error('获取课程库存信息失败:', error)
    }

    return {
        availableDates: [],
        allPeriods: []
    }
}

/**
 * 格式化日期
 * @param dateString 日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatDate(dateString: string): string {
    if (!dateString) return '--'
    return dayjs(dateString).format('YYYY-MM-DD')
}

/**
 * 格式化日期时间
 * @param dateTimeString 日期时间字符串
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(dateTimeString: string): string {
    if (!dateTimeString) return '--'
    return dayjs(dateTimeString).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 获取课程可用日期
 * @param courseId 课程ID
 * @returns 可用日期列表
 */
export async function getAvailableDatesForCourse(courseId: string): Promise<string[]> {
    if (!courseId) {
        return [];
    }

    try {
        const res = await getCourseStockSelector(courseId);
        if (res && res.items && res.items.length > 0) {
            // 提取可用日期（只包括今天及以后的日期）
            return extractAvailableDates(res.items, true);
        }
        return [];
    } catch (error) {
        console.error('获取课程可用日期失败:', error);
        return [];
    }
} 