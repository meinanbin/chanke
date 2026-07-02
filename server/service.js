/**
 * 核心业务逻辑模块（服务端版本）
 * 包含所有校验、CRUD、标签计算、汇总等逻辑
 */

const { getDB } = require('./db.js')
const util = require('./utils.js')
const riskTags = require('./risk-tags.js')
const gestationalAge = require('./gestational-age.js')

// ========== JSON 字段解析辅助 ==========

function parseJsonField(val, defaultVal) {
  if (!val) return defaultVal || []
  if (typeof val === 'string') {
    try { return JSON.parse(val) } catch (e) { return defaultVal || [] }
  }
  return val
}

function toJsonStr(val) {
  if (typeof val === 'string') return val
  return JSON.stringify(val || [])
}

// ========== 校验函数 ==========

function validateAnimalIdFormat(animalId) {
  if (!animalId) return '动物编号不能为空'
  if (animalId.length < 5 || animalId.length > 8) return '动物编号必须为5-8位数字和字母组合'
  if (!/^[A-Z0-9]+$/.test(animalId)) return '动物编号必须为5-8位数字和字母组合'
  return null
}

function validateBDate(animalId, operationDate) {
  const db = getDB()
  const rows = db.prepare(
    'SELECT operationDate FROM b_records WHERE animalId = ? ORDER BY operationDate ASC'
  ).all(animalId)
  if (rows.length === 0) return null
  const latestDate = rows[rows.length - 1].operationDate
  if (operationDate < latestDate) return '检查日期不能早于上一次检查。'
  return null
}

function validateNonBDate(animalId, operationDate) {
  const db = getDB()
  const rows = db.prepare(
    'SELECT operationDate FROM non_b_records WHERE animalId = ? ORDER BY operationDate ASC'
  ).all(animalId)
  if (rows.length === 0) return null
  const latestDate = rows[rows.length - 1].operationDate
  if (operationDate < latestDate) return '检查日期不能早于上一次检查。'
  return null
}

