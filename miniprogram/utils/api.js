/**
 * API 调用模块
 * 封装 wx.request 调用后端服务器，支持 Promise
 *
 * 开发环境：后端运行在本地，开发者工具勾选「不校验合法域名」
 * 生产环境：需在微信公众平台配置服务器域名（HTTPS）
 */

const API_BASE = 'http://localhost:3000/api'

/**
 * 通用请求方法（Promise 封装）
 * @param {string} path - API 路径（如 '/animals'）
 * @param {string} method - HTTP 方法
 * @param {Object} data - 请求体数据（POST/PUT/PATCH）
 * @returns {Promise<Object>} - 响应数据
 */
function request(path, method, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + path,
      method: method || 'GET',
      data: data || {},
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data
          if (body.success) {
            resolve(body.data)
          } else {
            reject(new Error(body.error || '服务器返回错误'))
          }
        } else {
          reject(new Error('HTTP 错误：' + res.statusCode))
        }
      },
      fail(err) {
        console.error('[API] 网络请求失败：', path, err)
        reject(new Error('网络请求失败，请检查服务器是否运行'))
      }
    })
  })
}

// ========== 快捷方法 ==========

function get(path) { return request(path, 'GET') }
function post(path, data) { return request(path, 'POST', data) }
function put(path, data) { return request(path, 'PUT', data) }
function patch(path, data) { return request(path, 'PATCH', data) }
function del(path, data) { return request(path, 'DELETE', data) }

// ========== 业务 API ==========

// 动物档案
function fetchAllAnimals() { return get('/animals') }
function fetchAnimalById(animalId) { return get('/animals/' + animalId) }
function upsertAnimalRemote(animalId, data) { return post('/animals', { animalId, ...data }) }
function updateAnimalStatusRemote(animalId, status) { return patch('/animals/' + animalId + '/status', { status }) }

// B超记录
function fetchBRecordsByAnimal(animalId, order) {
  return get('/b-records/animal/' + animalId + '?order=' + (order || 'asc'))
}
function fetchBRecordById(id) { return get('/b-records/' + id) }
function createBRecordRemote(data) { return post('/b-records', data) }
function updateBRecordRemote(id, data, reason, operator) {
  return put('/b-records/' + id, { ...data, reason, operator })
}

// 非B超记录
function fetchNonBRecordsByAnimal(animalId, order) {
  return get('/non-b-records/animal/' + animalId + '?order=' + (order || 'asc'))
}
function fetchNonBRecordById(id) { return get('/non-b-records/' + id) }
function createNonBRecordRemote(data) { return post('/non-b-records', data) }
function updateNonBRecordRemote(id, data, reason, operator) {
  return put('/non-b-records/' + id, { ...data, reason, operator })
}

// 妊娠结局
function fetchOutcomeRecordsByAnimal(animalId) {
  return get('/outcome-records/animal/' + animalId)
}
function createOutcomeRecordRemote(data) { return post('/outcome-records', data) }

// 删除
function deleteAnimalAllRecordsRemote(animalId, operator) {
  return del('/animals/' + animalId + '/all-records', { operator })
}

// 汇总
function fetchSummaryList() { return get('/summary') }

// 审计
function fetchAuditLogs(recordId) {
  const path = recordId ? '/audit-logs?recordId=' + recordId : '/audit-logs'
  return get(path)
}

// 特殊动物清单（弱猴/剖腹产）
function fetchSpecialLists(listType) {
  const path = listType ? '/special-lists?listType=' + listType : '/special-lists'
  return get(path)
}
function addToSpecialList(listType, animalId, operator) {
  return post('/special-lists', { listType, animalId, operator })
}
function removeFromSpecialList(listType, animalId) {
  return del('/special-lists/' + listType + '/' + animalId)
}

module.exports = {
  // 通用
  request,
  get,
  post,
  put,
  patch,
  del,
  // 业务
  fetchAllAnimals,
  fetchAnimalById,
  upsertAnimalRemote,
  updateAnimalStatusRemote,
  fetchBRecordsByAnimal,
  fetchBRecordById,
  createBRecordRemote,
  updateBRecordRemote,
  fetchNonBRecordsByAnimal,
  fetchNonBRecordById,
  createNonBRecordRemote,
  updateNonBRecordRemote,
  fetchOutcomeRecordsByAnimal,
  createOutcomeRecordRemote,
  deleteAnimalAllRecordsRemote,
  fetchSummaryList,
  fetchAuditLogs,
  // 特殊清单
  fetchSpecialLists,
  addToSpecialList,
  removeFromSpecialList
}
