/**
 * 双轨制胎龄计算模块
 *
 * 1. 计算胎龄：根据B超物理测量值（CRL/BPD）反推理论孕周
 * 2. 标准胎龄：以"确认受孕日"为基准的连续累计孕周
 */

const util = require('./util.js')

/**
 * 胚胎期查表：长径/顶臀径(cm) → 胎龄(天)
 * 根据需求文档2.2节的表格
 */
const EMBRYO_TABLE = [
  { max: 0.15, age: 21 },
  { max: 0.30, age: 22 },
  { max: 0.39, age: 23 },
  { max: 0.46, age: 24 },
  { max: 0.50, age: 25 },
  { max: 0.56, age: 26 },
  { max: 0.59, age: 27 },
  { max: 0.70, age: 28 },
  { max: 0.79, age: 29 },
  { max: 0.92, age: 30 },
  { max: 1.05, age: 31 },
  { max: 1.21, age: 32 },
  { max: 1.32, age: 33 },
  { max: 1.44, age: 34 },
  { max: 1.54, age: 35 },
  { max: 1.63, age: 36 },
  { max: 1.72, age: 37 },
  { max: 1.85, age: 38 },
  { max: 1.90, age: 39 },
  { max: 2.02, age: 40 },
  { max: 2.18, age: 41 },
  { max: 2.31, age: 42 },
  { max: 2.43, age: 43 },
  { max: 2.67, age: 44 },
  { max: 2.90, age: 45 },
  { max: Infinity, age: 46 }
]

/**
 * 胎儿期查表：双顶径(cm) → 胎龄(天)
 * 根据需求文档2.2节的表格
 */
const FETAL_TABLE = [
  { max: 1.20, age: 50 },
  { max: 1.25, age: 51 },
  { max: 1.31, age: 52 },
  { max: 1.36, age: 53 },
  { max: 1.41, age: 54 },
  { max: 1.47, age: 55 },
  { max: 1.52, age: 56 },
  { max: 1.57, age: 57 },
  { max: 1.62, age: 58 },
  { max: 1.68, age: 59 },
  { max: 1.72, age: 60 },
  { max: 1.77, age: 61 },
  { max: 1.82, age: 62 },
  { max: 1.87, age: 63 },
  { max: 1.90, age: 64 },
  { max: 1.97, age: 65 },
  { max: 2.02, age: 66 },
  { max: 2.09, age: 67 },
  { max: 2.11, age: 68 },
  { max: 2.16, age: 69 },
  { max: 2.19, age: 70 },
  { max: 2.24, age: 71 },
  { max: 2.30, age: 72 },
  { max: 2.34, age: 73 },
  { max: 2.38, age: 74 },
  { max: 2.43, age: 75 },
  { max: 2.48, age: 76 },
  { max: 2.53, age: 77 },
  { max: 2.56, age: 78 },
  { max: 2.60, age: 79 },
  { max: 2.66, age: 80 },
  { max: 2.69, age: 81 },
  { max: 2.72, age: 82 },
  { max: 2.79, age: 83 },
  { max: 2.81, age: 84 },
  { max: 2.87, age: 85 },
  { max: 2.89, age: 86 },
  { max: 2.94, age: 87 },
  { max: 2.99, age: 88 },
  { max: 3.02, age: 89 },
  { max: 3.04, age: 90 },
  { max: 3.09, age: 91 },
  { max: 3.12, age: 92 },
  { max: 3.16, age: 93 },
  { max: 3.20, age: 94 },
  { max: 3.23, age: 95 },
  { max: 3.26, age: 96 },
  { max: 3.30, age: 97 },
  { max: 3.34, age: 98 },
  { max: 3.37, age: 99 },
  { max: 3.40, age: 100 },
  { max: 3.44, age: 101 },
  { max: 3.46, age: 102 },
  { max: 3.50, age: 103 },
  { max: 3.53, age: 104 },
  { max: 3.55, age: 105 },
  { max: 3.59, age: 106 },
  { max: 3.62, age: 107 },
  { max: 3.64, age: 108 },
  { max: 3.67, age: 109 },
  { max: 3.71, age: 110 },
  { max: 3.75, age: 111 },
  { max: 3.76, age: 112 },
  { max: 3.79, age: 113 },
  { max: 3.83, age: 114 },
  { max: 3.85, age: 115 },
  { max: 3.87, age: 116 },
  { max: 3.90, age: 117 },
  { max: 3.92, age: 118 },
  { max: 3.94, age: 119 },
  { max: 3.97, age: 120 },
  { max: 3.98, age: 121 },
  { max: 4.00, age: 122 },
  { max: 4.03, age: 123 },
  { max: 4.06, age: 124 },
  { max: 4.08, age: 125 },
  { max: 4.09, age: 126 },
  { max: 4.10, age: 127 },
  { max: 4.13, age: 128 },
  { max: 4.15, age: 129 },
  { max: 4.17, age: 130 },
  { max: 4.18, age: 131 },
  { max: 4.20, age: 132 },
  { max: 4.23, age: 133 },
  { max: 4.25, age: 134 },
  { max: 4.27, age: 135 },
  { max: 4.28, age: 136 },
  { max: 4.29, age: 137 },
  { max: 4.30, age: 138 },
  { max: 4.31, age: 139 },
  { max: 4.33, age: 140 },
  { max: 4.35, age: 141 },
  { max: 4.37, age: 142 },
  { max: 4.38, age: 143 },
  { max: 4.39, age: 144 },
  { max: 4.40, age: 145 },
  { max: 4.41, age: 146 },
  { max: 4.42, age: 147 },
  { max: 4.43, age: 148 },
  { max: 4.44, age: 149 },
  { max: 4.45, age: 150 },
  { max: 4.46, age: 151 },
  { max: 4.47, age: 152 },
  { max: 4.48, age: 153 },
  { max: 4.49, age: 154 },
  { max: 4.50, age: 155 },
  { max: 4.51, age: 156 },
  { max: 4.52, age: 157 },
  { max: 4.53, age: 158 },
  { max: 4.54, age: 159 },
  { max: 4.55, age: 160 },
  { max: 4.56, age: 161 },
  { max: 4.57, age: 162 },
  { max: 4.58, age: 163 },
  { max: 4.59, age: 164 },
  { max: Infinity, age: 165 }
]

