/**
 * 日期时间工具函数
 * 提供统一的时间格式化功能，特别是中国时区转换
 */

/**
 * 将日期时间转换为中国时区（Asia/Shanghai）的格式化字符串
 * @param dateStr 日期字符串（ISO格式）或 Date 对象
 * @returns 格式化后的时间字符串，格式：YYYY-MM-DD HH:mm:ss
 */
export function formatToChinaTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) {
    return '-';
  }

  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '-';
    }

    // 使用 Intl.DateTimeFormat 转换为中国时区
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const second = parts.find(p => p.type === 'second')?.value || '';

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
}

/**
 * 格式化日期时间（使用本地时区）
 * @param dateStr 日期字符串或 Date 对象
 * @returns 格式化后的时间字符串
 */
export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) {
    return '-';
  }

  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    
    if (isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
}
