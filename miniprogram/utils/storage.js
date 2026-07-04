/**
 * 数据存储管理模块（远程+本地混合版）
 *
 * 架构策略：
 * - 写操作（创建/更新/删除）：优先调用远程API，成功后同步本地缓存
 * - 读操作（查询/汇总）：优先从远程API获取最新数据，失败时回退本地缓存
 * - 初始化：从远程全量同步到本地缓存
 *
 * 本地缓存的作用：
 * - 网络异常时提供离线回退
 * - 页面渲染时提供即时数据（减少加载延迟）
 */

const api = require('./api.js')

const STORAGE_KEYS = {
  ANIMALS: 'animals',
  B_RECORDS: 'bUltrasoundRecords',
  NON_B_RECORDS: 'nonBUltrasoundRecords',
  OUTCOME_RECORDS: 'outcomeRecords',
  CURRENT_USER: 'currentUser'
}

/**
 * 获取当前登录用户信息
 */
function getCurrentUser() {
  const app = getApp ? getApp() : null
  if (app && app.globalData && app.globalData.currentUser) {
    return app.globalData.currentUser
  }
  const user = wx.getStorageSync(STORAGE_KEYS.CURRENT_USER)
  if (user) return user
  return null
}

function requireCurrentUser() {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('未能获取当前登录用户信息，请重新进入小程序后再试。')
  }
  return user
}

// ========== 初始化与全量同步 ==========

/**
 * 初始化存储：从远程服务器全量同步数据到本地缓存
 * @returns {Promise<boolean>} 是否成功同步
 */
function initStorage() {
  return syncFromServer().then(() => {
    console.log('[Storage] 初始化同步完成')
    return true
  }).catch(err => {
    console.warn('[Storage] 初始化同步失败，使用本地缓存：', err.message)
    // 确保本地缓存结构存在
    ensureLocalCacheStructure()
    return false
  })
}

function ensureLocalCacheStructure() {
  if (!wx.getStorageSync(STORAGE_KEYS.ANIMALS)) wx.setStorageSync(STORAGE_KEYS.ANIMALS, [])
  if (!wx.getStorageSync(STORAGE_KEYS.B_RECORDS)) wx.setStorageSync(STORAGE_KEYS.B_RECORDS, [])
  if (!wx.getStorageSync(STORAGE_KEYS.NON_B_RECORDS)) wx.setStorageSync(STORAGE_KEYS.NON_B_RECORDS, [])
  if (!wx.getStorageSync(STORAGE_KEYS.OUTCOME_RECORDS)) wx.setStorageSync(STORAGE_KEYS.OUTCOME_RECORDS, [])
}

/**
 * 从远程服务器全量同步所有数据到本地缓存
 */
function syncFromServer() {
  return Promise.all([
    api.fetchAllAnimals(),
    api.fetchBRecordsByAnimal('', 'asc'),  // 获取全部需特殊处理
    api.fetchNonBRecordsByAnimal('', 'asc'),
    api.fetchSummaryList()  // 通过汇总接口间接获取
  ]).then(([animals]) => {
    wx.setStorageSync(STORAGE_KEYS.ANIMALS, animals || [])
    // 通过汇总数据重建本地缓存（汇总包含所有关联数据）
    return syncDetailedDataFromSummary()
  }).catch(err => {
    console.warn('[Storage] 全量同步部分失败：', err.message)
    throw err
  })
}

/**
 * 从汇总数据重建本地缓存
 */
