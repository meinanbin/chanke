/**
 * 高风险标签计算模块（服务端版本）
 * 逻辑与小程序端 risk-tags.js 完全一致
 * 新增：弱猴/剖腹产清单自动校验（仅妊娠状态为"在孕"或"疑似怀孕"时生效）
 */

const util = require('./utils.js')
const specialLists = require('./special-lists.js')

// 弱猴/剖腹产相关标签
const TAG_WEAK_MONKEY = '弱猴'
const TAG_CESAREAN = '剖腹产史'

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

  if (f.standardAge !== null && f.standardAge !== undefined && f.standardAge >= 156 && f.standardAge <= 170) {
    tags.push('超预产期3天')
  }
  if (f.standardAge !== null && f.standardAge !== undefined && f.standardAge > 170) {
    tags.push('超预产期15天')
  }
  if (f.fetalPosition && f.fetalPosition !== '头位') {
    tags.push('胎位不正')
  }
  if (animalInfo && animalInfo.status === '在孕') {
    const prevRecords = getPrevDayRecords(animalId, f.operationDate, allBRecords, allNonBRecords)
    const hasPrevNonHead = prevRecords.some(r => r.fetalPosition && r.fetalPosition !== '头位')
    if (hasPrevNonHead && f.fetalPosition === '头位') {
      tags.push('胎位多变')
    }
  }

  let isHeartNone = false
  if (f.fetalHeartStrength === '无') isHeartNone = true
  if (!isHeartNone && f.fetalHeartValue !== null && f.fetalHeartValue !== undefined) {
    const hvNorm = parseFloat(f.fetalHeartValue)
    if (!isNaN(hvNorm) && hvNorm === 0) isHeartNone = true
  }
  if (isHeartNone) tags.push('胎心无')

  if (!isHeartNone) {
    let isHeartWeak = false
    if (f.fetalHeartValue !== null && f.fetalHeartValue !== undefined && f.fetalHeartValue !== '') {
      const hv = parseFloat(f.fetalHeartValue)
      if (!isNaN(hv) && hv < 140) isHeartWeak = true
    }
    if (f.fetalHeartStrength === '弱') isHeartWeak = true
    if (isHeartWeak) tags.push('胎心弱')
  }

  const placentaPos = util.safeParseJSON(f.placentaPosition, [])
  if (Array.isArray(placentaPos) && placentaPos.some(p => p === '完全前置' || p === '部分前置')) {
    tags.push('胎盘前置')
  }

  if (f.bpd !== null && f.bpd !== undefined && parseFloat(f.bpd) > 4.8) {
    tags.push('头径大于4.8')
  }

  if (f.amnioticFluid === '无' || f.amnioticFluid === '过少' ||
      f.amnioticFluidPollution === '细密均匀弱回声' || f.amnioticFluidPollution === '粗颗粒浑浊强回声') {
    tags.push('羊水异常')
  }

  if (f.vetHighRisk && f.vetHighRisk !== '') tags.push('兽医认定高危')

  if ((f.birthCanalAbnormality && f.birthCanalAbnormality !== '') ||
      (f.uterineAbnormality && f.uterineAbnormality !== '')) {
    tags.push('产道/子宫异常')
  }

  // 特殊清单标签：仅在妊娠状态为"在孕"或"疑似怀孕"时生效
  // 妊娠状态保存在 record.pregnancyStatus 中（创建/更新时一并传入）
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
 */
function calcNonBTags(record, animalId, allBRecords, allNonBRecords, animalInfo) {
  const tags = []
  const f = record

  if (f.fetalPosition && f.fetalPosition !== '头位') {
    tags.push('胎位不正')
  }
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
