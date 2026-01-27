import dayjs from 'dayjs'

export const formatTime = (
  time: string | number | Date | null | undefined,
  format = 'YYYY-MM-DD HH:mm:ss',
) => {
  if (!time) return '-'
  return dayjs(time).format(format)
}

export function formatDateTime(
  date: string | number | Date | undefined,
): string {
  if (!date) return '-'

  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}
