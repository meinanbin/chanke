/**
 * 审计日志模块
 *
 * 记录所有数据修改操作，前端不可删除。
 * 至少包括：记录ID、操作人、操作时间、修改原因、被修改的字段、修改前的值、修改后的值、操作IP
 */

const util = require('./util.js')

const STORAGE_KEY = 'auditLogs'

/**
 * 获取当前用户信息
 */
function getCurrentUser() {
  const app = getApp()
  return app && app.globalData ? app.globalData.currentUser : { name: '未知', ip: '0.0.0.0' }
}

/**
 * 获取所有审计日志
 */
function getAllLogs() {
  return wx.getStorageSync(STORAGE_KEY) || []
}

/**
 * 记录创建操作
 */
function logCreate(recordId, recordType, record) {
  const user = getCurrentUser()
  const logs = getAllLogs()
  logs.push({
    id: util.generateId('L'),
    recordId,
    recordType,
    operation: '创建',
    operator: user.name || '未知',
    operatorId: user.id || '',
    operationTime: util.formatDateTime(new Date()),
    reason: '',
    fieldChanges: [],
    operationIP: user.ip || '0.0.0.0'
  })
  wx.setStorageSync(STORAGE_KEY, logs)
}

/**
 * 记录更新操作
 * 对比新旧记录，记录变化的字段
 */
function logUpdate(recordId, recordType, oldRecord, newRecord, reason) {
  const user = getCurrentUser()
  const logs = getAllLogs()

  // 对比字段变化
  const fieldChanges = []
  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])
  const ignoreKeys = new Set(['updatedAt'])

  allKeys.forEach(key => {
    if (ignoreKeys.has(key)) return
    const oldVal = oldRecord[key]
    const newVal = newRecord[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      fieldChanges.push({
        field: key,
        oldValue: oldVal == null ? '' : String(oldVal),
        newValue: newVal == null ? '' : String(newVal)
      })
    }
  })

  if (fieldChanges.length === 0) return // 无变化不记录

  logs.push({
    id: util.generateId('L'),
    recordId,
    recordType,
    operation: '修改',
    operator: user.name || '未知',
    operatorId: user.id || '',
    operationTime: util.formatDateTime(new Date()),
    reason: reason || '',
    fieldChanges,
    operationIP: user.ip || '0.0.0.0'
  })
  wx.setStorageSync(STORAGE_KEY, logs)
}

/**
 * 记录删除操作
 */
function logDelete(recordId, recordType, detail) {
  const user = getCurrentUser()
  const logs = getAllLogs()
  logs.push({
    id: util.generateId('L'),
    recordId,
    recordType,
    operation: '删除',
    operator: user.name || '未知',
    operatorId: user.id || '',
    operationTime: util.formatDateTime(new Date()),
    reason: detail || '',
    fieldChanges: [],
    operationIP: user.ip || '0.0.0.0'
  })
  wx.setStorageSync(STORAGE_KEY, logs)
}

/**
 * 记录锁定操作
 */
function logLock(animalId, outcomeDate) {
  const user = getCurrentUser()
  const logs = getAllLogs()
  logs.push({
    id: util.generateId('L'),
    recordId: animalId,
    recordType: '数据锁定',
    operation: '锁定',
    operator: user.name || '未知',
    operatorId: user.id || '',
    operationTime: util.formatDateTime(new Date()),
    reason: `妊娠结局登记触发锁定，结局日期: ${outcomeDate}`,
    fieldChanges: [],
    operationIP: user.ip || '0.0.0.0'
  })
  wx.setStorageSync(STORAGE_KEY, logs)
}

/**
 * 获取指定记录的修改历史
 */
function getLogsByRecordId(recordId) {
  const logs = getAllLogs()
  return logs.filter(l => l.recordId === recordId)
}

module.exports = {
  getAllLogs,
  logCreate,
  logUpdate,
  logDelete,
  logLock,
  getLogsByRecordId
}