/**
 * 计算胎龄（根据B超测量数据查表）
 *
 * @param {string} fetalStage - 胎儿阶段：胚种期/胚胎期/胎儿期
 * @param {number} measurement - 测量值(cm)
 *   - 胚种期：不使用测量值，固定返回20
 *   - 胚胎期：长径/顶臀径
 *   - 胎儿期：双顶径
 * @returns {number|null} 胎龄(天)，无法计算时返回null
 */
function calcGestationalAge(fetalStage, measurement) {
  if (fetalStage === '胚种期') {
    return 20
  }

  if (fetalStage === '胚胎期') {
    if (measurement == null || measurement === '' || isNaN(measurement)) return null
    const val = parseFloat(measurement)
    for (const row of EMBRYO_TABLE) {
      if (val <= row.max) return row.age
    }
    return 46
  }

  if (fetalStage === '胎儿期') {
    if (measurement == null || measurement === '' || isNaN(measurement)) return null
    const val = parseFloat(measurement)
    for (const row of FETAL_TABLE) {
      if (val <= row.max) return row.age
    }
    return 165
  }

  return null
}

/**
 * 计算标准胎龄
 *
 * 逻辑：
 * 1. 确立基准日：
 *    - 场景A（初次怀孕）：动物无历史记录或最新记录为"未孕"，
 *      则本次"在孕"记录的操作日期设为基准日，基准日胎龄 = 计算胎龄
 *    - 场景B（持续监测）：动物已有"在孕"记录，
 *      沿用最近一次从"未孕"转为"在孕"的那条记录的日期作为基准日
 *
 * 2. 计算公式：
 *    当前标准胎龄 = 基准日胎龄 + (当前操作日期 - 基准日日期)
 *
 * @param {string} animalId - 动物编号
 * @param {string} currentDate - 当前操作日期 YYYY-MM-DD
 * @param {number} calculatedAge - 当前记录的计算胎龄
 * @param {Array} historyRecords - 该动物的历史B超记录（按时间正序）
 * @returns {number|null} 标准胎龄(天)
 */
function calcStandardAge(animalId, currentDate, calculatedAge, historyRecords) {
  // 找到基准日和基准日胎龄
  let baseDate = null
  let baseAge = null

  // 场景A：无历史记录或最新记录为"未孕"
  // 场景B：已有"在孕"记录，找最近一次从"未孕"转为"在孕"的记录

  // 筛选该动物的所有B超记录（按时间正序）
  const records = (historyRecords || [])
    .filter(r => r.animalId === animalId)
    .sort((a, b) => new Date(a.operationDate) - new Date(b.operationDate))

  if (records.length === 0) {
    // 场景A：初次怀孕
    baseDate = currentDate
    baseAge = calculatedAge
  } else {
    // 查找最近一次"未孕→在孕"的转折点
    let foundTransition = false
    for (let i = records.length - 1; i >= 0; i--) {
      const record = records[i]
      if (record.pregnancyStatus === '在孕') {
        // 检查前一条是否为"未孕"或者是第一条
        if (i === 0 || records[i - 1].pregnancyStatus === '未孕') {
          baseDate = record.operationDate
          baseAge = record.calculatedAge || record.calcAge
          foundTransition = true
          break
        }
      }
    }

    if (!foundTransition) {
      // 如果没有找到转折点，检查最新记录状态
      const latestRecord = records[records.length - 1]
      if (latestRecord.pregnancyStatus === '未孕') {
        // 最新记录为"未孕"，当前为初次怀孕
        baseDate = currentDate
        baseAge = calculatedAge
      } else {
        // 所有记录都是"在孕"，使用第一条记录作为基准
        baseDate = records[0].operationDate
        baseAge = records[0].calculatedAge || records[0].calcAge
      }
    }
  }

  if (!baseDate || baseAge == null) {
    return calculatedAge // 降级：返回计算胎龄
  }

  // 计算公式：当前标准胎龄 = 基准日胎龄 + (当前操作日期 - 基准日日期)
  const daysDiff = util.daysBetween(baseDate, currentDate)
  return baseAge + daysDiff
}

module.exports = {
  calcGestationalAge,
  calcStandardAge,
  EMBRYO_TABLE,
  FETAL_TABLE
}