function syncDetailedDataFromSummary() {
  return api.fetchSummaryList().then(summaryList => {
    if (!summaryList || !Array.isArray(summaryList)) return

    // 从汇总数据提取动物列表和记录
    const animals = []
    const allBRecords = []
    const allNonBRecords = []
    const allOutcomeRecords = []

    summaryList.forEach(item => {
      animals.push({
        animalId: item.animalId,
        status: item.status,
        latestBUltrasoundDate: item.latestBUltrasoundDate,
        latestNonBUltrasoundDate: item.latestNonBUltrasoundDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })
      if (item.latestBRecord) allBRecords.push(item.latestBRecord)
      if (item.latestNonBRecord) allNonBRecords.push(item.latestNonBRecord)
      if (item.latestOutcome) allOutcomeRecords.push(item.latestOutcome)
    })

    // 注意：汇总只返回最新记录，需额外获取每只动物的全部记录
    const animalIds = animals.map(a => a.animalId)
    const detailPromises = animalIds.map(id => {
      return Promise.all([
        api.fetchBRecordsByAnimal(id, 'asc'),
        api.fetchBRecordsByAnimal(id, 'desc'),
        api.fetchNonBRecordsByAnimal(id, 'asc'),
        api.fetchOutcomeRecordsByAnimal(id)
      ]).then(([bAsc, bDesc, nbAsc, outcomes]) => {
        // 用正序结果更新全局B超缓存（去重）
        (bAsc || []).forEach(r => {
          if (!allBRecords.find(x => x.id === r.id)) allBRecords.push(r)
        })
        (nbAsc || []).forEach(r => {
          if (!allNonBRecords.find(x => x.id === r.id)) allNonBRecords.push(r)
        })
        (outcomes || []).forEach(r => {
          if (!allOutcomeRecords.find(x => x.id === r.id)) allOutcomeRecords.push(r)
        })
      }).catch(() => {})  // 单个动物获取失败不影响整体
    })

    return Promise.all(detailPromises).then(() => {
      wx.setStorageSync(STORAGE_KEYS.ANIMALS, animals)
      wx.setStorageSync(STORAGE_KEYS.B_RECORDS, allBRecords)
      wx.setStorageSync(STORAGE_KEYS.NON_B_RECORDS, allNonBRecords)
      wx.setStorageSync(STORAGE_KEYS.OUTCOME_RECORDS, allOutcomeRecords)
      console.log('[Storage] 本地缓存已更新')
    })
  })
}

// ========== 本地缓存读取（同步，用于页面快速渲染） ==========

function getAllAnimals() {
  return wx.getStorageSync(STORAGE_KEYS.ANIMALS) || []
}

function getAnimalById(animalId) {
  const animals = getAllAnimals()
  return animals.find(a => a.animalId === animalId)
}

function getAllBRecords() {
  return wx.getStorageSync(STORAGE_KEYS.B_RECORDS) || []
}

function getBRecordsByAnimal(animalId) {
  const records = getAllBRecords()
  return records
    .filter(r => r.animalId === animalId)
    .sort((a, b) => {
      // operationDate: "YYYY-MM-DD", createdAt: "YYYYMMDD HH:MM:SS"
      // Both formats are lexicographically sortable; avoid new Date() which
      // returns Invalid Date for the non-ISO createdAt format
      const opA = a.operationDate || ''
      const opB = b.operationDate || ''
      if (opA !== opB) return opA < opB ? -1 : 1
      const ctA = a.createdAt || ''
      const ctB = b.createdAt || ''
      if (ctA !== ctB) return ctA < ctB ? -1 : 1
      return 0
    })
}

function getBRecordsByAnimalDesc(animalId) {
  const records = getAllBRecords()
  return records
    .filter(r => r.animalId === animalId)
    .sort((a, b) => {
      // operationDate: "YYYY-MM-DD", createdAt: "YYYYMMDD HH:MM:SS"
      // Both formats are lexicographically sortable; avoid new Date() which
      // returns Invalid Date for the non-ISO createdAt format
      const opA = a.operationDate || ''
      const opB = b.operationDate || ''
      if (opA !== opB) return opB < opA ? -1 : 1
      const ctA = a.createdAt || ''
      const ctB = b.createdAt || ''
      if (ctA !== ctB) return ctB < ctA ? -1 : 1
      return 0
    })
}

function getBRecordById(id) {
  const records = getAllBRecords()
  return records.find(r => r.id === id)
}

function getAllNonBRecords() {
  return wx.getStorageSync(STORAGE_KEYS.NON_B_RECORDS) || []
}

