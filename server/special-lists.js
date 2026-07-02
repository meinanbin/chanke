/**
 * 特殊动物清单管理模块
 * 提供弱猴/剖腹产清单的内存缓存与查询能力
 * 用于高风险标签自动打标
 */

const { getDB } = require('./db.js')

// 清单类型常量
const LIST_TYPE = {
  WEAK_MONKEY: 'weak_monkey',
  CESAREAN: 'cesarean'
}

// 内存缓存（启动时加载，启动后通过 reload 方法热更新）
const cache = {
  weakMonkey: new Set(),   // 弱猴动物编号集合
  cesarean: new Set(),     // 剖腹产动物编号集合
  loaded: false
}

/**
 * 从数据库加载清单到内存缓存
 * 启动时调用一次即可，后续通过 reloadList 增量刷新
 */
function initSpecialLists() {
  const db = getDB()
  const rows = db.prepare('SELECT animalId, listType FROM special_animal_lists').all()
  cache.weakMonkey = new Set()
  cache.cesarean = new Set()
  for (const r of rows) {
    const id = String(r.animalId || '').trim()
    if (!id) continue
    if (r.listType === LIST_TYPE.WEAK_MONKEY) cache.weakMonkey.add(id)
    else if (r.listType === LIST_TYPE.CESAREAN) cache.cesarean.add(id)
  }
  cache.loaded = true
  console.log(`[SpecialList] 初始化完成：弱猴 ${cache.weakMonkey.size} 条，剖腹产 ${cache.cesarean.size} 条`)
}

/**
 * 热更新指定类型清单（添加/删除后调用）
 * @param {string} listType 'weak_monkey' | 'cesarean'
 */
function reloadList(listType) {
  const db = getDB()
  if (listType === LIST_TYPE.WEAK_MONKEY) {
    const rows = db.prepare("SELECT animalId FROM special_animal_lists WHERE listType = 'weak_monkey'").all()
    cache.weakMonkey = new Set(rows.map(r => String(r.animalId).trim()).filter(x => x.length > 0))
    console.log(`[SpecialList] 弱猴清单热更新：${cache.weakMonkey.size} 条`)
  } else if (listType === LIST_TYPE.CESAREAN) {
    const rows = db.prepare("SELECT animalId FROM special_animal_lists WHERE listType = 'cesarean'").all()
    cache.cesarean = new Set(rows.map(r => String(r.animalId).trim()).filter(x => x.length > 0))
    console.log(`[SpecialList] 剖腹产清单热更新：${cache.cesarean.size} 条`)
  }
}

/**
 * 判断动物是否在弱猴清单
 */
function isWeakMonkey(animalId) {
  if (!animalId || !cache.loaded) return false
  return cache.weakMonkey.has(String(animalId).trim())
}

/**
 * 判断动物是否在剖腹产清单
 */
function isCesarean(animalId) {
  if (!animalId || !cache.loaded) return false
  return cache.cesarean.has(String(animalId).trim())
}

/**
 * 获取清单中所有动物编号
 * @param {string} listType 'weak_monkey' | 'cesarean'
 * @returns {Array<string>}
 */
function getListIds(listType) {
  if (listType === LIST_TYPE.WEAK_MONKEY) return Array.from(cache.weakMonkey)
  if (listType === LIST_TYPE.CESAREAN) return Array.from(cache.cesarean)
  return []
}

/**
 * 添加动物到清单
 * @returns {boolean} true=成功插入；false=已存在
 */
function addToList(listType, animalId, operator) {
  const db = getDB()
  const aid = String(animalId || '').trim()
  if (!aid) throw new Error('动物编号不能为空')
  const util = require('./utils.js')
  const now = util.formatDateTime(new Date())
  const existing = db.prepare(
    'SELECT COUNT(*) as c FROM special_animal_lists WHERE animalId = ? AND listType = ?'
  ).get(aid, listType)
  if (existing.c > 0) return false
  const id = util.generateId('L')
  db.prepare(`
    INSERT INTO special_animal_lists (id, animalId, listType, addedAt, addedBy, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, aid, listType, now, (operator && operator.name) || '未知', '手动添加')
  reloadList(listType)
  return true
}

/**
 * 从清单中删除动物
 * @returns {boolean} true=成功删除
 */
function removeFromList(listType, animalId) {
  const db = getDB()
  const aid = String(animalId || '').trim()
  if (!aid) throw new Error('动物编号不能为空')
  const result = db.prepare(
    'DELETE FROM special_animal_lists WHERE animalId = ? AND listType = ?'
  ).run(aid, listType)
  reloadList(listType)
  return result.changes > 0
}

/**
 * 获取清单完整记录（含添加时间、操作人）
 */
function getListRecords(listType) {
  const db = getDB()
  return db.prepare(
    'SELECT * FROM special_animal_lists WHERE listType = ? ORDER BY addedAt DESC'
  ).all(listType)
}

module.exports = {
  LIST_TYPE,
  initSpecialLists,
  reloadList,
  isWeakMonkey,
  isCesarean,
  getListIds,
  addToList,
  removeFromList,
  getListRecords
}
