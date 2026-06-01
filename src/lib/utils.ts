/** 解析时间戳（支持 Unix 秒、Unix 毫秒、ISO 字符串），返回 Date */
export function parseDate(s: string | number | undefined | null): Date | null {
  if (!s) return null
  const n = Number(s)
  if (!isNaN(n) && n > 1e9) {
    return new Date(n > 1e12 ? n : n * 1000)
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** 格式化为中文短日期 (YYYY/M/D) */
export function formatDate(s: string | number | undefined | null): string {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('zh-CN') : '-'
}

/** 格式化为 YYYY-MM-DD */
export function formatDateISO(s: string | number | undefined | null): string {
  const d = parseDate(s)
  return d ? d.toISOString().slice(0, 10) : ''
}

/** 提取小时 (0-23) */
export function getHour(s: string | number | undefined | null): number | null {
  const d = parseDate(s)
  return d ? d.getHours() : null
}