function getNonBRecordsByAnimal(animalId) {
  const records = getAllNonBRecords()
  return records
    .filter(r => r.animalId === animalId)
    .sort((a, b) => {
      // operationDate: "YYYY-MM-DD", createdAt: "YYYYMMDD HH:MM:SS"
      // Both formats are lexicographically sortable; avoid new Date() which
      // returns Invalid Date for the non-ISO createdAt format
      const opA = a.operationDate || ''
      const opB = b.operationDate || ''
      if (opA !== opB) return opA < opB ? -1 : 1
      const ctA = a.createdAt || ''
      const ctB = b.createdAt || ''
      if (ctA !== ctB) return ctA < ctB ? -1 : 1
      return 0
    })
}

function getNonBRecordsByAnimalDesc(animalId) {
  const records = getAllNonBRecords()
  return records
    .filter(r => r.animalId === animalId)
    .sort((a, b) => {
      // operationDate: "YYYY-MM-DD", createdAt: "YYYYMMDD HH:MM:SS"
      // Both formats are lexicographically sortable; avoid new Date() which
      // returns Invalid Date for the non-ISO createdAt format
      const opA = a.operationDate || ''
      const opB = b.operationDate || ''
      if (opA !== opB) return opB < opA ? -1 : 1
      const ctA = a.createdAt || ''
      const ctB = b.createdAt || ''
      if (ctA !== ctB) return ctB < ctA ? -1 : 1
      return 0
    })
}

function getNonBRecordById(id) {
  const records = getAllNonBRecords()
  return records.find(r => r.id === id)
}

function getAllOutcomeRecords() {
  return wx.getStorageSync(STORAGE_KEYS.OUTCOME_RECORDS) || []
}

function getOutcomeRecordsByAnimalDesc(animalId) {
  const records = getAllOutcomeRecords()
  return records
    .filter(r => r.animalId === animalId)
    .sort((a, b) => {
      // outcomeDate: "YYYY-MM-DD" — lexicographically sortable
      const odA = a.outcomeDate || ''
      const odB = b.outcomeDate || ''
      if (odA !== odB) return odB < odA ? -1 : 1
      return 0
    })
}

// ========== 标准胎龄与超期标签（本地缓存计算） ==========

const util = require('./util.js')

function getCurrentStandardAge(animalId) {
  const pregnantRecords = getBRecordsByAnimal(animalId)
    .filter(r => r.pregnancyStatus === '在孕')
  if (pregnantRecords.length === 0) return null
  const baseRecord = pregnantRecords[0]
  return (baseRecord.calculatedAge || 0) + util.daysBetween(baseRecord.operationDate, util.today())
}

function getOverdueTags(animalId) {
  const tags = []
  const outcomeRecords = getAllOutcomeRecords()
  if (outcomeRecords.some(r => r.animalId === animalId)) return tags
  const animalBRecords = getBRecordsByAnimalDesc(animalId)
  if (animalBRecords.length === 0) return tags
  if (animalBRecords[0].pregnancyStatus !== '在孕') return tags
  const currentStandardAge = getCurrentStandardAge(animalId)
  if (currentStandardAge == null) return tags
  if (currentStandardAge > 170) tags.push('超预产期15天')
  else if (currentStandardAge >= 156 && currentStandardAge <= 170) tags.push('超预产期3天')
  return tags
}

// ========== 汇总（本地缓存计算，用于快速渲染） ==========

