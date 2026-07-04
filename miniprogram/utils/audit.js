/**
 * 审计日志模块（服务端 API 封装）
 *
 * 审计日志由服务端 service.js 的 logAudit() 写入 SQLite audit_logs 表，
 * 前端通过 api.fetchAuditLogs() 从服务端读取，不再使用本地缓存。
 */

const api = require('./api.js')

/**
 * 获取所有审计日志（从服务端）
 * @returns {Promise<Array>}
 */
function getAllLogs() {
  return api.fetchAuditLogs()
}

/**
 * 获取指定记录的修改历史（从服务端）
 * @param {string} recordId - 记录ID
 * @returns {Promise<Array>}
 */
function getLogsByRecordId(recordId) {
  return api.fetchAuditLogs(recordId)
}

module.exports = {
  getAllLogs,
  getLogsByRecordId
}
