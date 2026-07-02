/**
 * 特殊动物清单管理模块（前端版本）
 * 提供弱猴/剖腹产清单的内存缓存与查询能力
 * 供 risk-tags.js 在打标签时调用
 */

const api = require('./api.js')

// 清单类型常量
const LIST_TYPE = {
  WEAK_MONKEY: 'weak_monkey',
  CESAREAN: 'cesarean'
}

// 内存缓存
const cache = {
  weakMonkey: new Set(),
  cesarean: new Set(),
  loaded: false,
  loadingPromise: null
}

/**
 * 初始化：从后端拉取清单
 */
function initSpecialLists() {
  if (cache.loadingPromise) return cache.loadingPromise
  cache.loadingPromise = api.fetchSpecialLists()
    .then(data => {
      // 兼容两种返回：扁平数组（按 listType 过滤时）或 {weak_monkey, cesarean}
      if (Array.isArray(data)) {
        // 单类型请求时直接是数组，无法区分，全部视为 weak_monkey 不合理
        // 实际应通过 fetchSpecialLists(listType) 单独拉取
        cache.weakMonkey = new Set()
        cache.cesarean = new Set()
        data.forEach(r => {
          const id = String(r.animalId || '').trim()
          if (!id) return
          if (r.listType === LIST_TYPE.WEAK_MONKEY) cache.weakMonkey.add(id)
          else if (r.listType === LIST_TYPE.CESAREAN) cache.cesarean.add(id)
        })
      } else if (data && typeof data === 'object') {
        const wmList = (data.weak_monkey || []).map(r => String(r.animalId).trim()).filter(x => x.length > 0)
        const csList = (data.cesarean || []).map(r => String(r.animalId).trim()).filter(x => x.length > 0)
        cache.weakMonkey = new Set(wmList)
        cache.cesarean = new Set(csList)
      }
      cache.loaded = true
      console.log(`[SpecialList] 前端清单加载：弱猴 ${cache.weakMonkey.size} 条，剖腹产 ${cache.cesarean.size} 条`)
      return true
    })
    .catch(err => {
      console.warn('[SpecialList] 加载清单失败：', err.message)
      cache.loaded = true  // 标记为已加载以避免阻塞 UI（失败时按空集处理）
      return false
    })
  return cache.loadingPromise
}

/**
 * 重新拉取清单
 */
function reloadSpecialLists() {
  cache.loadingPromise = null
  return initSpecialLists()
}

/**
 * 判断动物是否在弱猴清单
 */
function isWeakMonkey(animalId) {
  if (!animalId) return false
  return cache.weakMonkey.has(String(animalId).trim())
}

/**
 * 判断动物是否在剖腹产清单
 */
function isCesarean(animalId) {
  if (!animalId) return false
  return cache.cesarean.has(String(animalId).trim())
}

module.exports = {
  LIST_TYPE,
  initSpecialLists,
  reloadSpecialLists,
  isWeakMonkey,
  isCesarean,
  cache
}