function getSummaryList() {
  const animals = getAllAnimals()
  const outcomeRecords = getAllOutcomeRecords()

  return animals.map(animal => {
    const animalBRecords = getBRecordsByAnimalDesc(animal.animalId)
    const animalNonBRecords = getNonBRecordsByAnimalDesc(animal.animalId)
    const animalOutcomes = outcomeRecords
      .filter(r => r.animalId === animal.animalId)
      .sort((a, b) => new Date(b.outcomeDate) - new Date(a.outcomeDate))

    const latestBRecord = animalBRecords[0] || null
    const latestNonBRecord = animalNonBRecords[0] || null
    const latestOutcome = animalOutcomes[0] || null

    const today = util.today()
    const bDaysSince = latestBRecord ? util.daysBetween(latestBRecord.operationDate, today) : null
    const nonBDaysSince = latestNonBRecord ? util.daysBetween(latestNonBRecord.operationDate, today) : null
    const currentStandardAge = getCurrentStandardAge(animal.animalId)

    let mergedTags = []
    if (latestBRecord && latestBRecord.riskTags) mergedTags = mergedTags.concat(latestBRecord.riskTags)
    if (latestNonBRecord && latestNonBRecord.riskTags) {
      latestNonBRecord.riskTags.forEach(t => { if (mergedTags.indexOf(t) === -1) mergedTags.push(t) })
    }
    const overdueTags = getOverdueTags(animal.animalId)
    overdueTags.forEach(t => { if (mergedTags.indexOf(t) === -1) mergedTags.push(t) })

    const uniqueTags = []
    mergedTags.forEach(t => { if (uniqueTags.indexOf(t) === -1) uniqueTags.push(t) })
    const over15Idx = uniqueTags.indexOf('超预产期15天')
    const over3Idx = uniqueTags.indexOf('超预产期3天')
    if (over15Idx !== -1 && over3Idx !== -1) uniqueTags.splice(over3Idx, 1)

    return {
      ...animal,
      latestBUltrasoundDate: latestBRecord ? latestBRecord.operationDate : '',
      latestNonBUltrasoundDate: latestNonBRecord ? latestNonBRecord.operationDate : '',
      latestBRecord,
      latestNonBRecord,
      latestOutcome,
      bRecordCount: animalBRecords.length,
      nonBRecordCount: animalNonBRecords.length,
      outcomeCount: animalOutcomes.length,
      mergedRiskTags: uniqueTags,
      bDaysSince,
      nonBDaysSince,
      currentStandardAge
    }
  })
}

// ========== 写操作（异步，远程API优先 + 本地缓存同步） ==========

/**
 * 创建B超记录（异步）
 * 流程：前端校验 → 调用远程API → 更新本地缓存
 */
function createBRecord(data) {
  const currentUser = requireCurrentUser()
  const operator = { id: currentUser.id || '', name: currentUser.name || '', role: currentUser.role || '' }

  // 前端校验（快速反馈）
  const dateErr = validateBDate(data.animalId, data.operationDate)
  if (dateErr) return Promise.reject(new Error(dateErr))

  const flowErr = validateBStatusFlow(data.animalId, data.pregnancyStatus)
  if (flowErr) return Promise.reject(new Error(flowErr))

  const valErr = validateBRecordData(data)
  if (valErr) return Promise.reject(new Error(valErr))

  // 调用远程API
  return api.createBRecordRemote({ ...data, operator }).then(newRecord => {
    // 更新本地缓存
    const records = getAllBRecords()
    records.push(newRecord)
    wx.setStorageSync(STORAGE_KEYS.B_RECORDS, records)

    // 更新动物档案
    const animals = getAllAnimals()
    const idx = animals.findIndex(a => a.animalId === data.animalId)
    if (idx >= 0) {
      animals[idx] = { ...animals[idx], status: data.pregnancyStatus, latestBUltrasoundDate: data.operationDate }
    } else {
      animals.push({ animalId: data.animalId, status: data.pregnancyStatus, latestBUltrasoundDate: data.operationDate })
    }
    wx.setStorageSync(STORAGE_KEYS.ANIMALS, animals)

    return newRecord
  })
}

/**
 * 更新B超记录（异步）
 */
