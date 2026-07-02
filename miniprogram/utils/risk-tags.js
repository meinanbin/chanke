/**
 * 高风险标签计算模块
 * 在每次创建/更新 B超或非B超记录时自动调用
 * 新增：弱猴/剖腹产清单自动校验（仅妊娠状态为"在孕"或"疑似怀孕"时生效）
 */

const util = require('./util.js')
const specialLists = require('./special-lists.js')

// 弱猴/剖腹产相关标签
const TAG_WEAK_MONKEY = '弱猴'
const TAG_CESAREAN = '剖腹产史'

/**
 * 获取动物在指定日期之前一天的记录（B超和非B超）
 * @param {string} animalId
 * @param {string} operationDate 当前记录的操作日期 YYYY-MM-DD
 * @param {Array} allBRecords 该动物所有B超记录（按日期正序）
 * @param {Array} allNonBRecords 该动物所有非B超记录（按日期正序）
 * @returns {Array} 前一天的所有记录
 */
function getPrevDayRecords(animalId, operationDate, allBRecords, allNonBRecords) {
  const prevDate = util.subDays(operationDate, 1)
  const prevB = (allBRecords || []).filter(
    r => r.animalId === animalId && r.operationDate === prevDate
  )
  const prevNB = (allNonBRecords || []).filter(
    r => r.animalId === animalId && r.operationDate === prevDate
  )
  return [].concat(prevB, prevNB)
}

/**
 * 计算B超检查高风险标签
 * @param {Object} record 当前B超记录
 * @param {string} animalId 动物编号
 * @param {Array} allBRecords 该动物所有B超记录
 * @param {Array} allNonBRecords 该动物所有非B超记录
 * @param {Object} animalInfo 动物档案信息（含status）
 * @returns {Array<string>} 标签数组
 */