function validateNonBExamParts(animalId, examParts) {
  if (!examParts || !Array.isArray(examParts) || !examParts.includes('胎位')) return null
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
  const db = getDB()
  const rows = db.prepare(
    'SELECT operationDate, pregnancyStatus FROM b_records WHERE animalId = ? ORDER BY operationDate ASC'
  ).all(animalId)
  const firstPregnant = rows.find(r => r.pregnancyStatus === '在孕' || r.pregnancyStatus === '疑似怀孕')
  if (!firstPregnant) return '该动物无在孕或疑似怀孕B超记录，无法登记结局。'
  if (outcomeDate < firstPregnant.operationDate) return '结局日期不能早于在孕/疑似怀孕登记日期'
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

// ========== 动物档案 ==========

function getAllAnimals() {
  const db = getDB()
  return db.prepare('SELECT * FROM animals ORDER BY createdAt DESC').all()
}

function getAnimalById(animalId) {
  const db = getDB()
  return db.prepare('SELECT * FROM animals WHERE animalId = ?').get(animalId)
}

function upsertAnimal(animalId, data) {
  const db = getDB()
  const existing = db.prepare('SELECT * FROM animals WHERE animalId = ?').get(animalId)
  const now = util.formatDateTime(new Date())

  if (existing) {
    db.prepare(`
      UPDATE animals SET status = ?, latestBUltrasoundDate = ?, latestNonBUltrasoundDate = ?, updatedAt = ?
      WHERE animalId = ?
    `).run(
      data.status || existing.status,
      data.latestBUltrasoundDate || existing.latestBUltrasoundDate,
      data.latestNonBUltrasoundDate || existing.latestNonBUltrasoundDate,
      now,
      animalId
    )
  } else {
    db.prepare(`
      INSERT INTO animals (animalId, status, latestBUltrasoundDate, latestNonBUltrasoundDate, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      animalId,
      data.status || '未孕',
      data.latestBUltrasoundDate || '',
      data.latestNonBUltrasoundDate || '',
      now,
      now
    )
  }

  return getAnimalById(animalId)
}

function updateAnimalStatus(animalId, status) {
  const db = getDB()
  const now = util.formatDateTime(new Date())
  db.prepare('UPDATE animals SET status = ?, updatedAt = ? WHERE animalId = ?').run(status, now, animalId)
}

// ========== B超记录 ==========

function getBRecordsByAnimal(animalId) {
  const db = getDB()
  const rows = db.prepare(
    'SELECT * FROM b_records WHERE animalId = ? ORDER BY operationDate ASC, createdAt ASC'
  ).all(animalId)
  return rows.map(r => enrichBRecord(r))
}

function getBRecordsByAnimalDesc(animalId) {
  const db = getDB()
  const rows = db.prepare(
    'SELECT * FROM b_records WHERE animalId = ? ORDER BY operationDate DESC, createdAt DESC'
  ).all(animalId)
  return rows.map(r => enrichBRecord(r))
}

function getBRecordById(id) {
  const db = getDB()
  const row = db.prepare('SELECT * FROM b_records WHERE id = ?').get(id)
  return row ? enrichBRecord(row) : null
}

function enrichBRecord(r) {
  r.riskTags = parseJsonField(r.riskTags, [])
  r.placentaPosition = parseJsonField(r.placentaPosition, [])
  r.operator = parseJsonField(r.operator, {})
  return r
}

function createBRecord(data, operator) {
  const dateErr = validateBDate(data.animalId, data.operationDate)
  if (dateErr) throw new Error(dateErr)

  const flowErr = validateBStatusFlow(data.animalId, data.pregnancyStatus)
  if (flowErr) throw new Error(flowErr)

  const valErr = validateBRecordData(data)
  if (valErr) throw new Error(valErr)

  const db = getDB()
  const now = util.formatDateTime(new Date())
  const id = util.generateId('B')

  // 计算胎龄
  let measurement = null
  if (data.fetalStage === '胚种期') measurement = null
  else if (data.fetalStage === '胚胎期') measurement = data.crl
  else if (data.fetalStage === '胎儿期') measurement = data.bpd

  const calculatedAge = gestationalAge.calcGestationalAge(data.fetalStage, measurement)
  const existingRecords = getBRecordsByAnimal(data.animalId)
  const standardAge = gestationalAge.calcStandardAge(data.animalId, data.operationDate, calculatedAge, existingRecords)

  // 计算高风险标签
  const animalInfo = getAnimalById(data.animalId)
  const bRecords = [...existingRecords]
  const nonBRecords = getNonBRecordsByAnimal(data.animalId)
  const riskTagsResult = riskTags.calcBTags(
    { ...data, calculatedAge, standardAge },
    data.animalId, bRecords, nonBRecords, animalInfo
  )

  db.prepare(`
    INSERT INTO b_records (
      id, animalId, operationDate, pregnancyStatus, fetalStage,
      gestationalSac, crl, bpd, abdominalCircumference,
      fetalHeartStrength, fetalHeartValue, fetalPosition,
      placentaPosition, amnioticFluid, amnioticFluidPollution,
      vetHighRisk, birthCanalAbnormality, uterineAbnormality,
      remark, calculatedAge, standardAge, status, riskTags, operator,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.animalId, data.operationDate, data.pregnancyStatus, data.fetalStage || '',
    data.gestationalSac || '', data.crl || '', data.bpd || '', data.abdominalCircumference || '',
    data.fetalHeartStrength || '', data.fetalHeartValue || '', data.fetalPosition || '',
    toJsonStr(data.placentaPosition || []),
    data.amnioticFluid || '', data.amnioticFluidPollution || '',
    data.vetHighRisk || '', data.birthCanalAbnormality || '', data.uterineAbnormality || '',
    data.remark || '', calculatedAge, standardAge, '可编辑',
    toJsonStr(riskTagsResult),
    toJsonStr(operator || {}),
    now, now
  )

  // 更新动物档案
  upsertAnimal(data.animalId, {
    status: data.pregnancyStatus,
    latestBUltrasoundDate: data.operationDate
  })

  // 记录审计日志
  logAudit(id, 'B超检查', '创建', operator, '', [])

  return getBRecordById(id)
}

function updateBRecord(id, data, reason, operator) {
  const db = getDB()
  const oldRow = db.prepare('SELECT * FROM b_records WHERE id = ?').get(id)
  if (!oldRow) return null

  if (oldRow.status === '锁定') throw new Error('该记录已被锁定，无法编辑')

  const valErr = validateBRecordData(data)
  if (valErr) throw new Error(valErr)

  // 计算胎龄
  let measurement = null
  if (data.fetalStage === '胚种期') measurement = null
  else if (data.fetalStage === '胚胎期') measurement = data.crl
  else if (data.fetalStage === '胎儿期') measurement = data.bpd

  const calculatedAge = gestationalAge.calcGestationalAge(data.fetalStage, measurement)
  const existingRecords = getBRecordsByAnimal(oldRow.animalId).filter(r => r.id !== id)
  const standardAge = gestationalAge.calcStandardAge(oldRow.animalId, data.operationDate, calculatedAge, existingRecords)

  // 计算高风险标签
  const animalInfo = getAnimalById(oldRow.animalId)
  const bRecords = [...existingRecords, { ...data, calculatedAge, standardAge, animalId: oldRow.animalId }]
  const nonBRecords = getNonBRecordsByAnimal(oldRow.animalId)
  const riskTagsResult = riskTags.calcBTags(
    { ...data, calculatedAge, standardAge, animalId: oldRow.animalId },
    oldRow.animalId, bRecords, nonBRecords, animalInfo
  )

  const now = util.formatDateTime(new Date())

  db.prepare(`
    UPDATE b_records SET
      operationDate = ?, pregnancyStatus = ?, fetalStage = ?,
      gestationalSac = ?, crl = ?, bpd = ?, abdominalCircumference = ?,
      fetalHeartStrength = ?, fetalHeartValue = ?, fetalPosition = ?,
      placentaPosition = ?, amnioticFluid = ?, amnioticFluidPollution = ?,
      vetHighRisk = ?, birthCanalAbnormality = ?, uterineAbnormality = ?,
      remark = ?, calculatedAge = ?, standardAge = ?,
      riskTags = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    data.operationDate || oldRow.operationDate,
    data.pregnancyStatus || oldRow.pregnancyStatus,
    data.fetalStage || oldRow.fetalStage,
    data.gestationalSac || oldRow.gestationalSac,
    data.crl || oldRow.crl,
    data.bpd || oldRow.bpd,
    data.abdominalCircumference || oldRow.abdominalCircumference,
    data.fetalHeartStrength || oldRow.fetalHeartStrength,
    data.fetalHeartValue || oldRow.fetalHeartValue,
    data.fetalPosition || oldRow.fetalPosition,
    toJsonStr(data.placentaPosition || parseJsonField(oldRow.placentaPosition, [])),
    data.amnioticFluid || oldRow.amnioticFluid,
    data.amnioticFluidPollution || oldRow.amnioticFluidPollution,
    data.vetHighRisk || oldRow.vetHighRisk,
    data.birthCanalAbnormality || oldRow.birthCanalAbnormality,
    data.uterineAbnormality || oldRow.uterineAbnormality,
    data.remark || oldRow.remark,
    calculatedAge !== null ? calculatedAge : oldRow.calculatedAge,
    standardAge !== null ? standardAge : oldRow.standardAge,
    toJsonStr(riskTagsResult),
    now,
    id
  )

  if (data.pregnancyStatus) {
    upsertAnimal(oldRow.animalId, {
      status: data.pregnancyStatus,
      latestBUltrasoundDate: data.operationDate || oldRow.operationDate
    })
  }

  // 记录审计日志
  const oldEnriched = enrichBRecord({ ...oldRow })
  const newEnriched = getBRecordById(id)
  logAudit(id, 'B超检查', '修改', operator, reason || '', diffFields(oldEnriched, newEnriched))

  return newEnriched
}

// ========== 非B超记录 ==========

function getNonBRecordsByAnimal(animalId) {
  const db = getDB()
  const rows = db.prepare(
    'SELECT * FROM non_b_records WHERE animalId = ? ORDER BY operationDate ASC, createdAt ASC'
  ).all(animalId)
  return rows.map(r => enrichNonBRecord(r))
}

function getNonBRecordsByAnimalDesc(animalId) {
  const db = getDB()
  const rows = db.prepare(
    'SELECT * FROM non_b_records WHERE animalId = ? ORDER BY operationDate DESC, createdAt DESC'
  ).all(animalId)
  return rows.map(r => enrichNonBRecord(r))
}

function getNonBRecordById(id) {
  const db = getDB()
  const row = db.prepare('SELECT * FROM non_b_records WHERE id = ?').get(id)
  return row ? enrichNonBRecord(row) : null
}

function enrichNonBRecord(r) {
  r.riskTags = parseJsonField(r.riskTags, [])
  r.examParts = parseJsonField(r.examParts, [])
  r.operator = parseJsonField(r.operator, {})
  return r
}

function createNonBRecord(data, operator) {
  const dateErr = validateNonBDate(data.animalId, data.operationDate)
  if (dateErr) throw new Error(dateErr)

  const partsErr = validateNonBExamParts(data.animalId, data.examParts)
  if (partsErr) throw new Error(partsErr)

  const db = getDB()
  const now = util.formatDateTime(new Date())
  const id = util.generateId('N')

  // 计算高风险标签
  const animalInfo = getAnimalById(data.animalId)
  const bRecords = getBRecordsByAnimal(data.animalId)
  const nonBRecords = getNonBRecordsByAnimal(data.animalId)
  const riskTagsResult = riskTags.calcNonBTags(data, data.animalId, bRecords, nonBRecords, animalInfo)

  db.prepare(`
    INSERT INTO non_b_records (
      id, animalId, operationDate, examParts,
      fetalPosition, cervicalCheck, vetHighRisk,
      birthCanalAbnormality, uterineAbnormality, remark,
      status, riskTags, operator, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.animalId, data.operationDate,
    toJsonStr(data.examParts || []),
    data.fetalPosition || '', data.cervicalCheck || '',
    data.vetHighRisk || '',
    data.birthCanalAbnormality || '', data.uterineAbnormality || '',
    data.remark || '',
    '可编辑', toJsonStr(riskTagsResult),
    toJsonStr(operator || {}),
    now, now
  )

  upsertAnimal(data.animalId, {
    latestNonBUltrasoundDate: data.operationDate
  })

  logAudit(id, '非B超检查', '创建', operator, '', [])

  return getNonBRecordById(id)
}

function updateNonBRecord(id, data, reason, operator) {
  const db = getDB()
  const oldRow = db.prepare('SELECT * FROM non_b_records WHERE id = ?').get(id)
  if (!oldRow) return null
  if (oldRow.status === '锁定') throw new Error('该记录已被锁定，无法编辑')

  // 计算高风险标签
  const animalInfo = getAnimalById(oldRow.animalId)
  const bRecords = getBRecordsByAnimal(oldRow.animalId)
  const existingNonB = getNonBRecordsByAnimal(oldRow.animalId).filter(r => r.id !== id)
  const riskTagsResult = riskTags.calcNonBTags(
    { ...data, animalId: oldRow.animalId },
    oldRow.animalId, bRecords, existingNonB, animalInfo
  )

  const now = util.formatDateTime(new Date())

  db.prepare(`
    UPDATE non_b_records SET
      operationDate = ?, examParts = ?,
      fetalPosition = ?, cervicalCheck = ?, vetHighRisk = ?,
      birthCanalAbnormality = ?, uterineAbnormality = ?, remark = ?,
      riskTags = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    data.operationDate || oldRow.operationDate,
    toJsonStr(data.examParts || parseJsonField(oldRow.examParts, [])),
    data.fetalPosition || oldRow.fetalPosition,
    data.cervicalCheck || oldRow.cervicalCheck,
    data.vetHighRisk || oldRow.vetHighRisk,
    data.birthCanalAbnormality || oldRow.birthCanalAbnormality,
    data.uterineAbnormality || oldRow.uterineAbnormality,
    data.remark || oldRow.remark,
    toJsonStr(riskTagsResult),
    now,
    id
  )

  const oldEnriched = enrichNonBRecord({ ...oldRow })
  const newEnriched = getNonBRecordById(id)
  logAudit(id, '非B超检查', '修改', operator, reason || '', diffFields(oldEnriched, newEnriched))

  return newEnriched
}

// ========== 妊娠结局 ==========

function getOutcomeRecordsByAnimalDesc(animalId) {
  const db = getDB()
  const rows = db.prepare(
    'SELECT * FROM outcome_records WHERE animalId = ? ORDER BY outcomeDate DESC'
  ).all(animalId)
  return rows.map(r => { r.operator = parseJsonField(r.operator, {}); return r })
}

function getAllOutcomeRecords() {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM outcome_records ORDER BY outcomeDate DESC').all()
  return rows.map(r => { r.operator = parseJsonField(r.operator, {}); return r })
}

function createOutcomeRecord(data, operator) {
  const statusErr = validateOutcomeStatus(data.animalId)
  if (statusErr) throw new Error(statusErr)

  const dateErr = validateOutcomeDate(data.animalId, data.outcomeDate)
  if (dateErr) throw new Error(dateErr)

  const db = getDB()
  const now = util.formatDateTime(new Date())
  const id = util.generateId('O')

  db.prepare(`
    INSERT INTO outcome_records (
      id, animalId, outcomeDate, type,
      abnormalDescription, remark, operator,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.animalId, data.outcomeDate, data.type,
    data.abnormalDescription || '', data.remark || '',
    toJsonStr(operator || {}),
    now, now
  )

  // 触发数据锁定
  lockRecordsByOutcome(data.animalId, data.outcomeDate)

  // 更新动物状态为已结案
  updateAnimalStatus(data.animalId, '已结案')

  logAudit(id, '妊娠结局', '创建', operator, '', [])
  logAudit(data.animalId, '数据锁定', '锁定', operator, `妊娠结局登记触发锁定，结局日期: ${data.outcomeDate}`, [])

  const result = db.prepare('SELECT * FROM outcome_records WHERE id = ?').get(id)
  result.operator = parseJsonField(result.operator, {})
  return result
}

// ========== 数据锁定 ==========

function lockRecordsByOutcome(animalId, outcomeDate) {
  const db = getDB()
  db.prepare(
    'UPDATE b_records SET status = ? WHERE animalId = ? AND operationDate <= ? AND status != ?'
  ).run('锁定', animalId, outcomeDate, '锁定')

  db.prepare(
    'UPDATE non_b_records SET status = ? WHERE animalId = ? AND operationDate <= ? AND status != ?'
  ).run('锁定', animalId, outcomeDate, '锁定')
}

// ========== 删除 ==========

function deleteAnimalAllRecords(animalId, operator) {
  const db = getDB()
  db.prepare('DELETE FROM b_records WHERE animalId = ?').run(animalId)
  db.prepare('DELETE FROM non_b_records WHERE animalId = ?').run(animalId)
  db.prepare('DELETE FROM outcome_records WHERE animalId = ?').run(animalId)
  db.prepare('DELETE FROM animals WHERE animalId = ?').run(animalId)

  logAudit(animalId, '动物档案', '删除', operator, '删除该动物编号下的所有相关记录（含B超、非B超、妊娠结局）', [])
  return true
}

// ========== 汇总 ==========

function getCurrentStandardAge(animalId) {
  const pregnantRecords = getBRecordsByAnimal(animalId)
    .filter(r => r.pregnancyStatus === '在孕')
  if (pregnantRecords.length === 0) return null
  const baseRecord = pregnantRecords[0]
  const baseDate = baseRecord.operationDate
  const baseAge = baseRecord.calculatedAge || 0
  const todayStr = util.today()
  return baseAge + util.daysBetween(baseDate, todayStr)
}

function getOverdueTags(animalId) {
  const tags = []
  const db = getDB()

  const hasOutcome = db.prepare(
    'SELECT COUNT(*) as count FROM outcome_records WHERE animalId = ?'
  ).get(animalId).count > 0
  if (hasOutcome) return tags

  const animalBRecords = getBRecordsByAnimalDesc(animalId)
  if (animalBRecords.length === 0) return tags
  if (animalBRecords[0].pregnancyStatus !== '在孕') return tags

  const currentStandardAge = getCurrentStandardAge(animalId)
  if (currentStandardAge == null) return tags

  if (currentStandardAge > 170) tags.push('超预产期15天')
  else if (currentStandardAge >= 156 && currentStandardAge <= 170) tags.push('超预产期3天')

  return tags
}

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

    const todayStr = util.today()
    const bDaysSince = latestBRecord ? util.daysBetween(latestBRecord.operationDate, todayStr) : null
    const nonBDaysSince = latestNonBRecord ? util.daysBetween(latestNonBRecord.operationDate, todayStr) : null

    const currentStandardAge = getCurrentStandardAge(animal.animalId)

    // 合并高风险标签
    let mergedTags = []
    if (latestBRecord && latestBRecord.riskTags) mergedTags = mergedTags.concat(latestBRecord.riskTags)
    if (latestNonBRecord && latestNonBRecord.riskTags) {
      latestNonBRecord.riskTags.forEach(t => { if (mergedTags.indexOf(t) === -1) mergedTags.push(t) })
    }
    const overdueTags = getOverdueTags(animal.animalId)
    overdueTags.forEach(t => { if (mergedTags.indexOf(t) === -1) mergedTags.push(t) })

    const uniqueTags = []
    mergedTags.forEach(t => { if (uniqueTags.indexOf(t) === -1) uniqueTags.push(t) })

    // 互斥规则
    const over15Idx = uniqueTags.indexOf('超预产期15天')
    const over3Idx = uniqueTags.indexOf('超预产期3天')
    if (over15Idx !== -1 && over3Idx !== -1) uniqueTags.splice(over3Idx, 1)

    // 妊娠结局登记后，清除"弱猴"/"剖腹产史"特殊标签
    if (animal.status === '已结案' || latestOutcome) {
      const wmIdx = uniqueTags.indexOf('弱猴')
      if (wmIdx !== -1) uniqueTags.splice(wmIdx, 1)
      const csIdx = uniqueTags.indexOf('剖腹产史')
      if (csIdx !== -1) uniqueTags.splice(csIdx, 1)
    }

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

// ========== 审计 ==========

function logAudit(recordId, recordType, operation, operator, reason, fieldChanges) {
  const db = getDB()
  const now = util.formatDateTime(new Date())
  const id = util.generateId('L')

  db.prepare(`
    INSERT INTO audit_logs (id, recordId, recordType, operation, operator, operatorId, operationTime, reason, fieldChanges, operationIP)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, recordId, recordType, operation,
    operator ? (operator.name || '未知') : '未知',
    operator ? (operator.id || '') : '',
    now, reason || '',
    toJsonStr(fieldChanges || []),
    operator ? (operator.ip || '0.0.0.0') : '0.0.0.0'
  )
}

function getAuditLogs(recordId) {
  const db = getDB()
  if (recordId) {
    const rows = db.prepare('SELECT * FROM audit_logs WHERE recordId = ? ORDER BY operationTime DESC').all(recordId)
    return rows.map(r => { r.fieldChanges = parseJsonField(r.fieldChanges, []); return r })
  }
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY operationTime DESC').all()
  return rows.map(r => { r.fieldChanges = parseJsonField(r.fieldChanges, []); return r })
}

// ========== 字段差异对比 ==========

function diffFields(oldRecord, newRecord) {
  const changes = []
  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])
  const ignoreKeys = new Set(['updatedAt'])
  allKeys.forEach(key => {
    if (ignoreKeys.has(key)) return
    const oldVal = oldRecord[key]
    const newVal = newRecord[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key,
        oldValue: oldVal == null ? '' : String(oldVal),
        newValue: newVal == null ? '' : String(newVal)
      })
    }
  })
  return changes
}

module.exports = {
  // 校验
  validateAnimalIdFormat,
  validateBDate,
  validateNonBDate,
  validateNonBExamParts,
  validateBStatusFlow,
  validateOutcomeStatus,
  validateOutcomeDate,
  validateBRecordData,
  // 动物
  getAllAnimals,
  getAnimalById,
  upsertAnimal,
  updateAnimalStatus,
  // B超
  getBRecordsByAnimal,
  getBRecordsByAnimalDesc,
  getBRecordById,
  createBRecord,
  updateBRecord,
  // 非B超
  getNonBRecordsByAnimal,
  getNonBRecordsByAnimalDesc,
  getNonBRecordById,
  createNonBRecord,
  updateNonBRecord,
  // 妊娠结局
  getAllOutcomeRecords,
  getOutcomeRecordsByAnimalDesc,
  createOutcomeRecord,
  // 删除
  deleteAnimalAllRecords,
  // 汇总
  getSummaryList,
  getCurrentStandardAge,
  getOverdueTags,
  // 审计
  getAuditLogs
}