function updateBRecord(id, data, reason) {
  const currentUser = requireCurrentUser()
  const operator = { id: currentUser.id || '', name: currentUser.name || '', role: currentUser.role || '' }

  return api.updateBRecordRemote(id, data, reason, operator).then(updatedRecord => {
    // 更新本地缓存
    const records = getAllBRecords()
    const idx = records.findIndex(r => r.id === id)
    if (idx >= 0) records[idx] = updatedRecord
    wx.setStorageSync(STORAGE_KEYS.B_RECORDS, records)

    // 更新动物档案
    const animals = getAllAnimals()
    const aIdx = animals.findIndex(a => a.animalId === updatedRecord.animalId)
    if (aIdx >= 0) {
      animals[aIdx].status = updatedRecord.pregnancyStatus
      animals[aIdx].latestBUltrasoundDate = updatedRecord.operationDate
      wx.setStorageSync(STORAGE_KEYS.ANIMALS, animals)
    }

    return updatedRecord
  })
}

/**
 * 创建非B超记录（异步）
 */
function createNonBRecord(data) {
  const currentUser = requireCurrentUser()
  const operator = { id: currentUser.id || '', name: currentUser.name || '', role: currentUser.role || '' }

  const dateErr = validateNonBDate(data.animalId, data.operationDate)
  if (dateErr) return Promise.reject(new Error(dateErr))

  const partsErr = validateNonBExamParts(data.animalId, data.examParts)
  if (partsErr) return Promise.reject(new Error(partsErr))

  return api.createNonBRecordRemote({ ...data, operator }).then(newRecord => {
    const records = getAllNonBRecords()
    records.push(newRecord)
    wx.setStorageSync(STORAGE_KEYS.NON_B_RECORDS, records)

    const animals = getAllAnimals()
    const idx = animals.findIndex(a => a.animalId === data.animalId)
    if (idx >= 0) {
      animals[idx].latestNonBUltrasoundDate = data.operationDate
      wx.setStorageSync(STORAGE_KEYS.ANIMALS, animals)
    }

    return newRecord
  })
}

/**
 * 更新非B超记录（异步）
 */
function updateNonBRecord(id, data, reason) {
  const currentUser = requireCurrentUser()
  const operator = { id: currentUser.id || '', name: currentUser.name || '', role: currentUser.role || '' }

  return api.updateNonBRecordRemote(id, data, reason, operator).then(updatedRecord => {
    const records = getAllNonBRecords()
    const idx = records.findIndex(r => r.id === id)
    if (idx >= 0) records[idx] = updatedRecord
    wx.setStorageSync(STORAGE_KEYS.NON_B_RECORDS, records)
    return updatedRecord
  })
}

/**
 * 创建妊娠结局记录（异步）
 */
function createOutcomeRecord(data) {
  const currentUser = requireCurrentUser()
  const operator = { id: currentUser.id || '', name: currentUser.name || '', role: currentUser.role || '' }

  const statusErr = validateOutcomeStatus(data.animalId)
  if (statusErr) return Promise.reject(new Error(statusErr))

  const dateErr = validateOutcomeDate(data.animalId, data.outcomeDate)
  if (dateErr) return Promise.reject(new Error(dateErr))

  return api.createOutcomeRecordRemote({ ...data, operator }).then(newRecord => {
    // 远程API已处理锁定和状态更新，刷新本地缓存
    const outcomes = getAllOutcomeRecords()
    outcomes.push(newRecord)
    wx.setStorageSync(STORAGE_KEYS.OUTCOME_RECORDS, outcomes)

    // 更新动物状态为已结案
    const animals = getAllAnimals()
    const idx = animals.findIndex(a => a.animalId === data.animalId)
    if (idx >= 0) {
      animals[idx].status = '已结案'
      wx.setStorageSync(STORAGE_KEYS.ANIMALS, animals)
    }

    // 锁定本地B超和非B超记录
    const bRecords = getAllBRecords()
    bRecords.forEach(r => {
      if (r.animalId === data.animalId && r.operationDate <= data.outcomeDate) r.status = '锁定'
    })
    wx.setStorageSync(STORAGE_KEYS.B_RECORDS, bRecords)

    const nonBRecords = getAllNonBRecords()
    nonBRecords.forEach(r => {
      if (r.animalId === data.animalId && r.operationDate <= data.outcomeDate) r.status = '锁定'
    })
    wx.setStorageSync(STORAGE_KEYS.NON_B_RECORDS, nonBRecords)

    return newRecord
  })
}

