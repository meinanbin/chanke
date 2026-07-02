/**
 * 通用工具函数
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
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 获取当前日期字符串 YYYY-MM-DD
 */
function today() {
  return formatDate(new Date())
}

/**
 * 解析 YYYY-MM-DD 字符串为本地时区午夜时刻的 Date 对象
 * 避免 new Date('YYYY-MM-DD') 在某些 JS 引擎下解析为 UTC 导致天数差偏差
 */
function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const parts = dateStr.split('-')
  if (parts.length !== 3) return new Date(dateStr)
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  return isNaN(d.getTime()) ? new Date(dateStr) : d
}

/**
 * 计算两个日期之间的天数差（date2 - date1）
 */
function daysBetween(date1, date2) {
  var d1 = typeof date1 === 'string' ? parseLocalDate(date1) : date1
  var d2 = typeof date2 === 'string' ? parseLocalDate(date2) : date2
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
  var diff = d2.getTime() - d1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * 日期加N天，返回 YYYY-MM-DD 字符串
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDate(d)
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
 * 深拷贝
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 防抖
 */
function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

/**
 * 获取状态栏高度（rpx）
 */
function getStatusBarHeight() {
  try {
    const info = wx.getWindowInfo()
    return info.statusBarHeight || 20
  } catch (e) {
    return 20
  }
}

/**
 * 获取导航栏高度（rpx）
 */
function getNavBarHeight() {
  try {
    const info = wx.getWindowInfo()
    const statusBarHeight = info.statusBarHeight || 20
    // 胶囊按钮高度约32px + 上下间距各8px = 44px 胶囊区高度
    const menuButtonHeight = 44
    return statusBarHeight + menuButtonHeight
  } catch (e) {
    return 64
  }
}

module.exports = {
  generateId,
  formatDate,
  formatDateTime,
  today,
  daysBetween,
  addDays,
  subDays,
  deepClone,
  debounce,
  getStatusBarHeight,
  getNavBarHeight
}