function calcBTags(record, animalId, allBRecords, allNonBRecords, animalInfo) {
  const tags = []
  const f = record

  // 1. 超预产期3天：(标准胎龄) >= 156 AND <= 170
  if (f.standardAge !== null && f.standardAge !== undefined && f.standardAge >= 156 && f.standardAge <= 170) {
    tags.push('超预产期3天')
  }

  // 2. 超预产期15天：(标准胎龄) > 170
  if (f.standardAge !== null && f.standardAge !== undefined && f.standardAge > 170) {
    tags.push('超预产期15天')
  }

  // 3. 胎位不正：(胎位) 有值 AND != '头位'
  if (f.fetalPosition && f.fetalPosition !== '头位') {
    tags.push('胎位不正')
  }

  // 4. 胎位多变：动物在孕 + 前一天存在记录且胎位非头位 + 当前记录胎位为头位
  if (animalInfo && animalInfo.status === '在孕') {
    const prevRecords = getPrevDayRecords(animalId, f.operationDate, allBRecords, allNonBRecords)
    const hasPrevNonHead = prevRecords.some(r => r.fetalPosition && r.fetalPosition !== '头位')
    if (hasPrevNonHead && f.fetalPosition === '头位') {
      tags.push('胎位多变')
    }
  }

  // 5. 胎心无：(胎心强度) = '无' OR (胎心数值) = 0（含数字0、字符串'0'、'0.0'等）
  var isHeartNone = false
  // 先检查胎心强度是否为'无'
  if (f.fetalHeartStrength === '无') {
    isHeartNone = true
  }
  // 再检查胎心数值是否为0（显式处理，避免隐式类型转换导致误判）
  if (!isHeartNone && f.fetalHeartValue !== null && f.fetalHeartValue !== undefined) {
    var hvNorm = parseFloat(f.fetalHeartValue)
    if (!isNaN(hvNorm) && hvNorm === 0) {
      isHeartNone = true
    }
  }
  if (isHeartNone) {
    tags.push('胎心无')
  }

  // 6. 胎心弱：(胎心数值) < 140 OR (胎心强度) = '弱'；与"胎心无"互斥，优先保留"胎心无"
  if (!isHeartNone) {
    var isHeartWeak = false
    if (f.fetalHeartValue !== null && f.fetalHeartValue !== undefined && f.fetalHeartValue !== '') {
      var hv = parseFloat(f.fetalHeartValue)
      if (!isNaN(hv) && hv < 140) isHeartWeak = true
    }
    if (f.fetalHeartStrength === '弱') isHeartWeak = true
    if (isHeartWeak) {
      tags.push('胎心弱')
    }
  }

  // 6. 胎盘前置：(胎盘位置) 包含 '完全前置' OR '部分前置'
  if (f.placentaPosition && Array.isArray(f.placentaPosition)) {
    if (f.placentaPosition.some(p => p === '完全前置' || p === '部分前置')) {
      tags.push('胎盘前置')
    }
  }

  // 7. 头径大于4.8：(双顶径) 有值 AND > 4.8
  if (f.bpd !== null && f.bpd !== undefined && parseFloat(f.bpd) > 4.8) {
    tags.push('头径大于4.8')
  }

  // 8. 羊水异常：羊水量= '无' OR '过少' OR 羊水污染= '细密均匀弱回声' OR '粗颗粒浑浊强回声'
  if (f.amnioticFluid === '无' || f.amnioticFluid === '过少' ||
      f.amnioticFluidPollution === '细密均匀弱回声' || f.amnioticFluidPollution === '粗颗粒浑浊强回声') {
    tags.push('羊水异常')
  }

  // 9. 兽医认定高危：(兽医认定高危) 不为空
  if (f.vetHighRisk && f.vetHighRisk !== '') {
    tags.push('兽医认定高危')
  }

  // 10. 产道/子宫异常：(产道异常) 不为空 OR (子宫异常) 不为空
  if ((f.birthCanalAbnormality && f.birthCanalAbnormality !== '') ||
      (f.uterineAbnormality && f.uterineAbnormality !== '')) {
    tags.push('产道/子宫异常')
  }

  // 11. 弱猴 / 剖腹产史：仅在妊娠状态为"在孕"或"疑似怀孕"时生效
  // 注：前端 createBRecord 计算标签时，传入 record 含 pregnancyStatus 字段
  const pregStatus = f.pregnancyStatus
  if (pregStatus === '在孕' || pregStatus === '疑似怀孕') {
    if (specialLists.isWeakMonkey(animalId)) {
      tags.push(TAG_WEAK_MONKEY)
    }
    if (specialLists.isCesarean(animalId)) {
      tags.push(TAG_CESAREAN)
    }
  }

  return tags
}

/**
 * 计算非B超检查高风险标签
 * @param {Object} record 当前非B超记录
 * @param {string} animalId 动物编号
 * @param {Array} allBRecords 该动物所有B超记录
 * @param {Array} allNonBRecords 该动物所有非B超记录
 * @param {Object} animalInfo 动物档案信息（含status）
 * @returns {Array<string>} 标签数组
 */
function calcNonBTags(record, animalId, allBRecords, allNonBRecords, animalInfo) {
  const tags = []
  const f = record

  // 1. 胎位不正：(胎位) 有值 AND != '头位'
  if (f.fetalPosition && f.fetalPosition !== '头位') {
    tags.push('胎位不正')
  }

  // 2. 胎位多变：动物在孕 + 前一天存在记录且胎位非头位 + 当前记录胎位为头位
  if (animalInfo && animalInfo.status === '在孕') {
    const prevRecords = getPrevDayRecords(animalId, f.operationDate, allBRecords, allNonBRecords)
    const hasPrevNonHead = prevRecords.some(r => r.fetalPosition && r.fetalPosition !== '头位')
    if (hasPrevNonHead && f.fetalPosition === '头位') {
      tags.push('胎位多变')
    }
  }

  return tags
}

module.exports = {
  calcBTags,
  calcNonBTags,
  TAG_WEAK_MONKEY,
  TAG_CESAREAN
}