/**
 * 删除动物所有记录（异步）
 */
function deleteAnimalAllRecords(animalId) {
  const currentUser = requireCurrentUser()
  const operator = { id: currentUser.id || '', name: currentUser.name || '', role: currentUser.role || '' }

  return api.deleteAnimalAllRecordsRemote(animalId, operator).then(() => {
    // 远程删除成功后同步本地
    wx.setStorageSync(STORAGE_KEYS.ANIMALS, getAllAnimals().filter(a => a.animalId !== animalId))
    wx.setStorageSync(STORAGE_KEYS.B_RECORDS, getAllBRecords().filter(r => r.animalId !== animalId))
    wx.setStorageSync(STORAGE_KEYS.NON_B_RECORDS, getAllNonBRecords().filter(r => r.animalId !== animalId))
    wx.setStorageSync(STORAGE_KEYS.OUTCOME_RECORDS, getAllOutcomeRecords().filter(r => r.animalId !== animalId))
    return true
  })
}

// ========== 前端校验函数（同步，用于快速反馈） ==========

function validateBDate(animalId, operationDate) {
  const records = getBRecordsByAnimal(animalId)
  if (records.length === 0) return null
  const latestDate = records[records.length - 1].operationDate
  if (operationDate < latestDate) return '检查日期不能早于上一次检查。'
  return null
}

function validateNonBDate(animalId, operationDate) {
  const records = getNonBRecordsByAnimal(animalId)
  if (records.length === 0) return null
  const latestDate = records[records.length - 1].operationDate
  if (operationDate < latestDate) return '检查日期不能早于上一次检查。'
  return null
}

function validateNonBExamParts(animalId, examParts) {
  if (!examParts || !Array.isArray(examParts)) return null
  if (!examParts.includes('胎位')) return null
  const animal = getAnimalById(animalId)
  if (animal && (animal.status === '未孕' || animal.status === '疑似怀孕')) {
    return '该动物尚无B超怀孕信息，无法录入。'
  }
  return null
}

function validateBStatusFlow(animalId, newPregnancyStatus) {
  const animal = getAnimalById(animalId)
  if (animal && animal.status === '在孕' && (newPregnancyStatus === '未孕' || newPregnancyStatus === '疑似怀孕')) {
    return '动物在孕期间无法直接录入未孕或疑似怀孕记录，请登记妊娠结局。'
  }
  return null
}

function validateOutcomeStatus(animalId) {
  const animal = getAnimalById(animalId)
  if (!animal || (animal.status !== '在孕' && animal.status !== '疑似怀孕')) {
    return '只有在孕或疑似怀孕的动物才能登记妊娠结局。'
  }
  return null
}

function validateOutcomeDate(animalId, outcomeDate) {
  const bRecords = getBRecordsByAnimal(animalId)
  const firstPregnant = bRecords.find(r => r.pregnancyStatus === '在孕' || r.pregnancyStatus === '疑似怀孕')
  if (!firstPregnant) return '该动物无在孕或疑似怀孕B超记录，无法登记结局。'
  if (outcomeDate < firstPregnant.operationDate) return '结局日期不能早于在孕/疑似怀孕登记日期'
  return null
}

function validateAnimalIdFormat(animalId) {
  if (!animalId) return '动物编号不能为空'
  if (animalId.length < 5 || animalId.length > 8) return '动物编号必须为5-8位数字和字母组合'
  if (!/^[A-Z0-9]+$/.test(animalId)) return '动物编号必须为5-8位数字和字母组合'
  return null
}

function validateNumberRange(val, min, max, fieldName) {
  if (val === '' || val === undefined || val === null) return null
  const num = parseFloat(val)
  if (isNaN(num)) return `${fieldName}必须为数字`
  if (num < min || num > max) return `${fieldName}必须为${min}-${max}内的数字`
  return null
}

