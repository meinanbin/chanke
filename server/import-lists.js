/**
 * 一次性导入脚本
 * 读取 /root/弱猴_ids.json 与 /root/剖腹产_ids.json，批量写入 special_animal_lists
 * 使用：cd /opt/obstetric-server && node import-lists.js
 */

const fs = require('fs')
const path = require('path')
const { getDB, initDB, closeDB } = require('./db.js')
const util = require('./utils.js')

// 配置文件路径
const WEAK_MONKEY_FILE = process.argv[2] || '/root/弱猴_ids.json'
const CESAREAN_FILE = process.argv[3] || '/root/剖腹产_ids.json'

// 系统用户
const SYSTEM_OPERATOR = { id: 'SYSTEM', name: '系统导入', role: '系统', ip: '127.0.0.1' }

function loadIds(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[导入] 找不到文件：${filePath}`)
    return []
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  const list = JSON.parse(raw)
  if (!Array.isArray(list)) {
    console.error(`[导入] 文件格式错误，应为数组：${filePath}`)
    return []
  }
  // 过滤空值、去除首尾空白
  return list.map(x => String(x).trim()).filter(x => x.length > 0)
}

function importList(db, listType, ids) {
  if (ids.length === 0) return { inserted: 0, skipped: 0 }

  const now = util.formatDateTime(new Date())
  const insert = db.prepare(`
    INSERT OR IGNORE INTO special_animal_lists (id, animalId, listType, addedAt, addedBy, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const checkExists = db.prepare(`
    SELECT COUNT(*) as count FROM special_animal_lists WHERE animalId = ? AND listType = ?
  `)

  let inserted = 0
  let skipped = 0
  const tx = db.transaction(items => {
    for (const animalId of items) {
      const existing = checkExists.get(animalId, listType)
      if (existing.count > 0) {
        skipped++
        continue
      }
      const id = util.generateId('L')
      insert.run(id, animalId, listType, now, SYSTEM_OPERATOR.name, '从附件批量导入')
      inserted++
    }
  })

  tx(ids)
  return { inserted, skipped }
}

function main() {
  initDB()
  const db = getDB()

  console.log('========== 特殊清单导入 ==========')
  console.log(`[导入] 弱猴清单文件：${WEAK_MONKEY_FILE}`)
  console.log(`[导入] 剖腹产清单文件：${CESAREAN_FILE}`)
  console.log()

  // 导入弱猴清单
  const weakIds = loadIds(WEAK_MONKEY_FILE)
  console.log(`[导入] 读取弱猴编号：${weakIds.length} 个`)
  const weakResult = importList(db, 'weak_monkey', weakIds)
  console.log(`[导入] 弱猴：新增 ${weakResult.inserted} 条，跳过 ${weakResult.skipped} 条（已存在）`)

  // 导入剖腹产清单
  const cesareanIds = loadIds(CESAREAN_FILE)
  console.log(`[导入] 读取剖腹产编号：${cesareanIds.length} 个`)
  const cesareanResult = importList(db, 'cesarean', cesareanIds)
  console.log(`[导入] 剖腹产：新增 ${cesareanResult.inserted} 条，跳过 ${cesareanResult.skipped} 条（已存在）`)

  // 总览
  const totalWeak = db.prepare(`SELECT COUNT(*) as c FROM special_animal_lists WHERE listType='weak_monkey'`).get().c
  const totalCesarean = db.prepare(`SELECT COUNT(*) as c FROM special_animal_lists WHERE listType='cesarean'`).get().c
  console.log()
  console.log('========== 导入完成 ==========')
  console.log(`弱猴清单总数：${totalWeak} 条`)
  console.log(`剖腹产清单总数：${totalCesarean} 条`)
  console.log(`合计：${totalWeak + totalCesarean} 条`)

  closeDB()
}

main()
