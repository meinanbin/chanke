/**
 * 通用工具函数（服务端版本）
 */

/**
 * 生成唯一记录ID
 * 格式: 类型前缀 + 年月日时分秒 + 4位随机数
 */
function generateId(prefix) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${prefix}${dateStr}${rand}`
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return ''
  if (typeof date === 'string') date = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss
 */
function formatDateTime(date) {
  if (!date) return ''
  if (typeof date === 'string') date = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 获取当前日期字符串 YYYY-MM-DD
 */
function today() {
  return formatDate(new Date())
}

/**
 * 解析 YYYY-MM-DD 字符串为本地时区午夜时刻的 Date 对象
 */
function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const parts = dateStr.split('-')
  if (parts.length !== 3) return new Date(dateStr)
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  return isNaN(d.getTime()) ? new Date(dateStr) : d
}

/**
 * 计算两个日期之间的天数差（date2 - date1）
 */
function daysBetween(date1, date2) {
  const d1 = typeof date1 === 'string' ? parseLocalDate(date1) : date1
  const d2 = typeof date2 === 'string' ? parseLocalDate(date2) : date2
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
  const diff = d2.getTime() - d1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * 日期减N天，返回 YYYY-MM-DD 字符串
 */
function subDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - days)
  return formatDate(d)
}

/**
 * 安全解析 JSON 字符串，失败返回默认值
 */
function safeParseJSON(str, defaultVal) {
  try {
    return JSON.parse(str || '[]')
  } catch (e) {
    return defaultVal || []
  }
}

module.exports = {
  generateId,
  formatDate,
  formatDateTime,
  today,
  daysBetween,
  subDays,
  parseLocalDate,
  safeParseJSON
}