function validateBRecordData(data) {
  let err = validateAnimalIdFormat(data.animalId)
  if (err) return err
  if (data.pregnancyStatus === '在孕') {
    if (data.fetalStage === '胚种期') {
      err = validateNumberRange(data.gestationalSac, 0, 3, '孕囊')
      if (err) return err
    }
    if (data.fetalStage === '胚胎期') {
      err = validateNumberRange(data.crl, 0, 5, '长径/顶臀径')
      if (err) return err
    }
    if (data.fetalStage === '胎儿期') {
      err = validateNumberRange(data.bpd, 0, 5.5, '双顶径')
      if (err) return err
      err = validateNumberRange(data.abdominalCircumference, 0, 20, '腹围')
      if (err) return err
    }
    err = validateNumberRange(data.fetalHeartValue, 0, 300, '胎心数值')
    if (err) return err
  }
  return null
}

// ========== 远程数据刷新（异步） ==========

/**
 * 刷新汇总数据：从远程获取最新汇总并更新本地缓存
 * @returns {Promise<Array>} 汇总列表
 */
function refreshSummaryList() {
  return api.fetchSummaryList().then(list => {
    if (!list || !Array.isArray(list)) return getSummaryList()

    // 更新本地动物档案
    const animals = list.map(item => ({
      animalId: item.animalId,
      status: item.status,
      latestBUltrasoundDate: item.latestBUltrasoundDate,
      latestNonBUltrasoundDate: item.latestNonBUltrasoundDate,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
    wx.setStorageSync(STORAGE_KEYS.ANIMALS, animals)

    // 重建B超/非B超/结局缓存
    const allBRecords = []
    const allNonBRecords = []
    const allOutcomes = []

    list.forEach(item => {
      if (item.latestBRecord) {
        if (!allBRecords.find(x => x.id === item.latestBRecord.id)) allBRecords.push(item.latestBRecord)
      }
      if (item.latestNonBRecord) {
        if (!allNonBRecords.find(x => x.id === item.latestNonBRecord.id)) allNonBRecords.push(item.latestNonBRecord)
      }
      if (item.latestOutcome) {
        if (!allOutcomes.find(x => x.id === item.latestOutcome.id)) allOutcomes.push(item.latestOutcome)
      }
    })

    wx.setStorageSync(STORAGE_KEYS.B_RECORDS, allBRecords)
    wx.setStorageSync(STORAGE_KEYS.NON_B_RECORDS, allNonBRecords)
    wx.setStorageSync(STORAGE_KEYS.OUTCOME_RECORDS, allOutcomes)

    return list
  }).catch(err => {
    console.warn('[Storage] 远程刷新失败，使用本地缓存：', err.message)
    return getSummaryList()
  })
}

module.exports = {
  STORAGE_KEYS,
  initStorage,
  getCurrentUser,
  // 动物档案（本地读取）
  getAllAnimals,
  getAnimalById,
  // B超记录（本地读取）
  getAllBRecords,
  getBRecordsByAnimal,
  getBRecordsByAnimalDesc,
  getBRecordById,
  // 非B超记录（本地读取）
  getAllNonBRecords,
  getNonBRecordsByAnimal,
  getNonBRecordsByAnimalDesc,
  getNonBRecordById,
  // 妊娠结局（本地读取）
  getAllOutcomeRecords,
  getOutcomeRecordsByAnimalDesc,
  // 汇总（本地缓存计算）
  getSummaryList,
  getOverdueTags,
  getCurrentStandardAge,
  // 写操作（异步，返回 Promise）
  createBRecord,
  updateBRecord,
  createNonBRecord,
  updateNonBRecord,
  createOutcomeRecord,
  deleteAnimalAllRecords,
  // 刷新（异步，返回 Promise）
  refreshSummaryList,
  // 校验函数（同步）
  validateBDate,
  validateNonBDate,
  validateNonBExamParts,
  validateBStatusFlow,
  validateOutcomeStatus,
  validateOutcomeDate,
  validateAnimalIdFormat,
  validateNumberRange,
  validateBRecordData
}
